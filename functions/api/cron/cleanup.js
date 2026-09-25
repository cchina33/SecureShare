/**
 * POST /api/cron/cleanup
 * 期限切れシークレットを一括でD1データベースから物理削除するAPI
 * 外部CronやScheduled Workerからのキックに対応
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. D1データベースのバインディングチェック
  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: 'データベース設定が見つかりません。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. 認証チェック (CRON_SECRET)
  // 不正な第三者による無差別なAPI呼び出しを防ぐ
  const cronSecret = env.CRON_SECRET || 'test-cron-secret';
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(
      JSON.stringify({ error: '認証に失敗しました。正しいBearerトークンが必要です。' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const now = Date.now();

    // 3. 有効期限を過ぎたシークレットを一括物理削除
    const result = await env.DB.prepare(
      `DELETE FROM secrets WHERE expires_at < ?`
    )
      .bind(now)
      .run();

    const deletedCount = result.meta && typeof result.meta.changes === 'number'
      ? result.meta.changes
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: '期限切れシークレットのクリーンアップが完了しました。',
        deleted_count: deletedCount,
        timestamp: now,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    console.error('期限切れシークレット削除エラー:', err);
    return new Response(
      JSON.stringify({ error: 'クリーンアップ処理中にエラーが発生しました。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
