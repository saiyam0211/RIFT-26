-- Problem statements (tracks) with PDF uploads, released at 11 AM 19 Feb or when admin triggers early
CREATE TABLE IF NOT EXISTS problem_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_statements_created ON problem_statements(created_at);

-- Key-value store for release override (e.g. ps_released_at for testing)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
