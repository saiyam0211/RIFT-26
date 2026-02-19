package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

type DB struct {
	*sql.DB
}

// ensureProblemStatementSubmissionFields adds submission_fields column if missing (idempotent).
func ensureProblemStatementSubmissionFields(db *sql.DB) {
	if _, err := db.Exec(`ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS submission_fields JSONB`); err != nil {
		log.Printf("[migration] problem_statements.submission_fields: %v", err)
	}
}

// ensurePSSelectionsTable creates ps_selections table if missing (idempotent).
func ensurePSSelectionsTable(db *sql.DB) {
	const ddl = `
CREATE TABLE IF NOT EXISTS ps_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
    leader_email VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id)
);

CREATE INDEX IF NOT EXISTS idx_ps_selections_team ON ps_selections(team_id);
CREATE INDEX IF NOT EXISTS idx_ps_selections_ps ON ps_selections(problem_statement_id);
CREATE INDEX IF NOT EXISTS idx_ps_selections_locked ON ps_selections(locked_at);
`
	if _, err := db.Exec(ddl); err != nil {
		log.Printf("[migration] ps_selections: %v", err)
	}
}

func NewPostgresDB(databaseURL string) (*DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Ensure problem_statements has submission_fields (safe if column already exists)
	ensureProblemStatementSubmissionFields(db)
	// Ensure ps_selections table exists for PS locking
	ensurePSSelectionsTable(db)

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	// Disable prepared statement caching to avoid connection pooling issues
	db.SetConnMaxLifetime(0) // Keep connections alive indefinitely

	return &DB{db}, nil
}

func (db *DB) Close() error {
	return db.DB.Close()
}
