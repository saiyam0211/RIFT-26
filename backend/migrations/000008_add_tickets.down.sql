-- Rollback tickets migration
DROP INDEX IF EXISTS idx_email_logs_created_at;
DROP TABLE IF EXISTS email_logs;

ALTER TABLE teams DROP COLUMN IF EXISTS edit_allowed_until;

DROP INDEX IF EXISTS idx_announcements_filters;
DROP INDEX IF EXISTS idx_announcements_created_at;
DROP TABLE IF EXISTS announcements;

DROP INDEX IF EXISTS idx_tickets_created_at;
DROP INDEX IF EXISTS idx_tickets_status;
DROP INDEX IF EXISTS idx_tickets_team_id;
DROP TABLE IF EXISTS tickets;
