# 実装計画: 暗号化画像共有機能 (Phase 1)

## 概要
SecureShare にゼロナレッジ暗号化（クライアント側 AES-GCM 暗号化）による画像共有機能を追加します。
本フェーズ（Phase 1）では、画像の暗号化バイナリを保管する Cloudflare R2 バケットの準備、Cloudflare Pages/Workers バインディング設定、および画像メタデータを保管する Cloudflare D1 データベースのテーブル設計とマイグレーションを実施します。

---

## 構成と要件

### 1. Cloudflare R2 バケット
- **バケット名**: `secureshare-images`
- **ライフサイクルルール**: 作成から7日（7 days）後に自動削除
  - 目的: 閲覧放置された暗号化画像データがストレージに残り続けるのを防ぎ、安全性を担保する。

### 2. Workers / Pages バインディング
- `wrangler.toml` に R2 バケットをバインド:
  - バインディング名: `MY_BUCKET`
  - バケット名: `secureshare-images`

### 3. D1 データベース設計
- テーブル名: `images`
- カラム構成:
  - `id` (TEXT, PRIMARY KEY): 画像を一意に識別する UUIDv4
  - `iv` (TEXT, NOT NULL): AES-GCM の初期化ベクトル (Base64 エンコード)
  - `mime_type` (TEXT, NOT NULL): 画像の MIME タイプ (例: `image/png`, `image/jpeg`, `image/webp`)
  - `file_size` (INTEGER, NOT NULL): 暗号化前または暗号化後のファイルサイズ (バイト数)
  - `created_at` (INTEGER, NOT NULL): 作成日時の UNIX タイムスタンプ
  - `expires_at` (INTEGER, NOT NULL): 有効期限の UNIX タイムスタンプ
- インデックス:
  - `idx_images_expires_at`: 有効期限切れクエリや定期削除クリーンアップ用のインデックス

---

## 検証計画 (Phase 1)
1. `npx wrangler r2 bucket list` で `secureshare-images` バケットが存在することを確認
2. `wrangler.toml` の構文チェック
3. ローカル D1 データベースに対してマイグレーションを実行し、正常に `images` テーブルが作成されたことを確認

---

## Phase 2: バックエンド API 実装計画

### 1. R2 ライフサイクルルールの更新
- ユーザー選択可能期間（最大8日）に対応し、R2ライフサイクルルールを `auto-delete-9days`（9日後に自動削除）に変更。

### 2. エンドポイント設計

#### ① POST `/api/image` (画像暗号化バイナリの保存)
- **形式**: `multipart/form-data`
- **リクエストパラメータ**:
  - `file`: 暗号化された画像バイナリ (Blob / File)
  - `iv`: AES-GCM 初期化ベクトル (Base64 文字列)
  - `mime_type`: 画像の MIME タイプ (例: `image/png`, `image/jpeg`, `image/webp`, `image/gif`)
  - `ttl_seconds`: 有効秒数 (最短 3600秒 (1時間) 〜 最長 691200秒 (8日間))
  - `burn_after_read`: `1` (ワンタイム即時削除) または `0` (有効期限まで保持)
  - `turnstile_token`: Cloudflare Turnstile トークン
- **処理フロー**:
  1. Turnstile 認証の検証 (シークレットキー存在時)
  2. 入力バリデーション:
     - `file`, `iv`, `mime_type` の存在チェック
     - ファイルサイズ制限 (最大 10MB)
     - `mime_type` が `image/*` であることの確認
     - `ttl_seconds` が 3600 〜 691200 の範囲内であることの確認
  3. UUIDv4 の `id` を生成
  4. R2 (`MY_BUCKET`) にバイナリを `put(id, fileBuffer)`
  5. D1 (`DB`) の `images` テーブルにメタデータを INSERT
  6. レスポンス: `{ id, expires_at, burn_after_read }`

#### ② GET `/api/image/:id` (画像暗号化バイナリの取得 & ワンタイム削除)
- **処理フロー**:
  1. D1 `images` テーブルから `id` でメタデータを取得 (存在しない場合は 404)
  2. 有効期限判定: `expires_at < Date.now()` の場合、D1 と R2 から削除して 404
  3. R2 (`MY_BUCKET`) から該当 `id` の暗号化バイナリを取得 (取得不能時は 404)
  4. 消去モード判定:
     - `burn_after_read === 1` の場合、即座に D1 レコードおよび R2 オブジェクトを完全物理削除
  5. 暗号化バイナリを返却:
     - Content-Type: `application/octet-stream`
     - ヘッダー:
       - `X-Iv`: Base64 の IV
       - `X-Mime-Type`: 画像の MIME タイプ
       - `X-Burn-After-Read`: `1` または `0`
       - `X-Expires-At`: 有効期限
       - `Cache-Control`: `no-store, no-cache, must-revalidate`

---

## Phase 3: フロントエンド実装計画（暗号化・復号 & UI）

### 1. 暗号化コア (`crypto.js`)
- `encryptBinary(arrayBuffer, key)`: Web Crypto API (AES-256-GCM) で `ArrayBuffer` を直接暗号化。暗号化された `ArrayBuffer` と Base64 形式の `iv` を返却。
- `decryptBinary(encryptedBuffer, ivBase64, key)`: Base64 の `iv` と `CryptoKey` を用いて、暗号化バイナリを平文 `ArrayBuffer` に復号。

### 2. アップロード UI (`index.html`, `app.js`, `style.css`)
- タブに「画像」タブを追加。
- ドラッグ＆ドロップ対応の画像アップローダー（プレビュー、ファイル名・サイズ表示、削除ボタン）。
- 画像選択時は、有効期限の選択肢を **「1時間 / 24時間 / 3日 / 7日 / 8日（最長）」** に動的に切り替え、カスタム日数も「1〜8日間」に制限（最大一週間/8日ポリシーの遵守）。
- 送信時にクライアント側で画像を暗号化し、`POST /api/image` に `FormData` で送信。
- 復号鍵（ハッシュ `#`）を含む URL を生成・表示。

### 3. 閲覧・復号 UI (`view.html`, `view.js`)
- URL パラメータ `type=image` を検知。
- ワンタイム閲覧または期限保持モードに応じた確認画面を表示。
- 「画像を表示する」ボタン押下時に `GET /api/image/:id` を取得し、Web Crypto で復号。
- Blob URL を生成して画像を表示。
- ダウンロードボタンおよび新しいタブで全画面表示するボタンを提供。
- ワンタイムモード時は復号後に URL ハッシュを除去し、サーバー上から即座に破棄された旨を表示。


