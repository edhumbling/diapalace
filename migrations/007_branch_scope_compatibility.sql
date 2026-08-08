ALTER TABLE customers ADD COLUMN business_id TEXT;
ALTER TABLE purchases ADD COLUMN business_id TEXT;
ALTER TABLE purchases ADD COLUMN branch_id TEXT;
ALTER TABLE expenses ADD COLUMN business_id TEXT;
ALTER TABLE expenses ADD COLUMN branch_id TEXT;