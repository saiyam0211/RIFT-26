package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"
)

type PSSubmissionRepository struct {
	db *database.DB
}

func NewPSSubmissionRepository(db *database.DB) *PSSubmissionRepository {
	return &PSSubmissionRepository{db: db}
}

func (r *PSSubmissionRepository) GetByTeamAndPS(ctx context.Context, teamID, psID uuid.UUID) (*models.PSSubmission, error) {
	query := `
		SELECT id, team_id, problem_statement_id, linkedin_url, github_url, live_url, extra_notes, custom_fields,
		       submitted_at, created_at, updated_at
		FROM ps_submissions
		WHERE team_id = $1 AND problem_statement_id = $2
	`
	var sub models.PSSubmission
	err := r.db.QueryRowContext(ctx, query, teamID, psID).Scan(
		&sub.ID, &sub.TeamID, &sub.ProblemStatementID,
		&sub.LinkedinURL, &sub.GithubURL, &sub.LiveURL, &sub.ExtraNotes, &sub.CustomFields,
		&sub.SubmittedAt, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		// Return nil if not found; caller can treat as no submission yet
		return nil, err
	}
	return &sub, nil
}

func (r *PSSubmissionRepository) Upsert(ctx context.Context, sub *models.PSSubmission) error {
	if sub.ID == uuid.Nil {
		sub.ID = uuid.New()
	}
	var customFieldsValue interface{}
	if sub.CustomFields.Valid {
		customFieldsValue = sub.CustomFields.String
	} else {
		customFieldsValue = nil
	}
	query := `
		INSERT INTO ps_submissions (
			id, team_id, problem_statement_id, linkedin_url, github_url, live_url, extra_notes, custom_fields,
			submitted_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			NOW(), NOW(), NOW()
		)
		ON CONFLICT (team_id, problem_statement_id) DO UPDATE SET
			linkedin_url = EXCLUDED.linkedin_url,
			github_url = EXCLUDED.github_url,
			live_url = EXCLUDED.live_url,
			extra_notes = EXCLUDED.extra_notes,
			custom_fields = EXCLUDED.custom_fields,
			submitted_at = NOW(),
			updated_at = NOW()
		RETURNING submitted_at, created_at, updated_at
	`
	if err := r.db.QueryRowContext(
		ctx,
		query,
		sub.ID, sub.TeamID, sub.ProblemStatementID,
		sub.LinkedinURL, sub.GithubURL, sub.LiveURL, sub.ExtraNotes, customFieldsValue,
	).Scan(&sub.SubmittedAt, &sub.CreatedAt, &sub.UpdatedAt); err != nil {
		return fmt.Errorf("upsert ps_submission: %w", err)
	}
	return nil
}

// JudgingRow is one row for the judging view: team + PS + submission fields.
type JudgingRow struct {
	TeamID             uuid.UUID  `json:"team_id"`
	TeamName           string     `json:"team_name"`
	City               *string    `json:"city"`
	LeaderName         string     `json:"leader_name"`
	LeaderEmail        string     `json:"leader_email"`
	MemberNames        string     `json:"member_names"` // comma-separated
	ProblemStatementID uuid.UUID  `json:"problem_statement_id"`
	PSTrack            string     `json:"ps_track"`
	PSName             string     `json:"ps_name"`
	LinkedinURL        string     `json:"linkedin_url"`
	GithubURL          string     `json:"github_url"`
	LiveURL            string     `json:"live_url"`
	ExtraNotes         string     `json:"extra_notes"`
	CustomFieldsJSON   sql.NullString `json:"-" db:"custom_fields"`
	PSFieldsJSON       sql.NullString `json:"-" db:"ps_submission_fields"` // submission_fields from problem_statements
	SubmittedAt        string     `json:"submitted_at"`
}

// GetAllForJudging returns all submissions with team and PS details, optional city and PS filters.
func (r *PSSubmissionRepository) GetAllForJudging(ctx context.Context, city *string, psID *uuid.UUID) ([]JudgingRow, error) {
	query := `
		SELECT 
			t.id AS team_id, t.team_name, t.city,
			(SELECT name FROM team_members WHERE team_id = t.id AND role = 'leader' LIMIT 1),
			(SELECT email FROM team_members WHERE team_id = t.id AND role = 'leader' LIMIT 1),
			(SELECT string_agg(name, ', ' ORDER BY role DESC, name) FROM team_members WHERE team_id = t.id),
			s.problem_statement_id, pst.track AS ps_track, pst.title AS ps_name,
			COALESCE(s.linkedin_url,''), COALESCE(s.github_url,''), COALESCE(s.live_url,''), COALESCE(s.extra_notes,''),
			s.custom_fields, pst.submission_fields, s.submitted_at
		FROM ps_submissions s
		JOIN teams t ON s.team_id = t.id
		JOIN problem_statements pst ON s.problem_statement_id = pst.id
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1
	if city != nil && *city != "" {
		query += fmt.Sprintf(" AND t.city = $%d", argNum)
		args = append(args, *city)
		argNum++
	}
	if psID != nil && *psID != uuid.Nil {
		query += fmt.Sprintf(" AND s.problem_statement_id = $%d", argNum)
		args = append(args, *psID)
		argNum++
	}
	query += " ORDER BY s.submitted_at DESC"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []JudgingRow
	for rows.Next() {
		var row JudgingRow
		var submittedAt interface{}
		var leaderName, leaderEmail, memberNames sql.NullString
		err := rows.Scan(&row.TeamID, &row.TeamName, &row.City,
			&leaderName, &leaderEmail, &memberNames,
			&row.ProblemStatementID, &row.PSTrack, &row.PSName,
			&row.LinkedinURL, &row.GithubURL, &row.LiveURL, &row.ExtraNotes,
			&row.CustomFieldsJSON, &row.PSFieldsJSON, &submittedAt)
		if err != nil {
			return nil, err
		}
		if leaderName.Valid {
			row.LeaderName = leaderName.String
		}
		if leaderEmail.Valid {
			row.LeaderEmail = leaderEmail.String
		}
		if memberNames.Valid {
			row.MemberNames = memberNames.String
		}
		if t, ok := submittedAt.(interface{ Format(string) string }); ok {
			row.SubmittedAt = t.Format("2006-01-02 15:04:05")
		} else {
			row.SubmittedAt = fmt.Sprint(submittedAt)
		}
		list = append(list, row)
	}
	return list, rows.Err()
}

