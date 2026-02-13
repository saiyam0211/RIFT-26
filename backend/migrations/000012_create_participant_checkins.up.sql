-- Create participant check-ins table for individual participant tracking
CREATE TABLE IF NOT EXISTS participant_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    table_id UUID REFERENCES event_tables(id) ON DELETE SET NULL,
    participant_name VARCHAR(255) NOT NULL,
    participant_role VARCHAR(50) NOT NULL, -- 'leader' or 'member'
    checked_in_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_participant_checkins_team ON participant_check_ins(team_id);
CREATE INDEX idx_participant_checkins_volunteer ON participant_check_ins(volunteer_id);
CREATE INDEX idx_participant_checkins_table ON participant_check_ins(table_id);
CREATE INDEX idx_participant_checkins_date ON participant_check_ins(checked_in_at);

-- Create table confirmations to track when table volunteer marks team as done
CREATE TABLE IF NOT EXISTS table_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    table_id UUID REFERENCES event_tables(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_table_confirmations_team ON table_confirmations(team_id);
CREATE INDEX idx_table_confirmations_volunteer ON table_confirmations(volunteer_id);
CREATE INDEX idx_table_confirmations_table ON table_confirmations(table_id);

-- Add column to teams table to track which volunteer did the check-in
ALTER TABLE teams ADD COLUMN IF NOT EXISTS volunteer_table_id UUID REFERENCES event_tables(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX idx_teams_volunteer_table ON teams(volunteer_table_id);
