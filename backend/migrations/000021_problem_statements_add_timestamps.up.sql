-- Add missing timestamp columns to problem_statements
ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
