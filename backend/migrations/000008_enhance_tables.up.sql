-- Migration 000008: Enhance tickets, announcements, and add email logs
-- This updates existing tables and creates new ones

-- 1. Update support_tickets table (add missing columns)
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS message TEXT,
ADD COLUMN IF NOT EXISTS resolution TEXT;

-- Create index for faster queries on support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_team_id ON support_tickets(team_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- 2. Update announcements table (add filters for targeted announcements)
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';

-- Create GIN index for filters
CREATE INDEX IF NOT EXISTS idx_announcements_filters ON announcements USING GIN (filters);

-- 3. Add edit_allowed_until to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS edit_allowed_until TIMESTAMP WITH TIME ZONE;

-- 4. Create email_logs table for tracking bulk emails
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject VARCHAR(255) NOT NULL,
    recipients JSONB NOT NULL,
    html_content TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    sent_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_by ON email_logs(created_by);

-- 5. Update support_tickets to use text for resolved_by (email instead of user ID)
-- First, check if column exists and is UUID type
DO $$
BEGIN
    -- Add a new column for admin email
    ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_by_email VARCHAR(255);
    
    -- If you want to migrate data from resolved_by (UUID) to email, you can do:
    -- UPDATE support_tickets SET resolved_by_email = (SELECT email FROM users WHERE id = resolved_by);
END $$;

COMMENT ON TABLE support_tickets IS 'Support tickets raised by teams';
COMMENT ON TABLE announcements IS 'Announcements with filtering capabilities';
COMMENT ON TABLE email_logs IS 'Log of all bulk emails sent through the system';
COMMENT ON COLUMN teams.edit_allowed_until IS 'Timestamp until which team can edit their details post-RSVP';
COMMENT ON COLUMN announcements.filters IS 'JSON filters for targeting specific teams (team_sizes, cities, team_ids)';
