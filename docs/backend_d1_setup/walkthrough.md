# 実装確認手順書 (Walkthrough): バックエンド基盤・D1連携 (SecureShare)

## 1. 実施概要
Cloudflare Pages Functions および D1 データベースを用いたバックエンドAPIを実装しました。

## 2. 成果物一覧
- `package.json`: 開発スクリプト（Wrangler）
- `wrangler.toml`: Cloudflare Pages & D1 バインディング設定
- `schema.sql`: D1 テーブル作成スキーマ
- `functions/api/secret/index.js`: POST /api/secret エンドポイント
- `functions/api/secret/[id].js`: GET /api/secret/:id エンドポイント（取得時即座削除）

## 3. ローカル開発環境での実行手順
1. **依存パッケージのインストール**:
   ```bash
   npm install
   ```
2. **ローカルD1データベースの初期化**:
   ```bash
   npx wrangler d1 execute secureshare-db --local --file=./schema.sql
   ```
3. **ローカル開発サーバーの起動**:
   ```bash
   npm run dev
   # または npx wrangler pages dev public --d1 DB=secureshare-db
   ```
4. **動作テスト**:
   - `http://localhost:8788/` で作成画面を開き、シークレットを発行。
   - 生成されたURLにアクセスし、復号表示できることを確認。
   - 画面を再読み込みし、D1から物理削除されて404になることを確認。
