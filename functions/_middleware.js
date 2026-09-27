/**
 * SecureShare - 無料枠サーキットブレーカー ミドルウェア
 * Cloudflare Pages Functions の全リクエストの手前で実行され、
 * 無料枠超過による一時停止（メンテナンスモード）時にAPIアクセスを 503 で遮断します。
 */

// インメモリキャッシュ (Workerインスタンスが生きている間保持)
let statusCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60秒間キャッシュ（D1の読み取り消費を極小化）

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 1. 静的アセット (HTML, CSS, JS, 画像など) は遮断せず常に返却
  // Cloudflare Pages の静的配信は無料・無制限のため、メンテナンス案内画面を表示できます
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  // 2. システム状態確認用エンドポイント (/api/status) は特別に通す
  if (url.pathname === '/api/status') {
    return handleStatusCheck(env);
  }

  // 3. DBバインディングがない場合はそのまま後続処理へ
  if (!env.DB) {
    return next();
  }

  const now = Date.now();
  let status = null;

  // インメモリキャッシュが有効な場合はキャッシュから取得
  if (statusCache && (now - lastFetchTime < CACHE_TTL_MS)) {
    status = statusCache;
  } else {
    try {
      const results = await env.DB.prepare(
        `SELECT key, value FROM system_status WHERE key IN ('maintenance_mode', 'maintenance_reason', 'maintenance_reset_at')`
      ).all();

      const statusMap = {};
      if (results && results.results) {
        for (const row of results.results) {
          statusMap[row.key] = row.value;
        }
      }

      status = {
        isMaintenance: statusMap.maintenance_mode === '1',
        reason: statusMap.maintenance_reason || 'FREE_TIER_LIMIT',
        resetAt: statusMap.maintenance_reset_at ? parseInt(statusMap.maintenance_reset_at, 10) : null,
      };

      statusCache = status;
      lastFetchTime = now;
    } catch (err) {
      // テーブル未作成時やDBエラー時は安全のためフェイルオープン（通常処理を通す）
      console.warn('[_middleware] system_status 読み取り失敗（フェイルオープン）:', err.message);
      status = { isMaintenance: false };
    }
  }

  // 4. サーキットブレーカー発動中（メンテナンスモード）の場合
  // D1 / R2 への新規アクセスを一切行わず、即座に HTTP 503 を返却
  if (status && status.isMaintenance) {
    const retrySeconds = status.resetAt ? Math.max(0, Math.ceil((status.resetAt - now) / 1000)) : 3600;

    return new Response(
      JSON.stringify({
        error: 'service_temporarily_unavailable',
        message: '現在、Cloudflare無料利用枠の上限に達したため一時停止中です。リセット時刻に自動再開します。',
        maintenance: true,
        reason: status.reason,
        reset_at: status.resetAt,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': retrySeconds.toString(),
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 5. 通常稼働時は後続のAPI処理（/api/secret, /api/image 等）を実行
  return next();
}

/**
 * サーキットブレーカーの状態を返却するハンドラ (/api/status)
 */
async function handleStatusCheck(env) {
  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ ok: false, error: 'Database not bound' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const results = await env.DB.prepare(
      `SELECT key, value, updated_at FROM system_status`
    ).all();

    const data = {};
    if (results && results.results) {
      for (const row of results.results) {
        data[row.key] = {
          value: row.value,
          updated_at: row.updated_at,
        };
      }
    }

    return new Response(JSON.stringify({ ok: true, system_status: data }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
