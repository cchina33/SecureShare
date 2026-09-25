# SecureShare (セキュアシェア)

> **ゼロナレッジ暗号化 & ワンタイム閲覧対応のセキュアなパスワード・秘密メモ・画像共有サービス**  
> 無料で運用しているオープンソースのWebアプリケーション。

**Webサイト**：[https://secureshare-d6x.pages.dev/](https://secureshare-d6x.pages.dev/)

---

## どんなときに使うサービス？

日常やビジネスの「ちょっと安全に送りたい」シーンで活躍します。

- **チャットやメールの履歴に残したくないとき**
  - Slack、Teams、LINE、メール等でパスワードや認証コードを伝える際、会話ログに永久に残ってしまうのを防ぎます。
- **機密書類や設定画面のキャプチャを安全に送りたいとき**
  - 身分証の写真、クレジットカード情報の控え、サーバー設定のスクリーンショットなどを、相手が確認した瞬間に消去させたいときに便利です。
- **社外メンバーや取引先への安全なデータ引き継ぎ**
  - アカウント情報やWi-Fiパスワードを安全に共有し、不要になったら自動で期限切れ・破棄されます。
- **会員登録やアプリインストールなしですぐ送りたいとき**
  - 送る側も受け取る側も、ブラウザを開くだけで10秒で安全にやり取りできます。

---

## 特徴とコアバリュー

1. **ゼロナレッジ（Zero-Knowledge）暗号化**
   - ブラウザ標準の **Web Crypto API (AES-256-GCM)** を使用し、送信者の端末内でテキストや画像バイナリを直接暗号化。
   - 復号鍵は受取用URLのハッシュフラグメント（`#<Base64Key>`）にのみ格納されます。ハッシュはHTTP仕様によりサーバーへ一切送信されないため、**サーバー管理者であっても中身を閲覧することは技術的に不可能**です。

2. **エンドツーエンド暗号化画像共有（Cloudflare R2連携）**
   - パスワードやテキストメモに加え、機密画像（PNG, JPEG, WebP, GIF、最大10MB）の安全な共有に対応。
   - クライアント側で画像を直接バイナリ暗号化し、Cloudflare R2 ストレージへ安全に保存。
   - ストレージの肥大化と長期間放置リスクを防ぐため、画像共有は**最大8日間に制限**。さらにR2のライフサイクルルール（9日後自動削除）による二重のセーフティネットを備えています。

3. **選べる2つの消去モード（ワンタイム即時消去 / 期限まで保持）**
   - **閲覧後に即時消去**: 受信者が1度開いて復号に成功すると、サーバー（D1およびR2）から**直ちに完全物理削除**されます。2回目のアクセスは404となり復元できません（最高セキュリティ）。
   - **期限まで保持**: 有効期限が切れるまで、同じURLから**何度でも再閲覧可能**。複数人への伝達や、受け取った側が後から見返す場合に便利です。

4. **柔軟な有効期限設定（カスタム日数指定）**
   - テキスト・パスワードは最大30日間、画像は最大8日間の範囲で、1時間〜日単位のプリセットおよび自由な日数指定に対応。
   - 閲覧されずに放置されたデータも、有効期限切れクエリおよび定期削除バッチ（Cron Worker）により自動物理削除されます。

5. **ボット対策 & DoS防御**
   - **Cloudflare Turnstile** による透明な人間認証を標準搭載。悪意あるスクリプトによる自動送信を遮断します。

6. **ランニングコスト 0円（完全無料枠運用）**
   - Cloudflare Pages + Workers + D1 データベース + R2 オブジェクトストレージの無料枠内で完結し、維持費ゼロで安全に運用できます。  
     ただし、データ量が増えればコストは増えるので、その場合は有料プランへの移行も検討する必要があります。

---

## AIネイティブ開発 (AI-Powered Development)

本プロジェクトは、**最先端AIアシスタント（Google Antigravity / Gemini）とのペアプログラミング**により開発されています。

- **堅牢な暗号アーキテクチャの共同設計**: クライアントサイドでの AES-GCM ゼロナレッジ暗号化設計、R2ハイブリッドストレージ構成、ライフサイクルポリシーの策定。
- **フルスタック実装**: Workers API（Functions）、D1 スキーマ設計、モダンで洗練されたUI/UX（Vanilla CSS / ダークテーマ）のコード生成。
- **包括的な技術ドキュメント整備**: 仕様変更に即座に追従するアーキテクチャ・APIリファレンスの自動整合。

---

## ドキュメント

より詳細な仕様や設計については、各ドキュメントをご参照ください：

- [アーキテクチャ設計書 (ARCHITECTURE.md)](docs/ARCHITECTURE.md): 暗号化の仕組み、セキュリティモデル、D1+R2ハイブリッドストレージの詳細解説
- [API仕様書 (API.md)](docs/API.md): テキストおよび画像共有用バックエンドAPIエンドポイントのリファレンス
- [本番デプロイ手順書 (DEPLOYMENT.md)](docs/DEPLOYMENT.md): Cloudflare環境（Pages, D1, R2）への本番公開完全マニュアル
- [画像共有機能 開発記録 (docs/encrypted_image_sharing/)](docs/encrypted_image_sharing/): 暗号化画像共有機能の開発タスク、実装計画、検証レポート

---

## 暗号化アーキテクチャ

```
【送信者 (ブラウザ)】
 1. パスワード/メモ入力 または 画像ファイル(最大10MB)を選択
 2. 消去モード（ワンタイム or 保持）と有効期限（テキスト:最大30日 / 画像:最大8日）を選択
 3. ブラウザ上で256bit暗号鍵をランダム生成 (AES-256-GCM)
 4. クライアント側で暗号化:
    - テキスト: 文字列暗号化 ──> POST /api/secret
    - 画像: バイナリ直接暗号化 ──> POST /api/image (R2ストレージ保管)
 5. 受取URLを発行: https://domain/view.html?id=<UUID>[&type=image][&burn=0]#<暗号鍵>
                                                                     └────── サーバーには送られない

【受信者 (ブラウザ)】
 1. 共有URLを開く（URLハッシュから暗号鍵を抽出）
 2. APIより暗号化データを受信 (GET /api/secret/<UUID> または GET /api/image/<UUID>)
 3. [サーバー側]
    - ワンタイムモード: 取得と同時にD1/R2からデータを即座に DELETE（完全物理削除）
    - 期限保持モード: 削除せずデータを維持（有効期限まで何度でもアクセス可能）
 4. [ブラウザ側] 抽出した暗号鍵で平文テキストまたは画像Blobに復号して画面表示
```

---

## 技術スタック

- **フロントエンド**: HTML5, Vanilla CSS (ダークテーマ / グラスモーフィズム), Vanilla JavaScript (Web標準)
- **暗号化エンジン**: Web Crypto API (SubtleCrypto: AES-GCM 256bit)
- **ホスティング**: Cloudflare Pages
- **バックエンド API**: Cloudflare Pages Functions (Workers)
- **データベース**: Cloudflare D1 (サーバーレス分散SQL)
- **オブジェクトストレージ**: Cloudflare R2 (画像暗号化バイナリ保管用)
- **ボット対策**: Cloudflare Turnstile
- **開発ツール**: Google Antigravity / Gemini (AI支援ペアプログラミング)

---

## ローカル開発環境のセットアップ

### 1. リポジトリのクローンと依存パッケージのインストール

```bash
git clone https://github.com/cchina33/SecureShare.git
cd SecureShare
npm install
```

### 2. 環境変数の設定

```bash
cp .dev.vars.example .dev.vars
```

※ ローカル開発では、デフォルトのテスト用キーでそのまま動作します。

### 3. ローカル D1 データベースの初期化

```bash
npm run d1:init
```

### 4. ローカル開発サーバーの起動

```bash
npm run dev
```

起動後、ブラウザで `http://localhost:8788` にアクセスして動作を確認できます（D1 および R2 バケットがローカルエミュレートされます）。

---

## 本番デプロイ手順 (Cloudflare)

### 1. Cloudflare D1 データベース & R2 バケットの作成

```bash
# D1 データベースの作成
npx wrangler d1 create secureshare-db

# R2 画像保存用バケットの作成
npx wrangler r2 bucket create secureshare-images

# R2 ライフサイクルルールの設定 (9日後自動削除)
npx wrangler r2 bucket lifecycle add secureshare-images auto-delete-9days --expire-days 9 -y
```

`wrangler.toml` に出力された D1 の `database_id` を反映し、本番スキーマを適用します：

```bash
npx wrangler d1 execute secureshare-db --remote --file=./schema.sql
```

### 2. Cloudflare Pages へのデプロイ

```bash
npm run deploy
```

### 3. 定期削除 Cron Worker のデプロイ

```bash
cd cron-worker
npx wrangler deploy
```

---

## ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。商用・個人利用問わず自由にご利用いただけます。
