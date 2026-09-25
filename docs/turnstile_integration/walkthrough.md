# 実装確認手順書 (Walkthrough): Cloudflare Turnstile 連携 (SecureShare)

## 1. 実施概要
Cloudflare Turnstile による人間認証機能の統合と、ローカルテストおよび本番キーの設定手順を記載します。

## 2. 成果物一覧
- `public/index.html`: Turnstileスクリプト読み込みおよびウィジェットコンテナ
- `public/assets/js/app.js`: Turnstileトークン取得・送信・リセット処理
- `functions/api/secret/index.js`: `siteverify` API を通じたトークン検証処理
- `.dev.vars.example`: ローカル環境変数設定テンプレート

## 3. 動作確認手順
1. **ローカル環境の確認**:
   ブラウザで `index.html` を開くと、フォーム内に Cloudflare Turnstile のダークテーマウィジェットが表示されます。
2. **トークン検証の確認**:
   - チェックが入るとトークンが自動発行されます。
   - 発行ボタンをクリックすると、暗号化ペイロードと共に `turnstile_token` が送信され、バックエンドで検証されます。
   - トークンなし、または無効なトークンの場合、APIは `403 Forbidden` を返して保存を拒否します。
3. **本番環境への移行手順**:
   1. Cloudflare ダッシュボードの「Turnstile」メニューからサイトを追加。
   2. 発行された `Site Key` を `index.html` の `data-sitekey` に設定。
   3. 発行された `Secret Key` を Cloudflare Pages の「設定」->「環境変数」に `TURNSTILE_SECRET_KEY` として追加。
