-- Remove unique constraint on team_name
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_team_name_key;
