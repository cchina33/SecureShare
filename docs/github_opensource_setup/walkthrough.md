# 実装確認手順書 (Walkthrough): GitHub オープンソース公開手順 (SecureShare)

## 1. 実施概要
GitHubへのリポジトリ作成からプッシュ、Cloudflare Pagesとの連携までの手順を記載します。

## 2. 成果物一覧
- `.gitignore`: Git除外ファイル設定
- `LICENSE`: MIT License
- `README.md`: オープンソース向け詳細ドキュメント
- `public/index.html`, `public/view.html`: ヘッダーへのGitHubリンク追加

## 3. GitHubへのプッシュ手順（初回公開手順）
1. **GitHubで新しいリポジトリを作成**:
   - リポジトリ名: `secureshare`
   - Public（公開）を選択
2. **ローカルリポジトリの初期化とコミット**:
   ```bash
   git init
   git add .
   git commit -m "feat: 初期リリース (SecureShare - ゼロナレッジ暗号化共有)"
   ```
3. **リモートリポジトリへのプッシュ**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR_USER_NAME>/secureshare.git
   git push -u origin main
   ```
4. **Cloudflare Pages との連携**:
   - Cloudflare ダッシュボード >「Workers & Pages」>「Create application」>「Pages」>「Connect to Git」を選択。
   - `secureshare` リポジトリを選択し、Build output directory に `public` を指定して連携。
