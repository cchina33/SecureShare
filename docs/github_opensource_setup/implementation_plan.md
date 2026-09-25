# 実装計画書: GitHub オープンソース公開準備 (SecureShare)

## 1. 概要
本プロジェクトをオープンソース（OSS）として安全かつ魅力的に一般公開するための環境を整備します。

## 2. 実施項目詳細

### (1) `.gitignore`
- 秘密情報（`.dev.vars`）、ビルド生成物、キャッシュ（`.wrangler/`、`node_modules/`）が誤ってリポジトリに含まれないよう除外設定。

### (2) `LICENSE` (MIT License)
- 誰でも自由に利用・改変・再配布が可能な標準的オープンソースライセンス。

### (3) `README.md`
- サービスの目的とコアバリュー（ゼロナレッジ、ワンタイム破棄、0円インフラ）。
- 暗号化アーキテクチャの解説（Web Crypto API AES-256-GCM、URLハッシュ利用）。
- ローカル開発環境のセットアップ手順（Wrangler, D1初期化）。
- Cloudflare Pages / Workers へのデプロイ手順。

### (4) Web画面（UI）へのGitHub導線
- `index.html` および `view.html` のヘッダー右側に、GitHubのSVGアイコン付きリンク（`View on GitHub` / `Source Code`）を追加。
- 利用者がいつでも透明性を確認できるよう配慮。
