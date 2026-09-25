# SecureShare 本番デプロイ手順書

本ドキュメントでは、SecureShare を Cloudflare の無料枠（Pages, Workers, D1, Turnstile）を活用して本番公開する手順を解説します。

---

## 1. 前提条件

- Cloudflare アカウント（無料プランでOK）
- Node.js (v18以上推奨)
- GitHub アカウント

---

## 2. Cloudflare D1 データベースの準備

### 1. D1 データベースの作成
```bash
npx wrangler d1 create secureshare-db
```
出力された `database_id`（UUID）を控えます。

### 2. 設定ファイルの更新
`wrangler.toml` および `cron-worker/wrangler.toml` の `database_id` に取得したUUIDを設定します：
```toml
[[d1_databases]]
binding = "DB"
database_name = "secureshare-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3. テーブルの作成（スキーマ適用）
```bash
npx wrangler d1 execute secureshare-db --remote --file=./schema.sql
```

---

## 3. Cloudflare Turnstile（ボット防止）の設定

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) >「**Turnstile**」>「**サイトを追加**」をクリック。
2. 設定項目：
   - **サイト名**: `SecureShare`
   - **ドメイン**: `pages.dev`（および使用するカスタムドメイン、必要に応じて `localhost`）
   - **ウィジェットモード**: `マネージド`
3. 発行された **Site Key** と **Secret Key** を取得。
4. `public/index.html` の `data-sitekey` を本番の Site Key に設定。

---

## 4. Cloudflare Pages へのデプロイ

### 1. GitHub リポジトリの連携
1. Cloudflare ダッシュボード >「**Workers と Pages**」>「**作成**」>「**Pages**」>「**Git に接続**」を選択。
2. GitHubリポジトリを選択し、以下を設定：
   - **フレームワーク プリセット**: `None`
   - **ビルド出力ディレクトリ**: `public`
3. 「**保存してデプロイ**」をクリック。

### 2. D1 データベースと環境変数のバインド
デプロイ完了後、Pages プロジェクトの設定画面を開きます：
1. 「**設定**」>「**関数**」>「**D1 データベース バインディング**」:
   - 変数名: `DB`
   - 対象D1: `secureshare-db`
2. 「**設定**」>「**環境変数**」:
   - `TURNSTILE_SECRET_KEY`: 本番の Secret Key (タイプ: シークレット)
   - `CRON_SECRET`: 任意の安全なランダム文字列 (タイプ: シークレット)
3. 「**デプロイ**」タブより「**再デプロイ**」を実行して設定を反映させます。

---

## 5. 期限切れ定期削除 Scheduled Worker のデプロイ

閲覧されずに放置された期限切れシークレットを毎時自動クリーンアップするWorkerをデプロイします：

```bash
cd cron-worker
npx wrangler deploy
```

これで毎時0分に自動で期限切れデータが一括削除され、ストレージ容量を圧迫することなく完全0円で自動運用されます。
