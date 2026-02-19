ALTER TABLE ps_submissions
ADD COLUMN IF NOT EXISTS custom_fields JSONB;

CREATE INDEX IF NOT EXISTS idx_ps_submissions_custom_fields ON ps_submissions USING GIN(custom_fields);
