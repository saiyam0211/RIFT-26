-- Add missing columns to problem_statements (table may have existed with different schema)
ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS track VARCHAR(100);
ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '';
ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS file_path VARCHAR(512);

UPDATE problem_statements SET name = '' WHERE name IS NULL;
ALTER TABLE problem_statements ALTER COLUMN name SET NOT NULL;
