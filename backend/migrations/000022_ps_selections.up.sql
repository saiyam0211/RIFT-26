-- Team problem statement selections (which PS each team is working on)
CREATE TABLE IF NOT EXISTS ps_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
    leader_email VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id) -- One PS per team
);

CREATE INDEX IF NOT EXISTS idx_ps_selections_team ON ps_selections(team_id);
CREATE INDEX IF NOT EXISTS idx_ps_selections_ps ON ps_selections(problem_statement_id);
CREATE INDEX IF NOT EXISTS idx_ps_selections_locked ON ps_selections(locked_at);
