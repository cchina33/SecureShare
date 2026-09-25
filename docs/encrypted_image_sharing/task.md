# タスク一覧: 暗号化画像共有機能の開発

## Phase 1: インフラ基盤とストレージ準備
- [x] ドキュメント整備 (`task.md`, `implementation_plan.md`) <!-- id: task-01 -->
- [x] R2 バケットの作成とライフサイクルルールの設定 (`secureshare-images`) <!-- id: task-02 -->
- [x] `wrangler.toml` に R2 バケットバインディング (`MY_BUCKET`) を追加 <!-- id: task-03 -->
- [x] `schema.sql` に画像メタデータ用テーブル (`images`) を追加 <!-- id: task-04 -->
- [x] D1 データベースへのスキーマ適用・検証 <!-- id: task-05 -->
- [x] Phase 1 完了確認ドキュメント (`walkthrough.md`) の作成 <!-- id: task-06 -->

## Phase 2: バックエンド API 実装
- [x] R2 ライフサイクルルールの更新（8日制限に対応するため9日ルールに更新） <!-- id: task-07 -->
- [x] ドキュメント更新 (`task.md`, `implementation_plan.md`) <!-- id: task-08 -->
- [x] `functions/api/image/index.js` の実装 (POST: 暗号化画像アップロード) <!-- id: task-09 -->
- [x] `functions/api/image/[id].js` の実装 (GET: 暗号化画像取得 & ワンタイム削除) <!-- id: task-10 -->
- [x] API 動作検証 <!-- id: task-11 -->
- [x] Phase 2 完了ドキュメント (`walkthrough.md`) の更新 <!-- id: task-12 -->

## Phase 3: フロントエンド実装（クライアント側暗号化・復号 & UI実装）
- [x] `crypto.js` に画像バイナリ暗号化・復号処理を追加 <!-- id: task-13 -->
- [x] `style.css` に画像アップローダーおよびプレビュー用のスタイルを追加 <!-- id: task-14 -->
- [x] `index.html` に画像タブとドラッグ＆ドロップ UI を追加 <!-- id: task-15 -->
- [x] `app.js` に画像暗号化・アップロード処理と有効期限8日制限ロジックを追加 <!-- id: task-16 -->
- [x] `view.html` に画像表示コンテナおよびアクションボタンを追加 <!-- id: task-17 -->
- [x] `view.js` に画像復号・表示・ダウンロード処理を追加 <!-- id: task-18 -->
- [x] 総合動作確認（ブラウザによるUI・有効期限8日ポリシー・タブ連動の自動検証） <!-- id: task-19 -->
- [x] Phase 3 完了ドキュメント (`walkthrough.md`) の更新 <!-- id: task-20 -->





