import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const runner = process.execPath;
const wranglerArgs = ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "--config", "wrangler.local.jsonc", "diapalace-db-local", "--local"];

function execute(sql, allowFailure = false) {
  try {
    execFileSync(runner, [...wranglerArgs, "--command", sql], { stdio: "inherit" });
  } catch (error) {
    if (!allowFailure) throw error;
  }
}

// Wrangler's Windows runtime is more reliable when schema statements run individually.
const source = readFileSync("schema.sql", "utf8").replace(/CREATE TRIGGER IF NOT EXISTS prevent_negative_stock[\s\S]*?END;\s*/i, "");
const statements = source.split(";").map((item) => item.trim()).filter(Boolean);
for (let index = 0; index < statements.length; index += 5) {
  execute(statements.slice(index, index + 5).join(";\n"));
}

const branchColumns = [
  "ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE branches ADD COLUMN code TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE branches ADD COLUMN email TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE branches ADD COLUMN region TEXT NOT NULL DEFAULT 'Greater Accra Region'",
  "ALTER TABLE branches ADD COLUMN city TEXT NOT NULL DEFAULT 'Accra'",
  "ALTER TABLE branches ADD COLUMN address TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE branches ADD COLUMN digital_address TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE branches ADD COLUMN manager_id TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE branches ADD COLUMN deactivation_reason TEXT NOT NULL DEFAULT ''",
];
for (const statement of branchColumns) execute(statement, true);

execute(`CREATE TABLE IF NOT EXISTS audit_logs (
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
  ip_address TEXT,
  device_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

execute(`INSERT OR IGNORE INTO businesses (id, name, phone, email) VALUES ('biz-diapalace', 'Dia''s Palace', '+233 24 555 0192', 'contact@diapalace.com');
INSERT OR IGNORE INTO branches (id, business_id, name, location, phone, status, code, email, region, city, address, digital_address, manager_id) VALUES
  ('br-osu', 'biz-diapalace', 'Osu Flagship', 'Osu, Accra', '024 555 0192', 'active', 'OSU-001', '', 'Greater Accra Region', 'Accra', 'Osu, Accra', '', 'u-jordan'),
  ('br-kumasi', 'biz-diapalace', 'Kumasi Branch', 'Adum, Kumasi', '055 318 4420', 'active', 'KUM-001', '', 'Ashanti Region', 'Kumasi', 'Adum, Kumasi', '', '');
INSERT OR IGNORE INTO users (id, business_id, full_name, username, phone, password_hash, pin_hash, role, status, force_password_change) VALUES
  ('u-jordan', 'biz-diapalace', 'Jordan Lee', 'jordanlee', '024 555 0192', '', '', 'owner', 'active', 0),
  ('u-ama', 'biz-diapalace', 'Ama Serwaa', 'amamanager', '020 771 2605', '', '', 'manager', 'active', 0),
  ('u-kofi', 'biz-diapalace', 'Kofi Mensah', 'kofimensah', '055 318 4420', '', '', 'cashier', 'active', 0),
  ('u-yaw', 'biz-diapalace', 'Yaw Boateng', 'yawstock', '024 999 8877', '', '', 'stock_officer', 'active', 0);
INSERT OR IGNORE INTO user_branches (id, user_id, branch_id) VALUES
  ('ub-ama-osu', 'u-ama', 'br-osu'),
  ('ub-ama-kumasi', 'u-ama', 'br-kumasi'),
  ('ub-kofi-osu', 'u-kofi', 'br-osu'),
  ('ub-yaw-osu', 'u-yaw', 'br-osu');`);

const migration010 = readFileSync("migrations/010_shift_workflow.sql", "utf8").replace(/^\s*--.*$/gm, "");
const migrationStatements = migration010.split(";").map((item) => item.trim()).filter(Boolean);
for (let index = 0; index < migrationStatements.length; index += 5) {
  execute(migrationStatements.slice(index, index + 5).join(";\n"), true);
}

const storeProfileStatements = [
  "ALTER TABLE businesses ADD COLUMN trading_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN description TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN logo_data TEXT",
  "ALTER TABLE businesses ADD COLUMN store_type TEXT NOT NULL DEFAULT 'Retail'",
  "ALTER TABLE businesses ADD COLUMN alt_phone TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN whatsapp TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN website TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN country TEXT NOT NULL DEFAULT 'Ghana'",
  "ALTER TABLE businesses ADD COLUMN region TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN city TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN digital_address TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN physical_address TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN gps_location TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN registration_number TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN tax_number TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN currency TEXT NOT NULL DEFAULT 'GHS'",
  "ALTER TABLE businesses ADD COLUMN default_language TEXT NOT NULL DEFAULT 'English'",
  "ALTER TABLE businesses ADD COLUMN business_hours TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping with us.'",
  "ALTER TABLE businesses ADD COLUMN return_policy TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN updated_at TEXT",
  "ALTER TABLE products ADD COLUMN updated_at TEXT",
];
for (const statement of storeProfileStatements) execute(statement, true);

execute(`CREATE TABLE IF NOT EXISTS store_custom_fields (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_store_custom_fields_business ON store_custom_fields (business_id, sort_order);`, true);

console.log("Local D1 is initialized in Wrangler's default .wrangler/state directory. Use the demo usernames from the login screen.");
