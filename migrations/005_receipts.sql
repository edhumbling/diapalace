-- ============================================================
-- Immutable thermal receipt snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL UNIQUE REFERENCES sales(id),
  receipt_number TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  branch_id TEXT,
  cashier_id TEXT,
  business_name TEXT NOT NULL,
  branch_name TEXT NOT NULL DEFAULT '',
  business_phone TEXT NOT NULL DEFAULT '',
  business_email TEXT NOT NULL DEFAULT '',
  branch_address TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  footer TEXT NOT NULL DEFAULT 'Thank you for shopping with us.',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES receipts(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_business_created ON receipts (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items (receipt_id);
