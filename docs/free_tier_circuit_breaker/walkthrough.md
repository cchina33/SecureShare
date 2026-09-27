# 成果物と運用ガイド: Cloudflare D1 / R2 無料枠サーキットブレーカー

Cloudflare D1（データベース）およびR2（オブジェクトストレージ）の無料枠を超過しそうな場合に、サービスを安全に一時停止（キルスイッチ発動）し、リセット日時に自動再開するサーキットブレーカー機構の実装が完了しました。

---

## 1. 変更・追加されたファイル一覧

| ファイルパス | 変更区分 | 内容 |
| :--- | :--- | :--- |
| `schema.sql` | 変更 | サーキットブレーカーの状態を記録する `system_status` テーブル定義を追加 |
| `functions/_middleware.js` | **新規** | すべての `/api/*` リクエストの手前で状態をチェックし、メンテナンス中は 503 で即座に遮断（D1/R2への不要アクセスをゼロに抑制、60秒インメモリキャッシュ付き） |
| `cron-worker/src/index.js` | 変更 | Cloudflare GraphQL Analytics APIによる利用量監視、安全閾値（85%）判定、メンテモード自動ON/OFF切り替え、および手動操作エンドポイントを実装 |
| `cron-worker/wrangler.toml` | 変更 | 環境変数設定（`CF_ACCOUNT_ID`、`CF_API_TOKEN`）の案内を追加 |
| `public/index.html` | 変更 | メンテナンス中に表示する警告案内バナーを追加 |
| `public/assets/js/app.js` | 変更 | 起動時のステータス確認 & 503受信時の分かりやすいエラー通知処理を追加 |
| `public/assets/js/view.js` | 変更 | 復号画面での503受信時のメンテナンス通知処理を追加 |
| `docs/free_tier_circuit_breaker/` | **新規** | タスクリスト、実装計画書、本運用ガイド |

---

## 2. 稼働の仕組み

```
【通常時】
ユーザー ──> Pages (/api/*) ──> _middleware.js (正常判定) ──> D1 / R2 処理

【無料枠85%超過時】
cron-worker (1時間おき) ──> Cloudflare GraphQL APIで使用量監視
      │
      └──> 閾値超過を検知 ──> D1 (system_status) の maintenance_mode を "1" に更新
                                    │
ユーザー ──> Pages (/api/*) ──> _middleware.js (メンテ中検知)
                                    │
                                    └──> HTTP 503 を即座に返却 (D1/R2アクセスは完全遮断)
                                    └──> フロントエンドに「一時停止中（リセット時刻表示）」を表示

【リセット時刻到来後】
cron-worker (リセット後の定期実行)
      │
      └──> 利用量が0に戻ったことを検知 ──> maintenance_mode を "0" に戻す (自動再開！)
```

### リセット周期と閾値（安全マージン 85%）
- **D1 読み取り**: 5,000,000 行/日 → **4,250,000 行** で発動（毎日 00:00 UTC / 09:00 JST に自動再開）
- **D1 書き込み**: 100,000 行/日 → **85,000 行** で発動（毎日 00:00 UTC / 09:00 JST に自動再開）
- **R2 Class A**: 1,000,000 回/月 → **850,000 回** で発動（毎月1日 00:00 UTC に自動再開）
- **R2 Class B**: 10,000,000 回/月 → **8,500,000 回** で発動（毎月1日 00:00 UTC に自動再開）

---

## 3. 本番環境への適用手順

### ① D1 にテーブルを適用
ターミナルから以下のコマンドを実行し、リモートD1に新しいテーブルを作成します：
```bash
npx wrangler d1 execute secureshare-db --remote --file=./schema.sql
```

### ② Cloudflare APIトークンの発行
定期監視ワーカーが利用量を取得できるように、CloudflareダッシュボードでAPIトークンを発行します：
1. Cloudflareダッシュボードの右上のプロフィールアイコン → **「マイ プロファイル」** → **「API トークン」** を開く。
2. **「トークンを作成」** をクリックし、**「カスタム トークンを作成」** を選択。
3. 権限（Permissions）を設定：
   - `アカウント` - `Analytics` - `読み取り`
4. アカウント リソース（Account Resources）：
   - `すべてのアカウント` または 対象アカウントを選択。
5. トークンを作成し、生成されたトークン文字列をコピーします。

### ③ cron-worker にシークレットと環境変数を設定
```bash
cd cron-worker

# APIトークンをシークレットとして登録
npx wrangler secret put CF_API_TOKEN
# (プロンプトが表示されたらコピーしたトークンを貼り付け)

# アカウントIDを wrangler.toml の [vars] に追記 または secretとして登録
npx wrangler secret put CF_ACCOUNT_ID
# (Cloudflareダッシュボード右下に表示される Account ID を入力)

# cron-worker をデプロイ
npx wrangler deploy
```

### ④ メインの Pages アプリケーションをデプロイ
ルートディレクトリでデプロイを実行します：
```bash
# プロジェクトルートで
npm run deploy  # または git push (GitHub連携している場合)
```

---

## 4. 動作テスト（手動でのサーキットブレーカー検証）

`cron-worker` には手動テスト用のエンドポイントを用意しています。本番デプロイ後、以下のように動作を確認できます：

#### A. 現在の状態を確認
```bash
curl https://secureshare-cron-worker.<あなたのワーカーサブドメイン>.workers.dev/status
```
返却例:
```json
{
  "ok": true,
  "status": {
    "maintenance_mode": { "value": "0", "updated_at": 1727480000000 }
  }
}
```

#### B. 手動で一時停止（サーキットブレーカー発動）をテスト
```bash
curl -X POST "https://secureshare-cron-worker.<あなたのワーカーサブドメイン>.workers.dev/maintenance/enable?reason=MANUAL_TEST"
```
- この状態で `index.html` を開くと、上部に赤色の**「本日の無料利用枠の上限に達したため一時停止中です」**バナーが表示され、ボタンが無効化されます。
- シークレット作成や画像アップロードを試みると、即座に 503 エラーメッセージが表示され、D1/R2への書き込みが一切行われません。

#### C. 手動でサービスを再開
```bash
curl -X POST "https://secureshare-cron-worker.<あなたのワーカーサブドメイン>.workers.dev/maintenance/disable"
```
- 再開後、ブラウザをリロードすると通常通りシークレットの発行・閲覧が可能になります。
