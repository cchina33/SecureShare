# 実装確認手順書 (Walkthrough): 期限切れシークレットの一括自動削除 (SecureShare)

## 1. 実施概要
期限切れシークレットをD1データベースから定期的に一括物理削除するためのAPIエンドポイントおよびScheduled Workerの設定手順です。

## 2. 成果物一覧
- `functions/api/cron/cleanup.js`: 認証付きクリーンアップAPI
- `cron-worker/src/index.js`: Cloudflare Scheduled Worker
- `cron-worker/wrangler.toml`: Scheduled Worker用設定（Cron Trigger & D1バインディング）
- `.dev.vars.example`: `CRON_SECRET` 定義追加

## 3. 動作確認・テスト手順

### (1) クリーンアップAPIの手動テスト
1. ローカル開発サーバーを起動:
   ```bash
   npm run dev
   ```
2. curlまたはPostman等でエンドポイントを呼び出し:
   ```bash
   curl -X POST http://localhost:8788/api/cron/cleanup \
     -H "Authorization: Bearer test-cron-secret"
   ```
3. 成功レスポンス:
   ```json
   {
     "success": true,
     "message": "期限切れシークレットのクリーンアップが完了しました。",
     "deleted_count": 0,
     "timestamp": 1727236800000
   }
   ```

### (2) Scheduled Workerのデプロイ・スケジュール実行
1. `cron-worker/` ディレクトリでデプロイ:
   ```bash
   cd cron-worker
   npx wrangler deploy
   ```
2. 指定したCronスケジュール（例: `0 0 * * *` 毎日0時）で自動実行され、D1の期限切れレコードが安全に削除されます。
