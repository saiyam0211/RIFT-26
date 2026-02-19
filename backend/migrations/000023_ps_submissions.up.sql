CREATE TABLE IF NOT EXISTS ps_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
    linkedin_url TEXT,
    github_url TEXT,
    live_url TEXT,
    extra_notes TEXT,
    submitted_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id, problem_statement_id)
);

CREATE INDEX IF NOT EXISTS idx_ps_submissions_team ON ps_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_ps_submissions_ps ON ps_submissions(problem_statement_id);

