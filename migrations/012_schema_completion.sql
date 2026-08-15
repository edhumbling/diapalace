-- ============================================================
-- Schema completion: branches scope columns, audit_logs,
-- payment methods, registers, shifts and shift closings.
--
-- schema.sql is the authoritative schema for a fresh database.
-- This migration is the incremental catch-up for databases that
-- already ran an earlier schema.sql (or migrations 001–011) and
-- therefore lack these columns/tables. Run it once against an
-- existing remote database:
--
--   wrangler d1 execute --config wrangler.jsonc diapalace-db --remote --file=./migrations/012_schema_completion.sql
--
-- SQLite does not support "ADD COLUMN IF NOT EXISTS"; apply these
-- statements only once. Re-running against a database that already
-- has them will report "duplicate column name" errors, which are
-- safe to ignore for the columns that already exist.
-- ============================================================

ALTER TABLE branches ADD COLUMN code TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN digital_address TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN manager_id TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN deactivation_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'SYSTEM',
  entity_type TEXT NOT NULL DEFAULT 'SYSTEM',
  entity_id TEXT NOT NULL DEFAULT '',
  old_values TEXT,
  new_values TEXT,
  reason TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  ip_address TEXT,
  device_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_methods (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

INSERT OR IGNORE INTO payment_methods (name, enabled) VALUES
  ('Cash', 1),
  ('MTN MoMo', 1),
  ('Telecel Cash', 1),
  ('AirtelTigo Money', 1),
  ('Card / POS', 1),
  ('Bank transfer', 1);

CREATE TABLE IF NOT EXISTS registers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (branch_id, name)
);

INSERT OR IGNORE INTO registers (id, business_id, branch_id, name, status)
SELECT 'reg-' || id, business_id, id, 'Register 01', 'active'
FROM branches;

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  register_id TEXT NOT NULL REFERENCES registers(id),
  cashier_id TEXT NOT NULL REFERENCES users(id),
  opened_by_id TEXT NOT NULL REFERENCES users(id),
  opening_cash REAL NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  closed_by_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS shift_closings (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  register_id TEXT NOT NULL REFERENCES registers(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  cashier_id TEXT NOT NULL REFERENCES users(id),
  closed_by_id TEXT NOT NULL REFERENCES users(id),
  opening_cash REAL NOT NULL DEFAULT 0,
  total_sales REAL NOT NULL DEFAULT 0,
  cash_refunds REAL NOT NULL DEFAULT 0,
  expected_cash REAL NOT NULL DEFAULT 0,
  counted_cash REAL NOT NULL DEFAULT 0,
  cash_difference REAL NOT NULL DEFAULT 0,
  breakdown TEXT NOT NULL DEFAULT '[]',
  difference_reason TEXT NOT NULL DEFAULT '',
  difference_explanation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('CLOSED', 'SHORT', 'OVER')),
  closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by_id TEXT REFERENCES users(id),
  acknowledged_at TEXT,
  acknowledged_note TEXT NOT NULL DEFAULT '',
  reopened_at TEXT,
  reopened_by_id TEXT REFERENCES users(id),
  reopened_reason TEXT NOT NULL DEFAULT ''
);
