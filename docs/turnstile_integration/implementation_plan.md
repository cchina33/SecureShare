# 実装計画書: Cloudflare Turnstile 連携 (SecureShare)

## 1. 概要
ボットによる無差別な登録スクリプトやDoS攻撃を防止するため、Cloudflare Turnstile をフロントエンドおよびバックエンドAPIに統合します。

## 2. アーキテクチャと認証フロー

```
[クライアント (ブラウザ)]                  [Cloudflare Workers API]               [Cloudflare Turnstile サーバー]
       │                                            │                                      │
       │ 1. Turnstileウィジェット認証               │                                      │
       │ ─── (ユーザー操作/自動検証) ───>           │                                      │
       │ <─── トークン発行 ─────────────            │                                      │
       │                                            │                                      │
       │ 2. 暗号文 + トークン送信                   │                                      │
       │ ─── POST /api/secret ────────────────────> │                                      │
       │                                            │ 3. トークン検証リクエスト           │
       │                                            │ ─── POST /siteverify ──────────────> │
       │                                            │ <── { "success": true } ──────────── │
       │                                            │                                      │
       │                                            │ 4. D1へ保存 & ID生成                 │
       │ <── 201 Created (ID) ───────────────────── │                                      │
```

## 3. テスト用キーと本番用キー

Cloudflare が提供する公式テストキーを使用することで、ローカル開発およびテスト環境でCloudflareダッシュボードのアカウント設定を行わずに即座に動作確認が可能です。

- **テスト用 Sitekey (Always passes)**:
  `1x00000000000000000000AA`
- **テスト用 Secret key (Always passes)**:
  `1x0000000000000000000000000000000AA`

本番環境では、Cloudflareダッシュボードから発行したSitekeyおよびSecretkey（環境変数 `TURNSTILE_SECRET_KEY`）を使用します。

## 4. 各コンポーネントの実装

### (1) フロントエンド (`index.html`, `app.js`)
- `https://challenges.cloudflare.com/turnstile/v0/api.js` を `async defer` で読み込み。
- フォーム内に `<div class="cf-turnstile" data-sitekey="..." data-theme="dark"></div>` を配置。
- 送信時に `formData.get('cf-turnstile-response')` または `turnstile.getResponse()` を取得。
- トークンが存在しない場合は送信をブロック。
- 送信後やリセット時に `turnstile.reset()` を呼び出し。

### (2) バックエンド (`functions/api/secret/index.js`)
- 受信した `turnstile_token` と、クライアントIP（`request.headers.get('cf-connecting-ip')`）を取得。
- `fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', ...)` でCloudflareに問い合わせ。
- `outcome.success` が `false` の場合は HTTP 403 Forbidden を返却して即座に終了。
