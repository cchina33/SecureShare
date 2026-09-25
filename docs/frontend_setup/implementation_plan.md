# 実装計画書: フロントエンド基盤・ディレクトリ構成 (SecureShare)

## 1. 概要
本ドキュメントは、「セキュアワンタイムメモ・パスワード共有サービス (SecureShare)」のフロントエンド（HTML/CSS/JS）およびプロジェクト構成に関する初期セットアップの詳細計画書です。

## 2. アーキテクチャとゼロナレッジ暗号化設計
- **クライアントサイド暗号化**:
  - ブラウザの標準 `window.crypto.subtle` (Web Crypto API) を採用。
  - 暗号化方式: `AES-GCM` (鍵長: 256bit)。
  - 鍵導出および初期化ベクトル (IV: 12バイト/96bit) を生成。
- **URLフラグメントによるゼロナレッジ共有**:
  - 発行されるURLの形式: `https://<domain>/view.html?id=<シークレットID>#<Base64形式の暗号鍵>`
  - URLの `#` 以降（ハッシュフラグメント）は、HTTP仕様によりサーバーへのリクエストに含まれません。これにより、サーバー管理者であっても暗号鍵を知ることは不可能です。

## 3. ディレクトリ構成
```text
secureshare/
├── docs/
│   └── frontend_setup/
│       ├── task.md
│       ├── implementation_plan.md
│       └── walkthrough.md
└── public/
    ├── index.html          # 作成画面
    ├── view.html           # 閲覧画面
    └── assets/
        ├── css/
        │   └── style.css   # スタイル定義
        └── js/
            ├── crypto.js   # 暗号化・復号モジュール
            ├── app.js      # 作成画面UIロジック
            └── view.js     # 閲覧画面UIロジック
```

## 4. 各コンポーネントの実装内容

### (1) `public/assets/js/crypto.js`
- `generateAesKey()`: 256bitのAES-GCM暗号鍵を生成。
- `exportKey(key)`: 鍵オブジェクトをBase64 URL-safe文字列にエクスポート。
- `importKey(base64Key)`: Base64文字列からCryptoKeyオブジェクトへインポート。
- `encryptData(plainText, key)`: 平文文字列を暗号化し、Base64の暗号文とIVのペアを返却。
- `decryptData(cipherTextBase64, ivBase64, key)`: 暗号文とIVから平文文字列を復号。

### (2) `public/assets/css/style.css`
- セキュリティ・プライバシーを意識したダークテーマベースの洗練されたUI。
- アクセントカラー: エメラルドグリーン（安全）、シアン（先進性）。
- レスポンシブ設計（モバイル・タブレット・PCに最適化）。
- コピー完了トースト、タブ切り替えアニメーション、カードデザイン。

### (3) `public/index.html` & `public/assets/js/app.js`
- パスワード / 秘密メモの切り替えタブ。
- 有効期限セレクタ（1時間、24時間、3日、7日）。
- Turnstileのプレースホルダー枠。
- 暗号化実行とワンタイムURLの発行・コピー機能。

### (4) `public/view.html` & `public/assets/js/view.js`
- 閲覧前の確認画面（「一度開くとサーバーから消去されます」警告）。
- URLハッシュからの鍵取得・復号処理。
- 復号結果の表示とワンクリックコピー。
- 期限切れ/閲覧済み（404）時の専用エラー画面。
