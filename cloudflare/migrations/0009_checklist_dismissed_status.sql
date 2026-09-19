PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS checklist_tasks_next (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  canonical_title TEXT NOT NULL,
  action TEXT NOT NULL,
  deadline TEXT,
  deadline_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (deadline_precision IN ('datetime', 'date', 'range', 'unknown')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  completed_at TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, user_id, canonical_key)
);

INSERT OR IGNORE INTO checklist_tasks_next (
  id,
  channel_id,
  user_id,
  canonical_key,
  canonical_title,
  action,
  deadline,
  deadline_precision,
  status,
  completed_at,
  xp_reward,
  created_at,
  updated_at
)
SELECT
  id,
  channel_id,
  user_id,
  canonical_key,
  canonical_title,
  action,
  deadline,
  deadline_precision,
  status,
  completed_at,
  xp_reward,
  created_at,
  updated_at
FROM checklist_tasks;

DROP TABLE checklist_tasks;

ALTER TABLE checklist_tasks_next RENAME TO checklist_tasks;

CREATE INDEX IF NOT EXISTS idx_checklist_tasks_owner_status
  ON checklist_tasks (channel_id, user_id, status, deadline);

PRAGMA foreign_keys=on;
