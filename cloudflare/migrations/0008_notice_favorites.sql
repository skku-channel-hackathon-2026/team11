CREATE TABLE IF NOT EXISTS notice_favorites (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  notice_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, user_id, notice_id),
  FOREIGN KEY (notice_id) REFERENCES notices (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notice_favorites_owner_created
  ON notice_favorites (channel_id, user_id, created_at DESC);
