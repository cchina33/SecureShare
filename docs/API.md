# SecureShare API 仕様書

SecureShare のバックエンド API（Cloudflare Pages Functions）のリファレンスです。
ゼロナレッジ・エンドツーエンド暗号化（Zero-Knowledge E2EE）によるテキストシークレット共有および暗号化画像共有に対応しています。

---

## 1. テキストシークレット作成 API

暗号化されたテキストデータを受け取り、Cloudflare D1 データベースに格納して一意なIDを発行します。

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
| `iv` | string | 暗号化に使用したIV (Base64)。 |
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

## 2. テキストシークレット取得 API

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

## 3. 暗号化画像アップロード API

暗号化された画像バイナリを Cloudflare R2 に保管し、メタデータを D1 データベースに登録します。

- **エンドポイント**: `POST /api/image`
- **Content-Type**: `multipart/form-data`

### リクエストパラメータ (FormData)
| フィールド | 型 | 説明 |
|---|---|---|
| `file` | File / Blob | クライアント側で暗号化された画像バイナリ (`application/octet-stream`)。最大 10MB。 |
| `iv` | string | AES-GCM 初期化ベクトル (Base64)。必須。 |
| `mime_type` | string | 元画像のMIMEタイプ（例: `image/png`, `image/jpeg`, `image/webp`, `image/gif`）。必須。 |
| `ttl_seconds` | string / number | 有効期限（秒）。最短 3,600秒 (1時間) 〜 **最長 691,200秒 (8日間)**。デフォルト 86,400秒。 |
| `burn_after_read` | string / number | `1` = 閲覧後に即時削除（ワンタイム）、`0` = 有効期限まで保持。デフォルト `1`。 |
| `turnstile_token` | string | Cloudflare Turnstile ボット防止認証トークン。 |

### レスポンス
- **201 Created**:
  ```json
  {
    "id": "e9c2b4d8-1234-4567-89ab-cdef01234567",
    "expires_at": 1727409600000,
    "burn_after_read": 1,
    "file_size": 204850
  }
  ```
- **400 Bad Request**: ファイルまたはメタデータの欠落、不正なMIMEタイプ
- **403 Forbidden**: Turnstile認証の検証失敗
- **413 Payload Too Large**: ファイルサイズが 10MB を超過

---

## 4. 暗号化画像取得 & ワンタイム削除 API

IDを指定して暗号化画像バイナリを取得します。ワンタイム設定の場合、取得と同時に D1 レコードおよび R2 オブジェクトの双方が**即座に完全物理削除**されます。

- **エンドポイント**: `GET /api/image/:id`
- **URLパラメータ**: `id` (画像のUUID)

### レスポンス
- **200 OK**:
  - **Body**: 暗号化画像バイナリ (`application/octet-stream`)
  - **Headers**:
    - `X-Iv`: Base64形式の初期化ベクトル
    - `X-Mime-Type`: 画像のMIMEタイプ（例: `image/png`）
    - `X-File-Size`: ファイルサイズ（バイト数）
    - `X-Burn-After-Read`: `1` または `0`
    - `X-Expires-At`: 有効期限タイムスタンプ
    - `Access-Control-Expose-Headers`: 上記カスタムヘッダーの読み取り許可
    - `Cache-Control`: `no-store, no-cache, must-revalidate`
- **404 Not Found**:
  ```json
  {
    "error": "画像が見つかりません。既に閲覧されたか、存在しない可能性があります。"
  }
  ```

---

## 5. 期限切れデータ自動削除 API (内部用)

有効期限を過ぎたデータを一括物理削除します。定期実行ワーカー（Cron Worker）から呼び出されます。

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
- **401 Unauthorized**: 認証トークンが無効
