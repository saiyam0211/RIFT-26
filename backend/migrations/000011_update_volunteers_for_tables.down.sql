-- Rollback volunteers table changes
ALTER TABLE volunteers DROP COLUMN IF EXISTS table_id;
ALTER TABLE volunteers ADD COLUMN role VARCHAR(20);
ALTER TABLE volunteers ADD COLUMN counter_name VARCHAR(100);
