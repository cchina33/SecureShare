# 実装計画書: バックエンド基盤・Cloudflare D1連携 (SecureShare)

## 1. 概要
本ドキュメントは、「SecureShare」のサーバーサイドAPI（Cloudflare Pages Functions）および Cloudflare D1 データベース基盤の実装詳細を定義します。

## 2. API 仕様設計

### (1) `POST /api/secret`
- **目的**: クライアントで暗号化されたシークレットデータを受け取り、有効期限を計算して D1 に格納する。
- **リクエストボディ (JSON)**:
  ```json
  {
    "ciphertext": "Base64文字列",
    "iv": "Base64文字列",
    "content_type": "password または note",
    "ttl_seconds": 86400
  }
  ```
- **バリデーション**:
  - `ciphertext` / `iv` の必須チェック、サイズ制限（64KB以内）。
  - `ttl_seconds`（1時間〜最長7日間: 3600〜604800秒）。
- **レスポンス (JSON)**:
  - 成功 (201 Created):
    ```json
    { "id": "UUIDv4文字列" }
    ```
  - エラー (400 Bad Request / 500 Internal Error)

### (2) `GET /api/secret/:id`
- **目的**: 暗号文を取得し、**直ちに D1 から物理削除**する（ワンタイム破棄）。
- **URLパラメータ**: `id`（UUIDv4文字列）
- **処理フロー**:
  1. `id` をキーに D1 からレコードを取得。
  2. レコードが存在しない、または `expires_at < 現在時刻` の場合:
     - 期限切れレコードが存在すれば削除。
     - `404 Not Found` を返却。
  3. レコードが存在する場合:
     - **即座に `DELETE FROM secrets WHERE id = ?` を実行**。
     - `200 OK` とともに暗号文・IVを返却。
- **レスポンス (JSON)**:
  - 成功 (200 OK):
    ```json
    {
      "ciphertext": "Base64文字列",
      "iv": "Base64文字列",
      "content_type": "password"
    }
    ```
  - エラー (404 Not Found):
    ```json
    { "error": "シークレットが見つからないか、有効期限切れです。" }
    ```

## 3. D1 データベース設計 (`schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_secrets_expires_at ON secrets(expires_at);
```
