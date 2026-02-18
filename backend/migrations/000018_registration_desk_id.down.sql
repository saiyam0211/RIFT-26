DROP INDEX IF EXISTS idx_teams_registration_desk;
ALTER TABLE teams DROP COLUMN IF EXISTS registration_desk_id;
