-- =============================================================================
-- SecureShare - Cloudflare D1 データベーススキーマ
-- =============================================================================

-- シークレット保管テーブル
CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  burn_after_read INTEGER DEFAULT 1
);

-- 有効期限クエリ・定期削除用のインデックス
CREATE INDEX IF NOT EXISTS idx_secrets_expires_at ON secrets(expires_at);

-- =============================================================================
-- 画像メタデータ保管テーブル (暗号化画像バイナリは R2 バケットに格納)
-- =============================================================================
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  iv TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  burn_after_read INTEGER DEFAULT 1
);

-- 画像有効期限クエリ・定期削除用のインデックス
CREATE INDEX IF NOT EXISTS idx_images_expires_at ON images(expires_at);

