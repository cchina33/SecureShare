# SecureShare API 仕様書

SecureShare のバックエンド API（Cloudflare Pages Functions）のリファレンスです。

---

## 1. シークレット作成 API

暗号化されたシークレットデータを受け取り、Cloudflare D1 データベースに格納して一意なIDを発行します。

- **エンドポイント**: `POST /api/secret`
- **Content-Type**: `application/json`

### リクエストボディ
```json
{
  "ciphertext": "Base64形式の暗号文 (必須, 最大64KB)",
  "iv": "Base64形式の初期化ベクトル (必須, 12バイト相当)",
  "content_type": "password または note (必須)",
  "ttl_seconds": 86400,
  "turnstile_token": "Cloudflare Turnstile認証トークン (必須)",
  "burn_after_read": 1
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `ciphertext` | string | 暗号化されたデータ本文。 |
| `iv` | string | 暗号化に使用したIV。 |
| `content_type` | string | `'password'`（1行）または `'note'`（複数行）。 |
| `ttl_seconds` | number | 有効期限（秒）。最短 3,600秒 (1時間) 〜 最長 2,592,000秒 (30日)。デフォルト 86,400秒。 |
| `turnstile_token` | string | フロントエンドで取得したTurnstile検証トークン。 |
| `burn_after_read` | number | `1` = 閲覧後に即時削除（ワンタイム）、`0` = 有効期限まで保持。デフォルト `1`。 |

### レスポンス
- **201 Created**:
  ```json
  {
    "id": "7f09f086-5d75-4d04-9843-6c7cbbd1d2b8",
    "expires_at": 1727323200000,
    "burn_after_read": 1
  }
  ```
- **400 Bad Request**: 必須パラメータ欠落、バリデーションエラー
- **403 Forbidden**: Turnstile（ボット防止認証）の検証失敗
- **413 Payload Too Large**: 暗号文が 64KB を超過

---

## 2. シークレット取得 API

IDを指定して暗号文を取得します。ワンタイム設定の場合、取得と同時にサーバー上から該当データが完全物理削除されます。

- **エンドポイント**: `GET /api/secret/:id`
- **URLパラメータ**: `id` (シークレットのUUID)

### レスポンス
- **200 OK**:
  ```json
  {
    "ciphertext": "Base64形式の暗号文",
    "iv": "Base64形式の初期化ベクトル",
    "content_type": "password",
    "burn_after_read": 1,
    "expires_at": 1727323200000
  }
  ```
  ※ `Cache-Control: no-store` ヘッダーが付与され、ブラウザや中間キャッシュへの保存が禁止されます。
- **404 Not Found**:
  ```json
  {
    "error": "シークレットが見つかりません。既に閲覧されたか、存在しない可能性があります。"
  }
  ```

---

## 3. 期限切れデータ自動削除 API

有効期限を過ぎたデータをD1データベースから一括物理削除します。外部CronやScheduled Workerから実行されます。

- **エンドポイント**: `POST /api/cron/cleanup`
- **ヘッダー**: `Authorization: Bearer <CRON_SECRET>`

### レスポンス
- **200 OK**:
  ```json
  {
    "success": true,
    "message": "期限切れシークレットのクリーンアップが完了しました。",
    "deleted_count": 3,
    "timestamp": 1727236800000
  }
  ```
- **401 Unauthorized**: Bearerトークンが無効または未指定
