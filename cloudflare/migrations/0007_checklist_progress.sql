CREATE TABLE IF NOT EXISTS checklist_tasks (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  canonical_title TEXT NOT NULL,
  action TEXT NOT NULL,
  deadline TEXT,
  deadline_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (deadline_precision IN ('datetime', 'date', 'range', 'unknown')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, user_id, canonical_key)
);

CREATE INDEX IF NOT EXISTS idx_checklist_tasks_owner_status
  ON checklist_tasks (channel_id, user_id, status, deadline);

CREATE TABLE IF NOT EXISTS checklist_task_sources (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('NOTICE', 'MAIL', 'ACADEMIC_SCHEDULE')),
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, source_type, source_id),
  FOREIGN KEY (task_id) REFERENCES checklist_tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklist_task_sources_task
  ON checklist_task_sources (task_id);

CREATE INDEX IF NOT EXISTS idx_checklist_task_sources_source
  ON checklist_task_sources (source_type, source_id);

CREATE TABLE IF NOT EXISTS user_progress (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  total_xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS checklist_xp_awards (
  task_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL,
  awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES checklist_tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklist_xp_awards_owner
  ON checklist_xp_awards (channel_id, user_id);
