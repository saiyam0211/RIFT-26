-- Drop the tables created in migration 000012
DROP TABLE IF EXISTS table_confirmations;
DROP TABLE IF EXISTS participant_check_ins;

-- Remove column from teams table
ALTER TABLE teams DROP COLUMN IF EXISTS volunteer_table_id;
