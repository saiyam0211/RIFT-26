package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"
)

type PSSelectionRepository struct {
	db *database.DB
}

func NewPSSelectionRepository(db *database.DB) *PSSelectionRepository {
	return &PSSelectionRepository{db: db}
}

func (r *PSSelectionRepository) Create(ctx context.Context, sel *models.PSSelection) error {
	sel.ID = uuid.New()
	query := `
		INSERT INTO ps_selections (id, team_id, problem_statement_id, leader_email, locked_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
		ON CONFLICT (team_id) DO UPDATE SET
			problem_statement_id = EXCLUDED.problem_statement_id,
			leader_email = EXCLUDED.leader_email,
			locked_at = NOW(),
			updated_at = NOW()
		RETURNING locked_at, created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query, sel.ID, sel.TeamID, sel.ProblemStatementID, sel.LeaderEmail).Scan(&sel.LockedAt, &sel.CreatedAt, &sel.UpdatedAt)
}

func (r *PSSelectionRepository) GetByTeamID(ctx context.Context, teamID uuid.UUID) (*models.PSSelection, error) {
	query := `SELECT id, team_id, problem_statement_id, leader_email, locked_at, created_at, updated_at FROM ps_selections WHERE team_id = $1`
	var sel models.PSSelection
	err := r.db.QueryRowContext(ctx, query, teamID).Scan(&sel.ID, &sel.TeamID, &sel.ProblemStatementID, &sel.LeaderEmail, &sel.LockedAt, &sel.CreatedAt, &sel.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sel, nil
}

func (r *PSSelectionRepository) GetAllWithDetails(ctx context.Context, city *string) ([]models.PSSelectionWithDetails, error) {
	query := `
		SELECT 
			ps.id, ps.team_id, ps.problem_statement_id, ps.leader_email, ps.locked_at, ps.created_at, ps.updated_at,
			t.team_name, t.city AS team_city,
			pst.track AS ps_track, pst.title AS ps_name
		FROM ps_selections ps
		JOIN teams t ON ps.team_id = t.id
		JOIN problem_statements pst ON ps.problem_statement_id = pst.id
		WHERE t.status = 'checked_in'
	`
	args := []interface{}{}
	if city != nil && *city != "" {
		query += " AND t.city = $1"
		args = append(args, *city)
	}
	query += " ORDER BY ps.locked_at DESC"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.PSSelectionWithDetails
	for rows.Next() {
		var sel models.PSSelectionWithDetails
		var cityStr *string
		err := rows.Scan(&sel.ID, &sel.TeamID, &sel.ProblemStatementID, &sel.LeaderEmail, &sel.LockedAt, &sel.CreatedAt, &sel.UpdatedAt,
			&sel.TeamName, &cityStr, &sel.PSTrack, &sel.PSName)
		if err != nil {
			return nil, err
		}
		if cityStr != nil {
			city := models.City(*cityStr)
			sel.TeamCity = &city
		}
		list = append(list, sel)
	}
	return list, rows.Err()
}
