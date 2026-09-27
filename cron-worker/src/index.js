/**
 * SecureShare - 期限切れシークレット定期削除 & 無料枠サーキットブレーカー Worker
 * 
 * 主な機能:
 * 1. 期限切れシークレット/画像の定期削除
 * 2. Cloudflare D1 / R2 利用量の定期監視 (GraphQL Analytics API)
 * 3. 無料枠上限超過前の自動サーキットブレーカー発動（一時停止）
 * 4. 日次/月次リセット時のサービス自動再開
 * 5. 手動でのステータス確認・メンテ切替エンドポイント
 */

// 無料枠と安全閾値 (85%)
const LIMITS = {
  // D1 (日次リセット: 毎日 00:00 UTC)
  D1_ROWS_READ_MAX: 5000000,
  D1_ROWS_READ_THRESHOLD: 4250000, // 85%
  D1_ROWS_WRITTEN_MAX: 100000,
  D1_ROWS_WRITTEN_THRESHOLD: 85000, // 85%

  // R2 (月次リセット: 毎月1日 00:00 UTC)
  R2_CLASS_A_MAX: 1000000,
  R2_CLASS_A_THRESHOLD: 850000, // 85%
  R2_CLASS_B_MAX: 10000000,
  R2_CLASS_B_THRESHOLD: 8500000, // 85%
};

export default {
  // Cronスケジュールによりトリガーされるハンドラ（毎時0分など）
  async scheduled(event, env, ctx) {
    console.log(`[Cron Trigger] 定期バッチを開始します: ${new Date().toISOString()}`);

    if (env.DB) {
      // 1. 期限切れシークレット/画像の物理削除
      await cleanExpiredItems(env.DB);

      // 2. 無料枠利用量チェック & サーキットブレーカー判定
      await checkFreeTierUsageAndManageState(env);
    } else {
      console.error('[Cron Worker] D1データベース (DB) がバインドされていません。');
    }
  },

  // HTTPリクエストによる手動操作・状態確認
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'DB not bound' }), { status: 500 });
    }

    // テーブルが存在しない場合に備えて初期化
    await ensureStatusTable(env.DB);

    // GET /status - 現在のシステム状態と設定を取得
    if (url.pathname === '/status') {
      const status = await getSystemStatus(env.DB);
      return new Response(JSON.stringify({ ok: true, status }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // POST /check - 手動で使用量チェック＆サーキットブレーカー判定を実行
    if (url.pathname === '/check' && request.method === 'POST') {
      const result = await checkFreeTierUsageAndManageState(env);
      return new Response(JSON.stringify({ ok: true, result }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // POST /maintenance/enable - 手動でメンテナンスモード（一時停止）を有効化
    if (url.pathname === '/maintenance/enable' && request.method === 'POST') {
      const reason = url.searchParams.get('reason') || 'MANUAL_MAINTENANCE';
      const resetAt = getNextUtcMidnight();
      await setMaintenanceMode(env.DB, true, reason, resetAt);
      return new Response(JSON.stringify({ ok: true, message: 'Maintenance mode enabled', reason, resetAt }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // POST /maintenance/disable - 手動でメンテナンスモードを解除（サービス再開）
    if (url.pathname === '/maintenance/disable' && request.method === 'POST') {
      await setMaintenanceMode(env.DB, false, '', null);
      return new Response(JSON.stringify({ ok: true, message: 'Maintenance mode disabled (service restored)' }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // デフォルト案内
    return new Response(
      JSON.stringify({
        message: 'SecureShare Cron & Circuit Breaker Worker',
        endpoints: [
          'GET  /status',
          'POST /check',
          'POST /maintenance/enable',
          'POST /maintenance/disable',
        ],
      }, null, 2),
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  },
};

/**
 * 期限切れシークレット・画像のクリーンアップ
 */
async function cleanExpiredItems(db) {
  try {
    const now = Date.now();
    console.log(`[Cron Cleanup] 期限切れシークレットの削除を開始します: ${new Date(now).toISOString()}`);

    // 有効期限切れシークレットを一括削除
    const secretResult = await db.prepare(`DELETE FROM secrets WHERE expires_at < ?`).bind(now).run();
    const deletedSecrets = secretResult.meta && typeof secretResult.meta.changes === 'number' ? secretResult.meta.changes : 0;

    // 有効期限切れ画像レコードも削除（R2オブジェクト自体は通常期限到来時に削除、またはメタデータ削除）
    let deletedImages = 0;
    try {
      const imageResult = await db.prepare(`DELETE FROM images WHERE expires_at < ?`).bind(now).run();
      deletedImages = imageResult.meta && typeof imageResult.meta.changes === 'number' ? imageResult.meta.changes : 0;
    } catch (_) {}

    console.log(`[Cron Cleanup] 完了: シークレット ${deletedSecrets} 件, 画像 ${deletedImages} 件を削除しました。`);
  } catch (err) {
    console.error('[Cron Cleanup] エラーが発生しました:', err);
  }
}

/**
 * テーブルの存在確認・自動作成
 */
async function ensureStatusTable(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS system_status (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();
  } catch (err) {
    console.warn('[Circuit Breaker] ensureStatusTable エラー:', err.message);
  }
}

/**
 * 現在のシステム状態を取得
 */
async function getSystemStatus(db) {
  await ensureStatusTable(db);
  const rows = await db.prepare(`SELECT key, value, updated_at FROM system_status`).all();
  const status = {};
  if (rows && rows.results) {
    for (const r of rows.results) {
      status[r.key] = { value: r.value, updated_at: r.updated_at };
    }
  }
  return status;
}

/**
 * メンテナンスモード（サーキットブレーカー状態）の更新
 */
async function setMaintenanceMode(db, isMaintenance, reason = '', resetAt = null) {
  await ensureStatusTable(db);
  const now = Date.now();
  const modeVal = isMaintenance ? '1' : '0';

  await db.batch([
    db.prepare(`INSERT INTO system_status (key, value, updated_at) VALUES ('maintenance_mode', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(modeVal, now),
    db.prepare(`INSERT INTO system_status (key, value, updated_at) VALUES ('maintenance_reason', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(reason, now),
    db.prepare(`INSERT INTO system_status (key, value, updated_at) VALUES ('maintenance_reset_at', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(resetAt ? resetAt.toString() : '', now),
  ]);

  if (isMaintenance) {
    console.warn(`[Circuit Breaker] ⚠️ サーキットブレーカー発動: サービスを一時停止しました (理由: ${reason}, リセット予定: ${resetAt ? new Date(resetAt).toISOString() : '未定'})`);
  } else {
    console.log(`[Circuit Breaker] ✅ サーキットブレーカー解除: サービスを通常稼働に再開しました`);
  }
}

/**
 * Cloudflare GraphQL APIを利用した利用量チェックとサーキットブレーカー自動管理
 */
async function checkFreeTierUsageAndManageState(env) {
  await ensureStatusTable(env.DB);
  const currentStatus = await getSystemStatus(env.DB);
  const isCurrentlyMaintenance = currentStatus.maintenance_mode?.value === '1';

  // API Token と Account ID が設定されていない場合はAPI問い合わせをスキップ
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    console.warn('[Circuit Breaker] CF_API_TOKEN または CF_ACCOUNT_ID が未設定のため、GraphQL使用量監視はスキップします。手動モードとして稼働します。');
    return { skipped: true, reason: 'Credentials not configured', isCurrentlyMaintenance };
  }

  try {
    const todayUtc = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const monthStartUtc = `${todayUtc.substring(0, 7)}-01`;   // "YYYY-MM-01"

    // Cloudflare GraphQL APIクエリ
    const query = `
      query GetUsage($accountTag: String!, $today: String!, $monthStart: String!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            d1AnalyticsAdaptiveGroups(filter: { date_geq: $today }, limit: 10) {
              sum {
                rowsRead
                rowsWritten
              }
            }
            r2OperationsAdaptiveGroups(filter: { date_geq: $monthStart }, limit: 100) {
              sum {
                requests
              }
              dimensions {
                action
              }
            }
          }
        }
      }
    `;

    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: env.CF_ACCOUNT_ID,
          today: todayUtc,
          monthStart: monthStartUtc,
        },
      }),
    });

    if (!res.ok) {
      console.error(`[Circuit Breaker] GraphQL APIリクエスト失敗: HTTP ${res.status}`);
      return { ok: false, status: res.status };
    }

    const data = await res.json();
    const accountData = data?.data?.viewer?.accounts?.[0];

    // D1集計
    let d1RowsRead = 0;
    let d1RowsWritten = 0;
    const d1Groups = accountData?.d1AnalyticsAdaptiveGroups || [];
    for (const g of d1Groups) {
      d1RowsRead += g.sum?.rowsRead || 0;
      d1RowsWritten += g.sum?.rowsWritten || 0;
    }

    // R2集計
    let r2ClassA = 0;
    let r2ClassB = 0;
    const r2Groups = accountData?.r2OperationsAdaptiveGroups || [];
    for (const g of r2Groups) {
      const action = g.dimensions?.action || '';
      const reqs = g.sum?.requests || 0;
      // Class A: PutObject, ListObjects, CreateMultipartUpload等
      if (['PutObject', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload', 'UploadPart', 'ListObjects', 'ListObjectsV2', 'ListBuckets'].includes(action)) {
        r2ClassA += reqs;
      } else {
        r2ClassB += reqs;
      }
    }

    console.log(`[Circuit Breaker Usage] 本日D1読み取り: ${d1RowsRead}/${LIMITS.D1_ROWS_READ_MAX}, 書き込み: ${d1RowsWritten}/${LIMITS.D1_ROWS_WRITTEN_MAX} | 今月R2 ClassA: ${r2ClassA}/${LIMITS.R2_CLASS_A_MAX}, ClassB: ${r2ClassB}/${LIMITS.R2_CLASS_B_MAX}`);

    // 閾値判定
    let limitExceededReason = null;
    let estimatedResetAt = null;

    if (d1RowsRead >= LIMITS.D1_ROWS_READ_THRESHOLD) {
      limitExceededReason = `D1_ROWS_READ_LIMIT (${d1RowsRead}/${LIMITS.D1_ROWS_READ_MAX})`;
      estimatedResetAt = getNextUtcMidnight();
    } else if (d1RowsWritten >= LIMITS.D1_ROWS_WRITTEN_THRESHOLD) {
      limitExceededReason = `D1_ROWS_WRITTEN_LIMIT (${d1RowsWritten}/${LIMITS.D1_ROWS_WRITTEN_MAX})`;
      estimatedResetAt = getNextUtcMidnight();
    } else if (r2ClassA >= LIMITS.R2_CLASS_A_THRESHOLD) {
      limitExceededReason = `R2_CLASS_A_LIMIT (${r2ClassA}/${LIMITS.R2_CLASS_A_MAX})`;
      estimatedResetAt = getNextUtcMonthStart();
    } else if (r2ClassB >= LIMITS.R2_CLASS_B_THRESHOLD) {
      limitExceededReason = `R2_CLASS_B_LIMIT (${r2ClassB}/${LIMITS.R2_CLASS_B_MAX})`;
      estimatedResetAt = getNextUtcMonthStart();
    }

    // 判定結果の反映
    if (limitExceededReason) {
      // 閾値超過 → サービスを一時停止（サーキットブレーカー発動）
      await setMaintenanceMode(env.DB, true, limitExceededReason, estimatedResetAt);
      return {
        action: 'TRIGGERED_MAINTENANCE',
        reason: limitExceededReason,
        resetAt: estimatedResetAt,
        usage: { d1RowsRead, d1RowsWritten, r2ClassA, r2ClassB },
      };
    } else if (isCurrentlyMaintenance) {
      // 閾値未満に戻っている（日次・月次リセット完了）かつメンテナンス中の場合 → 自動再開
      await setMaintenanceMode(env.DB, false, '', null);
      return {
        action: 'RESTORED_SERVICE',
        usage: { d1RowsRead, d1RowsWritten, r2ClassA, r2ClassB },
      };
    }

    return {
      action: 'NORMAL',
      usage: { d1RowsRead, d1RowsWritten, r2ClassA, r2ClassB },
    };
  } catch (err) {
    console.error('[Circuit Breaker] 使用量チェック中にエラーが発生しました:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * 翌日 00:00 UTC (D1リセット時刻) のタイムスタンプを取得
 */
function getNextUtcMidnight() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

/**
 * 翌月1日 00:00 UTC (R2リセット時刻) のタイムスタンプを取得
 */
function getNextUtcMonthStart() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}
