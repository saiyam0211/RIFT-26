-- Allocate a registration desk (event_table) to each team for onboarding at venue
ALTER TABLE teams ADD COLUMN IF NOT EXISTS registration_desk_id UUID REFERENCES event_tables(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teams_registration_desk ON teams(registration_desk_id);
