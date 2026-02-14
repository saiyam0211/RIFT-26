-- Migration 000015: Add RSVP II status

-- Add new status to team_status enum
ALTER TYPE team_status ADD VALUE 'rsvp2_done';

-- Add RSVP II tracking columns
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS rsvp2_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rsvp2_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rsvp2_selected_members JSONB DEFAULT '[]';

-- Add index for RSVP II queries
CREATE INDEX IF NOT EXISTS idx_teams_rsvp2_locked ON teams(rsvp2_locked);