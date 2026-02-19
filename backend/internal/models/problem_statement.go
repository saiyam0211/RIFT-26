package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// PSItem is a problem statement (track) PDF stored in problem_statements table.
type PSItem struct {
	ID               uuid.UUID      `json:"id" db:"id"`
	Track            string         `json:"track" db:"track"`
	Name             string         `json:"name" db:"title"` // DB column is "title"
	FilePath         string         `json:"file_path" db:"file_path"`
	SubmissionFields sql.NullString `json:"submission_fields,omitempty" db:"submission_fields"`
	CreatedAt        time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at" db:"updated_at"`
}

// PublicResponse omits internal file_path and exposes download URL
type ProblemStatementPublic struct {
	ID         string `json:"id"`
	Track      string `json:"track"`
	Name       string `json:"name"`
	DownloadURL string `json:"download_url"`
	CreatedAt  string `json:"created_at"`
}
