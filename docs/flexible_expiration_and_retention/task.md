# 実装タスクリスト: 有効期限自由設定（最大30日）＆保持モード選択 (SecureShare)

## 進行状況
- [x] 機能要件・UI設計・DB拡張方針の合意
- [x] ドキュメント群の配置 (`docs/flexible_expiration_and_retention/`)
    - [x] `task.md`
    - [x] `implementation_plan.md`
    - [x] `walkthrough.md`
- [x] D1スキーマの更新 (`schema.sql`) および本番マイグレーション実行
- [x] バックエンドAPI改修 (`functions/api/secret/`)
    - [x] `index.js`: 最大30日(2592000秒)対応 & `burn_after_read` カラム保存
    - [x] `[id].js`: 保持モード時の即座DELETE抑止 & フラグ返却
- [x] フロントエンドUI改修
    - [x] `public/index.html`: 消去モード選択ラジオ & カスタム日数入力欄追加
    - [x] `public/assets/js/app.js`: 日数計算 & 発行結果メッセージの動的制御
    - [x] `public/view.html`: 保持モード用警告文・バッジ切り替え要素
    - [x] `public/assets/js/view.js`: 取得したモードに応じたUI切り替え
- [x] 完了確認・ドキュメント更新
