# 実装計画書: 期限切れシークレットの一括自動削除 (SecureShare)

## 1. 概要
ワンタイムメモやパスワードが受信者によって開かれずに放置された場合でも、最長有効期限（7日間）を過ぎたデータがD1データベースに残り続けるのを防ぐため、期限切れデータを定期的に一括物理消去する仕組みを構築します。

## 2. アーキテクチャと実行方式

SecureShareでは、以下の2つの方式をサポートし、柔軟かつ確実な自動クリーンアップを実現します。

### 方式1: クリーンアップAPI (`POST /api/cron/cleanup`)
- Pages Functions 内のエンドポイント。
- 外部のCronサービス（Cloudflare Workers Cron、GitHub Actions、cron-job.orgなど）から定期的にHTTPリクエストを送信して実行。
- **セキュリティ**:
  - `CRON_SECRET` を環境変数に設定し、`Authorization: Bearer <CRON_SECRET>` ヘッダーによる認証を強制。
  - 不正な外部リクエストを遮断。

### 方式2: Cloudflare Scheduled Worker (`cron-worker/`)
- Cloudflare Workers の標準 Cron Trigger（無料枠で実行可能）を利用。
- 定期スケジュール（例: 毎日午前0時 `0 0 * * *` または毎時 `0 * * * *`）で `scheduled` イベントが起動。
- D1 データベース（`secureshare-db`）に直接クエリを実行して一括削除。

## 3. クリーンアップSQLクエリ
```sql
DELETE FROM secrets WHERE expires_at < ?;
```
- パラメータ: 実行時のUNIXミリ秒（`Date.now()`）。
- 既にインデックス `idx_secrets_expires_at` を設定しているため、大量レコードが存在する場合でも高速に実行可能です。
