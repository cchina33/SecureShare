# 本番移行完全マニュアル (Walkthrough): Cloudflare 本番デプロイ

## 1. 実施概要
SecureShare を Cloudflare の本番環境へデプロイし、一般公開するための完全手順書です。

---

## 2. デプロイ手順

### ステップ1: Cloudflare D1 データベース（本番）の作成
ターミナルで以下を実行し、Cloudflare上に本番データベースを作成します：
```bash
npx wrangler d1 create secureshare-db
```
コマンドの出力結果に表示される `database_id`（UUID）をコピーします。

#### 設定ファイルの更新
`wrangler.toml` および `cron-worker/wrangler.toml` の `database_id` を、上記で取得した本番UUIDに書き換えます：
```toml
[[d1_databases]]
binding = "DB"
database_name = "secureshare-db"
database_id = "<取得した本番UUID>"
```

#### 本番データベースへのテーブル作成
```bash
npx wrangler d1 execute secureshare-db --remote --file=./schema.sql
```

---

### ステップ2: Cloudflare Turnstile 本番用キーの取得
1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログインし、「**Turnstile**」メニューを開きます。
2. 「**サイトを追加**」をクリック：
   - サイト名: `SecureShare`
   - ドメイン: デプロイ予定のドメイン（例: `*.pages.dev` またはカスタムドメイン）
   - ウィジェットモード: `マネージド`（推奨）
3. 発行された **Site Key** と **Secret Key** を控えます。
4. `public/index.html` の `data-sitekey` を本番の Site Key に差し替えます。

---

### ステップ3: Cloudflare Pages 本番デプロイ (GitHub連携)
1. Cloudflare ダッシュボードの「**Workers と Pages**」>「**作成**」>「**Pages**」>「**Git に接続**」を選択。
2. リポジトリ `cchina33/SecureShare` を選択。
3. ビルド設定：
   - フレームワーク プリセット: `None`
   - ビルドコマンド: 空欄（なし）
   - ビルド出力ディレクトリ: `public`
4. 「**保存してデプロイ**」をクリック。

#### D1 データベース & 環境変数のバインド
デプロイ完了後、Pages プロジェクトの設定画面を開きます：
1. 「**設定**」>「**関数**」>「**D1 データベース バインディング**」:
   - 変数名: `DB`
   - D1 データベース: `secureshare-db` を選択
2. 「**設定**」>「**環境変数**」:
   - `TURNSTILE_SECRET_KEY`: 本番の Secret Key
   - `CRON_SECRET`: 任意のランダムな安全な文字列（例: `secret-cron-key-12345`）
3. 設定後、もう一度デプロイ（または「再デプロイ」）を実行してバインディングを反映。

---

### ステップ4: 定期削除 Scheduled Cron Worker のデプロイ
`cron-worker/` ディレクトリからデプロイします：
```bash
cd cron-worker
npx wrangler deploy
```
これで、毎時自動で期限切れレコードが安全にクリーンアップされます。
