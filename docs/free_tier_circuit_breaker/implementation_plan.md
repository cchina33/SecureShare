# 実装計画: Cloudflare D1 / R2 無料枠サーキットブレーカー

## 1. 概要
Cloudflare D1（データベース）およびR2（オブジェクトストレージ）の無料枠（Free Tier）の上限超過による予期せぬ課金を防止するため、使用量が安全閾値に達した際に自動的にAPIへの新規アクセスを一時遮断（503 Maintenance）し、リセット日時に自動で通常稼働へ復帰するサーキットブレーカー機構を実装します。

## 2. 無料枠と監視閾値の定義

| サービス | リソース | 無料枠上限 | 安全閾値 (例: 85%〜90%) | リセット周期 |
| :--- | :--- | :--- | :--- | :--- |
| **D1** | 読み取り行数 (Rows Read) | 5,000,000 行 / 日 | 4,250,000 行 (85%) | 毎日 00:00 UTC (09:00 JST) |
| | 書き込み行数 (Rows Written) | 100,000 行 / 日 | 85,000 行 (85%) | 毎日 00:00 UTC (09:00 JST) |
| **R2** | Class A 操作 (Upload/List等) | 1,000,000 回 / 月 | 850,000 回 (85%) | 毎月1日 00:00 UTC |
| | Class B 操作 (Download等) | 10,000,000 回 / 月 | 8,500,000 回 (85%) | 毎月1日 00:00 UTC |
| | 保存容量 | 10 GB | 8.5 GB (85%) | 随時（削除されるまで） |

## 3. 実装詳細

### A. 状態管理テーブル (`system_status`)
D1内に以下のテーブルを追加し、システム稼働状態とリセット予定時刻を管理します。
```sql
CREATE TABLE IF NOT EXISTS system_status (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```
- `maintenance_mode`: `"0"` (正常稼働) または `"1"` (一時停止中)
- `maintenance_reason`: 停止理由（例: `"D1_DAILY_LIMIT"`, `"R2_MONTHLY_LIMIT"`）
- `maintenance_reset_at`: リセット見込み日時（ミリ秒タイムスタンプ）

### B. Pages Functions ミドルウェア (`functions/_middleware.js`)
すべての `/api/*` リクエストの手前でインターセプトします。
1. D1アクセス回数を節約するため、インメモリキャッシュ（TTL: 60秒）で状態を保持。
2. メンテナンス中の場合:
   - レスポンス: HTTP 503 Service Unavailable
   - JSON Body:
     ```json
     {
       "error": "service_unavailable",
       "message": "無料利用枠の上限に達したため一時停止中です。リセット時刻に自動再開します。",
       "maintenance": true,
       "reason": "D1_DAILY_LIMIT",
       "reset_at": 1727481600000
     }
     ```
   - D1/R2への実際のクエリ・操作は一切呼び出さない。

### C. 定期監視 (`cron-worker/src/index.js`)
既存の期限切れシークレット削除タスクに加え、以下の処理を実行します。
1. Cloudflare GraphQL Analytics API を呼び出し、アカウント全体の本日（D1）および今月（R2）のメトリクスを取得。
2. 閾値チェック:
   - いずれかの閾値を超えている場合 → `system_status` をメンテナンスモードに更新。
   - 閾値未満（リセット後、または通常時）かつ現在メンテナンス中の場合 → メンテナンスモードを解除。
3. Cloudflare API呼び出しに必要なシークレット環境変数:
   - `CF_ACCOUNT_ID`: Cloudflare アカウントID
   - `CF_API_TOKEN`: Analytics Read 権限を持つ Cloudflare API トークン

### D. フロントエンド UI (`public/assets/js/app.js` / `view.js`)
APIから 503 レスポンスを受け取った際、分かりやすいモーダルやバナーでメンテナンス中と再開予定時刻を表示します。

## 4. 検証手順
1. D1に `system_status` テーブルが正しく追加されることの確認。
2. メンテナンスフラグを手動でONにした際、`/api/secret` 等へのアクセスが503で遮断され、D1書き込み・R2アップロードが発生しないことを確認。
3. メンテナンスフラグをOFFにした際、正常にシークレット作成・閲覧ができることを確認。
