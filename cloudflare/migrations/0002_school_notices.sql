CREATE TABLE IF NOT EXISTS user_profiles (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  grade INTEGER NOT NULL,
  interests_json TEXT NOT NULL CHECK (json_valid(interests_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  posted_at TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notices_posted_at ON notices (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_department ON notices (department);

CREATE TABLE IF NOT EXISTS notice_relevance (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  notice_id INTEGER NOT NULL,
  relevant INTEGER NOT NULL CHECK (relevant IN (0, 1)),
  category TEXT,
  reason TEXT,
  analyzed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id, user_id, notice_id),
  FOREIGN KEY (notice_id) REFERENCES notices (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notice_relevance_user
  ON notice_relevance (channel_id, user_id, relevant);
