-- ============================================================
-- Canonical transaction attribution and idempotency
-- ============================================================

ALTER TABLE products ADD COLUMN business_id TEXT;
ALTER TABLE products ADD COLUMN branch_id TEXT;
ALTER TABLE sales ADD COLUMN business_id TEXT;
ALTER TABLE sales ADD COLUMN branch_id TEXT;
ALTER TABLE inventory_movements ADD COLUMN business_id TEXT;
ALTER TABLE inventory_movements ADD COLUMN branch_id TEXT;
ALTER TABLE receipts ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_idempotency ON receipts (business_id, idempotency_key);
