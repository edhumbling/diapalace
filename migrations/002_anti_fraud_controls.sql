-- ============================================================
-- Anti-Fraud & Business Controls Migration
-- ============================================================

-- 1. Inter-Branch Stock Transfers
CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  from_branch_id TEXT NOT NULL REFERENCES branches(id),
  to_branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity_dispatched INTEGER NOT NULL CHECK (quantity_dispatched > 0),
  quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
  dispatched_by_id TEXT NOT NULL REFERENCES users(id),
  received_by_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'IN_TRANSIT' CHECK (status IN ('IN_TRANSIT', 'COMPLETED', 'DISCREPANCY')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- 2. Refund Requests & Approvals
CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  requested_by_id TEXT NOT NULL REFERENCES users(id),
  approved_by_id TEXT REFERENCES users(id),
  amount REAL NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  method TEXT NOT NULL,
  restock_inventory INTEGER NOT NULL DEFAULT 1 CHECK (restock_inventory IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT
);

-- 3. Inventory Variance Requests
CREATE TABLE IF NOT EXISTS stock_adjustment_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  system_stock INTEGER NOT NULL,
  physical_stock INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  reason TEXT NOT NULL,
  requested_by_id TEXT NOT NULL REFERENCES users(id),
  approved_by_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Shift Reconciliations & Shortage Tracking
CREATE TABLE IF NOT EXISTS shift_reconciliations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  cashier_id TEXT NOT NULL REFERENCES users(id),
  expected_cash REAL NOT NULL DEFAULT 0,
  counted_cash REAL NOT NULL DEFAULT 0,
  cash_variance REAL NOT NULL DEFAULT 0,
  expected_momo REAL NOT NULL DEFAULT 0,
  counted_momo REAL NOT NULL DEFAULT 0,
  momo_variance REAL NOT NULL DEFAULT 0,
  expected_card REAL NOT NULL DEFAULT 0,
  counted_card REAL NOT NULL DEFAULT 0,
  card_variance REAL NOT NULL DEFAULT 0,
  closing_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('CLOSED', 'FLAGGED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Price Change Logs
CREATE TABLE IF NOT EXISTS price_change_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  old_price REAL NOT NULL,
  new_price REAL NOT NULL,
  requested_by_id TEXT NOT NULL REFERENCES users(id),
  approved_by_id TEXT REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
