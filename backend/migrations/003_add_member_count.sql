-- Add member_count column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_teams_member_count ON teams(member_count);

-- Update existing teams with correct member count
UPDATE teams t
SET member_count = (
    SELECT COUNT(*) 
    FROM team_members tm 
    WHERE tm.team_id = t.id
);
