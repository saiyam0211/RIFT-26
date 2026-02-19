ALTER TABLE problem_statements
ADD COLUMN IF NOT EXISTS submission_fields JSONB;

