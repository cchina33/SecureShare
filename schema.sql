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
