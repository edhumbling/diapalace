-- ============================================================
-- In-app notification center
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT REFERENCES branches(id),
  recipient_user_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'NORMAL' CHECK (severity IN ('CRITICAL', 'WARNING', 'NORMAL', 'INFO')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  action_url TEXT,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ', 'ACKNOWLEDGED', 'ACTIONED', 'RESOLVED', 'DISMISSED')),
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  acknowledged_at TEXT,
  actioned_at TEXT,
  resolved_at TEXT,
  dismissed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status
  ON notifications (recipient_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_branch_category
  ON notifications (business_id, branch_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications (recipient_user_id, dedupe_key, status);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  mandatory INTEGER NOT NULL DEFAULT 0 CHECK (mandatory IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category, type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences (user_id, category);
