# 実装完了確認 (Walkthrough): Phase 1 インフラ基盤とストレージ準備

## 完了した作業概要

暗号化画像共有機能の基盤となる「Phase 1: インフラ基盤とストレージ準備」をすべて完了しました。

---

### 1. Cloudflare R2 バケットの作成とライフサイクルルールの設定
- **バケット作成**: `secureshare-images` を作成しました。
- **ライフサイクルルール**: `auto-delete-7days`（作成から7日後に自動期限切れ/削除）を設定しました。
  ```
  name:     auto-delete-7days
  enabled:  Yes
  prefix:   (all prefixes)
  action:   Expire objects after 7 days
  ```
  これにより、閲覧放置された画像データが安全に自動削除されます。

---

### 2. Workers / Pages バインディングの構成
[wrangler.toml](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/wrangler.toml) に R2 バインディングを追加しました。

```toml
# Cloudflare R2 バケットバインディング (画像保存用)
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "secureshare-images"
```

---

### 3. D1 データベース設計とマイグレーション
[schema.sql](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/schema.sql) に画像メタデータ用テーブル `images` を追加し、ローカルおよびリモートの双方にマイグレーションを適用しました。

#### 追加されたテーブル定義
```sql
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,            -- UUIDv4
  iv TEXT NOT NULL,               -- Base64
  mime_type TEXT NOT NULL,        -- 例: image/png, image/jpeg
  file_size INTEGER NOT NULL,     -- バイト数
  created_at INTEGER NOT NULL,    -- 作成日時 (UNIXタイムスタンプ)
  expires_at INTEGER NOT NULL,    -- 有効期限 (UNIXタイムスタンプ)
  burn_after_read INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_images_expires_at ON images(expires_at);
```

#### 検証結果 (PRAGMA table_info)
- `id`: TEXT (PK)
- `iv`: TEXT (NOT NULL)
- `mime_type`: TEXT (NOT NULL)
- `file_size`: INTEGER (NOT NULL)
- `created_at`: INTEGER (NOT NULL)
- `expires_at`: INTEGER (NOT NULL)
- `burn_after_read`: INTEGER (DEFAULT 1)

リモートおよびローカルの D1 データベース `secureshare-db` に正常にスキーマが反映されていることを確認済みです。

---

## Phase 2: バックエンド API 実装完了確認

### 1. R2 ライフサイクルルールの更新
ユーザーが指定可能な最大期間（8日間）の直後に誤って消去されるのを防止するため、R2ライフサイクルルールを **9日（`auto-delete-9days`）** に更新しました。

```
name:     auto-delete-9days
enabled:  Yes
prefix:   (all prefixes)
action:   Expire objects after 9 days
```

---

### 2. エンドポイントの実装

#### ① POST `/api/image` (`functions/api/image/index.js`)
- **機能**: 暗号化画像バイナリとメタデータの登録
- **特徴**:
  - `multipart/form-data` 受信により、Base64化による容量肥大化（約33%増）を回避し、メモリ消費を最適化
  - Turnstile ボット防止認証に対応
  - 最大ファイルサイズ制限（10MB）
  - 最短 1時間 (3600秒) 〜 **最長 8日間 (691200秒)** の有効期限チェック
  - 暗号化バイナリを R2 バケット (`MY_BUCKET`) に保管し、メタデータを D1 (`DB`) の `images` テーブルに保存

#### ② GET `/api/image/:id` (`functions/api/image/[id].js`)
- **機能**: 暗号化画像バイナリの取得とワンタイム物理削除
- **特徴**:
  - D1 からメタデータを取得し、有効期限切れの場合は即座に D1 / R2 から削除して 404 を返却
  - `burn_after_read === 1`（ワンタイム閲覧モード）の場合、レスポンス返却と同時に D1 レコードおよび R2 オブジェクトを**即座に完全物理削除**
  - クライアントが復号に必要なメタデータ（`X-Iv`, `X-Mime-Type`, `X-File-Size`, `X-Burn-After-Read`, `X-Expires-At`）をレスポンスヘッダーで返却
  - `Access-Control-Expose-Headers` を付与し、フロントエンドの fetch API からカスタムヘッダーを読み取り可能に設定

---

## Phase 3: フロントエンド実装完了確認

### 1. 暗号化モジュール (`public/assets/js/crypto.js`)
- Web Crypto API（AES-256-GCM）を使用したバイナリ暗号化・復号関数を追加しました。
  - `SecureCrypto.encryptBinary(arrayBuffer, key)`: 画像バイナリを直接暗号化し、暗号化バイナリと Base64 の IV を返却
  - `SecureCrypto.decryptBinary(encryptedBuffer, ivBase64, key)`: 暗号化バイナリを復号し、元の平文 `ArrayBuffer` を返却

---

### 2. 作成画面 UI & 有効期限8日制限 (`index.html`, `app.js`, `style.css`)
- **「画像」タブの追加**: タブ切り替えによりドラッグ＆ドロップ対応の画像アップローダーが表示されます。
- **有効期限ポリシー（最大8日）の動的反映**:
  - 「画像」タブ選択時、有効期限セレクトボックスが自動的に **「1時間 / 24時間 / 3日 / 7日 / 8日（最長） / カスタム（最大8日）」** に切り替わります。
  - 「パスワード」「秘密メモ」タブ選択時は通常の選択肢（最大30日）に自動復帰します。
- **ゼロナレッジ暗号化アップロード**:
  - クライアント側で 256bit 暗号鍵を生成して画像を暗号化。
  - `POST /api/image` に `multipart/form-data` 送信。
  - 復号鍵（ハッシュ `#`）を含む URL を生成・表示。

---

### 3. 閲覧画面 UI (`view.html`, `view.js`)
- URL パラメータ `type=image` を検知し、画像専用の確認画面を表示。
- 「画像を表示する」ボタン押下時に暗号化バイナリを受信・Web Crypto で復号。
- 復号された画像プレビューの表示、および「画像を保存（ダウンロード）」「別タブで拡大」ボタンを提供。
- ワンタイム閲覧モード時はサーバーから即時破棄され、アドレスバーのハッシュ（鍵）も自動除去されます。

---

### 4. ブラウザ自動検証結果
ブラウザサブエージェントにより以下の実機テストを実施・合格しました：
1. `http://localhost:8788` への接続・表示: **合格**
2. 「画像」タブ切り替えとアップローダー（ドラッグ＆ドロップ領域、10MB上限ラベル）の表示: **合格**
3. 有効期限セレクタの動的切り替え（画像選択時に最大8日間制限が適用されること）: **合格**
4. 「パスワード」タブ復帰時に通常の有効期限（最大30日間）へ復帰すること: **合格**


