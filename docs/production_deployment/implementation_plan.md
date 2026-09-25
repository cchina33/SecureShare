# 実装計画書: Cloudflare 本番環境移行 (SecureShare)

## 1. 概要
「SecureShare」を Cloudflare のグローバルエッジインフラ上に完全無料枠（0円）で本番デプロイし、一般公開するための設計書です。

## 2. 本番インフラ構成

| コンポーネント | サービス | 本番設定内容 |
|---|---|---|
| 静的フロントエンド | Cloudflare Pages | `public/` ディレクトリ（ビルド不要） |
| API / ロジック層 | Cloudflare Pages Functions | `functions/api/` 自動マウント |
| データベース | Cloudflare D1 | データベース名: `secureshare-db`、バインディング名: `DB` |
| 定期クリーンアップ | Cloudflare Scheduled Workers | `cron-worker`（毎時実行） |
| ボット防止 | Cloudflare Turnstile | マネージドモード（本番Sitekey / Secretkey） |

## 3. 本番設定・環境変数設計

### (1) Pages Functions 側の設定
- **D1 データベースバインディング**:
  - 変数名: `DB`
  - 対象D1: `secureshare-db`
- **環境変数**:
  - `TURNSTILE_SECRET_KEY`: 本番Turnstileシークレットキー
  - `CRON_SECRET`: 期限切れ削除API保護キー（ランダム文字列）

### (2) `cron-worker` 側の設定
- `cron-worker/wrangler.toml` に本番の `database_id` を設定。
