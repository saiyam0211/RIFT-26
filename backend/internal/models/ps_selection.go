package models

import (
	"time"

	"github.com/google/uuid"
)

// PSSelection represents a team's locked problem statement choice
type PSSelection struct {
	ID                uuid.UUID `json:"id" db:"id"`
	TeamID            uuid.UUID `json:"team_id" db:"team_id"`
	ProblemStatementID uuid.UUID `json:"problem_statement_id" db:"problem_statement_id"`
	LeaderEmail       string    `json:"leader_email" db:"leader_email"`
	LockedAt          time.Time `json:"locked_at" db:"locked_at"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

// PSSelectionWithDetails includes PS name/track for display
type PSSelectionWithDetails struct {
	PSSelection
	TeamName          string `json:"team_name"`
	TeamCity          *City  `json:"team_city"`
	PSTrack           string `json:"ps_track"`
	PSName            string `json:"ps_name"`
}
