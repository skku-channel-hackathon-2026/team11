CREATE TABLE IF NOT EXISTS academic_schedules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 1 CHECK (all_day IN (0, 1)),
  description TEXT,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_academic_schedules_start_at
  ON academic_schedules (start_at);

CREATE INDEX IF NOT EXISTS idx_academic_schedules_source
  ON academic_schedules (source);
