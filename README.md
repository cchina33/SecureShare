# SecureShare (セキュアシェア)

> **ゼロナレッジ暗号化 & ワンタイム閲覧対応のセキュアなパスワード・秘密メモ共有サービス**  
> 完全無料（Cloudflare 無料枠）で運用可能なオープンソースWebアプリケーション。

**公開Webサイト（今すぐ使う）**: [https://secureshare-d6x.pages.dev/](https://secureshare-d6x.pages.dev/)

---

## 特徴とコアバリュー

1. **ゼロナレッジ（Zero-Knowledge）暗号化**
   - ブラウザ標準の **Web Crypto API (AES-256-GCM)** を使用し、送信者の端末内でテキストを暗号化。
   - 復号鍵は受取用URLのハッシュフラグメント（`#<Base64Key>`）にのみ格納されます。ハッシュはHTTP仕様によりサーバーへ一切送信されないため、**サーバー管理者であっても中身を閲覧することは技術的に不可能**です。

2. **選べる2つの消去モード（ワンタイム即時消去 / 期限まで保持）**
   - **閲覧後に即時消去**: 受信者が1度開いて復号に成功すると、サーバー（Cloudflare D1）から**直ちに完全物理削除**されます。2回目のアクセスは404となり復元できません（最高セキュリティ）。
   - **期限まで保持**: 有効期限が切れるまで、同じURLから**何度でも再閲覧可能**。複数人への伝達や、受け取った側が後から見返す場合に便利です。

3. **最大30日間の柔軟な有効期限設定（カスタム日数指定）**
   - 1時間、24時間、3日、7日、14日、30日のプリセットに加え、**1〜30日間の数値を自由に指定できるカスタム入力**に対応。閲覧されずに放置されたデータも、Cloudflare Cron Triggers により定期的に自動物理削除されます。

4. **ボット対策 & DoS防御**
   - **Cloudflare Turnstile** による透明な人間認証を標準搭載。悪意あるスクリプトによる自動送信を遮断します。

5. **ランニングコスト 0円（完全無料枠運用）**
   - Cloudflare Pages + Workers + D1 データベースの無料枠内で完結し、維持費ゼロで安全に運用できます。

---

## ドキュメント

より詳細な仕様や設計については、各ドキュメントをご参照ください：

- [アーキテクチャ設計書 (ARCHITECTURE.md)](docs/ARCHITECTURE.md): 暗号化の仕組み、セキュリティモデル、消去モードの詳細解説
- [API仕様書 (API.md)](docs/API.md): バックエンドAPIエンドポイントのリファレンス
- [本番デプロイ手順書 (DEPLOYMENT.md)](docs/DEPLOYMENT.md): Cloudflare環境への本番公開完全マニュアル

---

## 暗号化アーキテクチャ

```
【送信者】
 1. パスワード/メモを入力 & モード（ワンタイム or 保持）と有効期限（最大30日）を選択
 2. ブラウザ上で256bit暗号鍵をランダム生成 (AES-GCM)
 3. 平文を暗号化 ──> 暗号文 + 初期化ベクトル(IV) を API (POST /api/secret) へ送信
 4. 受取URLを発行: https://domain/view.html?id=<UUID>[&burn=0]#<暗号鍵>
                                                     └────── サーバーには送られない

【受信者】
 1. 共有URLを開く（ハッシュから暗号鍵を抽出）
 2. API (GET /api/secret/<UUID>) より暗号文を取得
 3. [サーバー側]
    - ワンタイムモード: 取得と同時にD1からレコードを即座に DELETE（物理削除）
    - 期限保持モード: 削除せずレコードを維持（有効期限まで何度でもアクセス可能）
 4. [ブラウザ側] 抽出した暗号鍵で平文に復号・画面表示
```

---

## 技術スタック

- **フロントエンド**: HTML5, Vanilla CSS, Vanilla JavaScript (ESモジュール/モダンWeb標準)
- **暗号化エンジン**: Web Crypto API (SubtleCrypto: AES-GCM 256bit)
- **ホスティング**: Cloudflare Pages
- **バックエンド API**: Cloudflare Pages Functions (Workers)
- **データベース**: Cloudflare D1 (サーバーレス分散SQL)
- **ボット対策**: Cloudflare Turnstile

---

## ローカル開発環境のセットアップ

### 1. リポジトリのクローンと依存パッケージのインストール

```bash
git clone https://github.com/<YOUR_USER_NAME>/secureshare.git
cd secureshare
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

起動後、ブラウザで `http://localhost:8788` にアクセスして動作を確認できます。

---

## 本番デプロイ手順 (Cloudflare)

### 1. Cloudflare D1 データベースの作成

```bash
npx wrangler d1 create secureshare-db
```

出力された `database_id` を `wrangler.toml` に設定し、本番スキーマを適用します：

```bash
npx wrangler d1 execute secureshare-db --remote --file=./schema.sql
```

### 2. Cloudflare Pages へのデプロイ

GitHub リポジトリを Cloudflare Pages に連携するか、Wrangler CLI で直接デプロイします：

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
