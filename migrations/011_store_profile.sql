-- 011_store_profile.sql
-- Store Profile (business settings) columns and custom fields.

ALTER TABLE businesses ADD COLUMN trading_name TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN logo_data TEXT;
ALTER TABLE businesses ADD COLUMN store_type TEXT NOT NULL DEFAULT 'Retail';
ALTER TABLE businesses ADD COLUMN alt_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN country TEXT NOT NULL DEFAULT 'Ghana';
ALTER TABLE businesses ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN digital_address TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN physical_address TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN gps_location TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN registration_number TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN tax_number TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN currency TEXT NOT NULL DEFAULT 'GHS';
ALTER TABLE businesses ADD COLUMN default_language TEXT NOT NULL DEFAULT 'English';
ALTER TABLE businesses ADD COLUMN business_hours TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping with us.';
ALTER TABLE businesses ADD COLUMN return_policy TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN updated_at TEXT;

ALTER TABLE products ADD COLUMN updated_at TEXT;

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
