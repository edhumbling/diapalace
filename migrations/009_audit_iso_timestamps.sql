-- Datetime format drift fix: rows written via DEFAULT CURRENT_TIMESTAMP use
-- 'YYYY-MM-DD HH:MM:SS' whereas code filters audit/dashboard windows against
-- ISO 'YYYY-MM-DDTHH:MM:SS.sssZ' strings. Lexicographic comparison then
-- silently excluded every audit row from today/week filters.
UPDATE audit_logs SET created_at = (replace(created_at, ' ', 'T') || 'Z')
  WHERE created_at NOT LIKE '%T%';
UPDATE audit_log SET created_at = (replace(created_at, ' ', 'T') || 'Z')
  WHERE created_at NOT LIKE '%T%';
UPDATE notifications SET created_at = (replace(created_at, ' ', 'T') || 'Z')
  WHERE created_at NOT LIKE '%T%';