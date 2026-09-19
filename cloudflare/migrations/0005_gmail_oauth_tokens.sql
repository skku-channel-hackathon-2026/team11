ALTER TABLE mail_accounts ADD COLUMN access_token TEXT;
ALTER TABLE mail_accounts ADD COLUMN refresh_token TEXT;
ALTER TABLE mail_accounts ADD COLUMN token_expires_at TEXT;
ALTER TABLE mail_accounts ADD COLUMN token_scope TEXT;
