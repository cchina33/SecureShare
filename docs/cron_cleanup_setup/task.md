# 実装タスクリスト: 期限切れシークレットの一括自動削除 (SecureShare)

## 進行状況
- [x] クリーンアップ仕様およびCron定期実行構成の合意
- [x] ドキュメント群の配置 (`docs/cron_cleanup_setup/`)
    - [x] `task.md`
    - [x] `implementation_plan.md`
    - [x] `walkthrough.md`
- [x] クリーンアップAPI実装 (`functions/api/cron/cleanup.js`)
- [x] Cloudflare Scheduled Worker実装 (`cron-worker/src/index.js`, `cron-worker/wrangler.toml`)
- [x] 環境変数テンプレート更新 (`.dev.vars.example`)
- [x] 動作確認・ドキュメント更新
