package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type PSSubmission struct {
	ID                 uuid.UUID      `json:"id" db:"id"`
	TeamID             uuid.UUID      `json:"team_id" db:"team_id"`
	ProblemStatementID uuid.UUID      `json:"problem_statement_id" db:"problem_statement_id"`
	LinkedinURL        string          `json:"linkedin_url" db:"linkedin_url"`
	GithubURL          string          `json:"github_url" db:"github_url"`
	LiveURL            string          `json:"live_url" db:"live_url"`
	ExtraNotes         string          `json:"extra_notes" db:"extra_notes"`
	CustomFields       sql.NullString `json:"custom_fields,omitempty" db:"custom_fields"`
	SubmittedAt        time.Time      `json:"submitted_at" db:"submitted_at"`
	CreatedAt          time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at" db:"updated_at"`
}

