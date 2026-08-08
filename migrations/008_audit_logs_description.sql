-- Schema drift fix: live audit_logs table was created without the
-- description column that dashboard recent-activity queries require.
ALTER TABLE audit_logs ADD COLUMN description TEXT NOT NULL DEFAULT '';