-- 010_shift_workflow.sql
-- Production cash-up workflow: payment methods, registers, shifts, shift closings.

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

-- Preserve legacy reconciliation history in the new source-of-truth table.
INSERT OR IGNORE INTO shifts (id, business_id, branch_id, register_id, cashier_id, opened_by_id, opening_cash, opened_at, closed_at, closed_by_id, status, notes)
SELECT
  'shift-legacy-' || sr.id, sr.business_id, sr.branch_id,
  COALESCE((SELECT id FROM registers r WHERE r.branch_id = sr.branch_id ORDER BY r.created_at LIMIT 1), 'reg-' || sr.branch_id),
  sr.cashier_id, sr.cashier_id, 0, sr.created_at, sr.created_at, sr.cashier_id, 'CLOSED',
  'Migrated from legacy shift reconciliation'
FROM shift_reconciliations sr
WHERE NOT EXISTS (SELECT 1 FROM shifts s WHERE s.id = 'shift-legacy-' || sr.id);

INSERT INTO shift_closings (
  id, submission_id, business_id, branch_id, register_id, shift_id, cashier_id, closed_by_id,
  opening_cash, total_sales, cash_refunds, expected_cash, counted_cash, cash_difference,
  breakdown, difference_reason, difference_explanation, status, closed_at
)
SELECT
  sr.id, 'legacy-' || sr.id, sr.business_id, sr.branch_id,
  COALESCE((SELECT id FROM registers r WHERE r.branch_id = sr.branch_id ORDER BY r.created_at LIMIT 1), 'reg-' || sr.branch_id),
  'shift-legacy-' || sr.id, sr.cashier_id, sr.cashier_id,
  0, sr.expected_cash + sr.expected_momo + sr.expected_card, 0,
  sr.expected_cash, sr.counted_cash, sr.cash_variance,
  '[{"method":"Cash","expected":' || sr.expected_cash || ',"counted":' || sr.counted_cash || '},{"method":"MTN MoMo","expected":' || sr.expected_momo || ',"counted":' || sr.counted_momo || '},{"method":"Card / POS","expected":' || sr.expected_card || ',"counted":' || sr.counted_card || '}]',
  '', sr.closing_notes,
  CASE WHEN sr.cash_variance < 0 THEN 'SHORT' WHEN sr.cash_variance > 0 THEN 'OVER' ELSE 'CLOSED' END,
  sr.created_at
FROM shift_reconciliations sr
WHERE NOT EXISTS (SELECT 1 FROM shift_closings sc WHERE sc.id = sr.id);
