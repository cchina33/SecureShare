# SecureShare (セキュアシェア)

> **ゼロナレッジ暗号化 & ワンタイム閲覧対応のセキュアなパスワード・秘密メモ共有サービス**  
> 完全無料（Cloudflare 無料枠）で運用可能なオープンソースWebアプリケーション。

---

## 🌟 特徴とコアバリュー

1. **ゼロナレッジ（Zero-Knowledge）暗号化**
   - ブラウザ標準の **Web Crypto API (AES-256-GCM)** を使用し、送信者の端末内でテキストを暗号化。
   - 復号鍵は受取用URLのハッシュフラグメント（`#<Base64Key>`）にのみ格納されます。ハッシュはHTTP仕様によりサーバーへ一切送信されないため、**サーバー管理者であっても中身を閲覧することは技術的に不可能**です。

2. **ワンタイム閲覧 & 自動物理消去**
   - 受信者がURLを開いて復号に成功すると、サーバー（Cloudflare D1）から**直ちに該当データが完全物理削除**されます。2回目のアクセスは404となり復元できません。

3. **期限切れデータの自動クリーンアップ**
   - 最長7日間の有効期限を設定可能。閲覧されずに放置されたデータも、Cloudflare Cron Triggers により定期的に自動破棄されます。

4. **ボット対策 & DoS防御**
   - **Cloudflare Turnstile** による透明な人間認証を標準搭載。悪意あるスクリプトによる自動送信を遮断します。

5. **ランニングコスト 0円（完全無料枠運用）**
   - Cloudflare Pages + Workers + D1 データベースの無料枠内で完結し、維持費ゼロで安全に運用できます。

---

## 🔒 暗号化アーキテクチャ

```
【送信者】
 1. パスワード/メモを入力
 2. ブラウザ上で256bit暗号鍵をランダム生成 (AES-GCM)
 3. 平文を暗号化 ──> 暗号文 + 初期化ベクトル(IV) を API (POST /api/secret) へ送信
 4. 受取URLを発行: https://domain/view.html?id=<UUID>#<暗号鍵>
                                                     └────── サーバーには送られない

【受信者】
 1. 共有URLを開く（ハッシュから暗号鍵を抽出）
 2. API (GET /api/secret/<UUID>) より暗号文を取得
 3. [サーバー側] 取得と同時にD1からレコードを即座に DELETE（物理削除）
 4. [ブラウザ側] 抽出した暗号鍵で平文に復号・表示
```

---

## 🛠 技術スタック

- **フロントエンド**: HTML5, Vanilla CSS, Vanilla JavaScript (ESモジュール/モダンWeb標準)
- **暗号化エンジン**: Web Crypto API (SubtleCrypto: AES-GCM 256bit)
- **ホスティング**: Cloudflare Pages
- **バックエンド API**: Cloudflare Pages Functions (Workers)
- **データベース**: Cloudflare D1 (サーバーレス分散SQL)
- **ボット対策**: Cloudflare Turnstile

---

## 🚀 ローカル開発環境のセットアップ

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

## 🚢 本番デプロイ手順 (Cloudflare)

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

## 📄 ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。商用・個人利用問わず自由にご利用いただけます。
