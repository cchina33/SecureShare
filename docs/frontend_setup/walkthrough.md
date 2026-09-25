# 実装確認手順書 (Walkthrough): フロントエンド基盤 (SecureShare)

## 1. 実施概要
セキュアワンタイムメモ・パスワード共有サービス「SecureShare」のフロントエンド基盤（HTML/CSS/JS）およびゼロナレッジ暗号化モジュールを実装しました。

## 2. 作成された成果物一覧
- [index.html](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/public/index.html): 送信者用シークレット作成画面（タブ切り替え、有効期限指定、URL生成）
- [view.html](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/public/view.html): 受信者用閲覧・復号画面（破棄警告、ワンクリックコピー、消去済みエラー）
- [style.css](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/public/assets/css/style.css): セキュリティ特化の洗練されたモダンダークテーマ・レスポンシブデザイン
- [crypto.js](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/public/assets/js/crypto.js): Web Crypto API (AES-256-GCM) による暗号化・復号・URLセーフ鍵変換コア
- [app.js](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/public/assets/js/app.js): 入力制御、暗号化発行、フォールバックモック、URL生成
- [view.js](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/public/assets/js/view.js): URLハッシュ鍵抽出、API/モック取得、復号表示、即時破棄

## 3. ゼロナレッジ暗号化フローの検証
1. **送信時 (`app.js` + `crypto.js`)**:
   - `SecureCrypto.generateAesKey()` によりブラウザ内で256bitのAES-GCM鍵をランダム生成。
   - `SecureCrypto.encryptData()` で平文を暗号化（IVも安全に自動生成）。
   - 暗号鍵はサーバーへ送信せず、受取URLのハッシュフラグメント（`#<Base64Key>`）に格納。
2. **受信・閲覧時 (`view.js` + `crypto.js`)**:
   - URLのハッシュ（`#` 以降）から復号鍵を抽出。
   - サーバー（またはローカルモック）から暗号文とIVを取得し、サーバー側で即時物理削除。
   - ブラウザ内で `SecureCrypto.decryptData()` により平文を復元。
   - アドレスバーからハッシュを消去し、セキュリティを確保。

## 4. ローカルでの動作確認方法
1. ブラウザで [index.html](file:///c:/Users/Naruse/Desktop/HP_development/secureshare/public/index.html) を直接開く、または静的ファイルサーバーで開きます。
2. パスワードまたは秘密メモを入力し、「暗号化してワンタイムリンクを発行」をクリックします。
3. 発行されたURL（`view.html?id=...#...`）をコピーし、ブラウザの別タブで開きます。
4. 「シークレットを表示して破棄する」をクリックすると、復号された平文が表示されます。
5. ページを再読み込みすると「シークレットが見つかりません（既に閲覧・破棄済み）」と表示され、ワンタイム破棄が機能していることを確認できます。

## 5. 次のステップ
- **フェーズ1（バックエンド・D1基盤）**:
  - `wrangler.toml` および Cloudflare Workers API（`/api/secret` の POST/GET）の実装。
  - Cloudflare D1 データベースのテーブル定義 (`secrets`) と有効期限自動削除 (Cron Trigger)。
  - Cloudflare Turnstile 認証トークンの検証統合。
