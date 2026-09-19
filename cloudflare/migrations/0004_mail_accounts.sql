CREATE TABLE IF NOT EXISTS mail_accounts (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  email TEXT NOT NULL,
  display_name TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_accounts_unique
  ON mail_accounts (channel_id, user_id, email);

CREATE INDEX IF NOT EXISTS idx_mail_accounts_user
  ON mail_accounts (channel_id, user_id, connected_at);
