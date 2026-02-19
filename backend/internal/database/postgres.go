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
	_, err := db.Exec(`ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS submission_fields JSONB`)
	if err != nil {
		log.Printf("[migration] problem_statements.submission_fields: %v", err)
		return
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
