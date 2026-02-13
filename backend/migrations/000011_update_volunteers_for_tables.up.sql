-- Remove role field and add table_id reference
ALTER TABLE volunteers DROP COLUMN IF EXISTS role;
ALTER TABLE volunteers DROP COLUMN IF EXISTS counter_name;
ALTER TABLE volunteers ADD COLUMN table_id UUID REFERENCES event_tables(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX idx_volunteers_table ON volunteers(table_id);
