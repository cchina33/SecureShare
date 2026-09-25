/**
 * SecureShare - 期限切れシークレット定期削除 Scheduled Worker
 * Cloudflare Workers Cron Triggers により自動実行されます
 */

export default {
  // Cronスケジュールによりトリガーされるハンドラ
  async scheduled(event, env, ctx) {
    if (!env.DB) {
      console.error('D1データベース (DB) がバインドされていません。');
      return;
    }

    try {
      const now = Date.now();
      console.log(`[Cron Cleanup] 期限切れシークレットの削除を開始します: ${new Date(now).toISOString()}`);

      // 有効期限切れレコードを一括物理削除
      const result = await env.DB.prepare(
        `DELETE FROM secrets WHERE expires_at < ?`
      )
        .bind(now)
        .run();

      const deletedCount = result.meta && typeof result.meta.changes === 'number'
        ? result.meta.changes
        : 0;

      console.log(`[Cron Cleanup] 完了: ${deletedCount} 件の期限切れシークレットを削除しました。`);
    } catch (err) {
      console.error('[Cron Cleanup] エラーが発生しました:', err);
    }
  },

  // HTTPリクエストによる手動トリガーにも対応
  async fetch(request, env, ctx) {
    return new Response('SecureShare Cron Worker is active.', { status: 200 });
  },
};
