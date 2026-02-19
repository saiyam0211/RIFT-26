DROP INDEX IF EXISTS idx_ps_submissions_custom_fields;
ALTER TABLE ps_submissions DROP COLUMN IF EXISTS custom_fields;
