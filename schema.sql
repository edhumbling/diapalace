CREATE TABLE IF NOT EXISTS pos_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  products TEXT NOT NULL,
  customers TEXT NOT NULL,
  sales TEXT NOT NULL,
  purchases TEXT NOT NULL,
  expenses TEXT NOT NULL,
  tax_enabled INTEGER NOT NULL DEFAULT 0 CHECK (tax_enabled IN (0, 1)),
  tax_rate REAL NOT NULL DEFAULT 15 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trading_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  logo_data TEXT,
  store_type TEXT NOT NULL DEFAULT 'Retail',
  phone TEXT NOT NULL DEFAULT '',
  alt_phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Ghana',
  region TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  digital_address TEXT NOT NULL DEFAULT '',
  physical_address TEXT NOT NULL DEFAULT '',
  gps_location TEXT NOT NULL DEFAULT '',
  registration_number TEXT NOT NULL DEFAULT '',
  tax_number TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'GHS',
  default_language TEXT NOT NULL DEFAULT 'English',
  business_hours TEXT NOT NULL DEFAULT '',
  receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping with us.',
  return_policy TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS store_custom_fields (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_store_custom_fields_business
  ON store_custom_fields (business_id, sort_order);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  digital_address TEXT NOT NULL DEFAULT '',
  manager_id TEXT NOT NULL DEFAULT '',
  deactivation_reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deactivated', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL DEFAULT '' REFERENCES businesses(id),
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  pin_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'stock_officer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
  force_password_change INTEGER NOT NULL DEFAULT 0 CHECK (force_password_change IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS user_branches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  UNIQUE(user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  branch_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  branch_id TEXT REFERENCES branches(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL UNIQUE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price REAL NOT NULL CHECK (selling_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  unit TEXT NOT NULL DEFAULT 'piece',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  credit_balance REAL NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  branch_id TEXT REFERENCES branches(id),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id),
  cashier_id TEXT REFERENCES users(id),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax REAL NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL CHECK (status IN ('PAID', 'REFUNDED', 'VOID')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total REAL NOT NULL CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Card / POS', 'Bank transfer', 'Credit')),
  amount REAL NOT NULL CHECK (amount >= 0),
  reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('PAID', 'PENDING', 'FAILED')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  branch_id TEXT REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('opening', 'purchase', 'sale', 'return', 'adjustment')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  name TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  branch_id TEXT REFERENCES branches(id),
  invoice_number TEXT NOT NULL UNIQUE,
  supplier_id TEXT REFERENCES suppliers(id),
  supplier_name TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('Received', 'Pending'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  total REAL NOT NULL CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id),
  branch_id TEXT REFERENCES branches(id),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS prevent_negative_stock
BEFORE UPDATE OF stock_quantity ON products
WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Insufficient stock');
END;

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
  idempotency_key TEXT,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_idempotency ON receipts (business_id, idempotency_key);

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
