package repository

import (
	"context"
	"database/sql"
	"fmt"

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
	query := `SELECT id, team_id, problem_statement_id, leader_email, locked_at, created_at, updated_at, is_semi_finalist, position, best_web3 FROM ps_selections WHERE team_id = $1`
	var sel models.PSSelection
	var pos sql.NullInt32
	err := r.db.QueryRowContext(ctx, query, teamID).Scan(&sel.ID, &sel.TeamID, &sel.ProblemStatementID, &sel.LeaderEmail, &sel.LockedAt, &sel.CreatedAt, &sel.UpdatedAt, &sel.IsSemiFinalist, &pos, &sel.BestWeb3)
	if err != nil {
		return nil, err
	}
	if pos.Valid {
		v := int(pos.Int32)
		sel.Position = &v
	}
	return &sel, nil
}

func (r *PSSelectionRepository) GetAllWithDetails(ctx context.Context, city *string) ([]models.PSSelectionWithDetails, error) {
	query := `
		SELECT 
			ps.id, ps.team_id, ps.problem_statement_id, ps.leader_email, ps.locked_at, ps.created_at, ps.updated_at, ps.is_semi_finalist, ps.position, ps.best_web3,
			t.team_name, t.city AS team_city,
			tm.name AS leader_name, tm.email AS leader_email,
			pst.track AS ps_track, pst.title AS ps_name
		FROM ps_selections ps
		JOIN teams t ON ps.team_id = t.id
		LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.role = 'leader'
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
		var pos sql.NullInt32
		err := rows.Scan(&sel.ID, &sel.TeamID, &sel.ProblemStatementID, &sel.LeaderEmail, &sel.LockedAt, &sel.CreatedAt, &sel.UpdatedAt, &sel.IsSemiFinalist, &pos, &sel.BestWeb3,
			&sel.TeamName, &cityStr, &sel.LeaderName, &sel.LeaderEmail, &sel.PSTrack, &sel.PSName)
		if err != nil {
			return nil, err
		}
		if pos.Valid {
			v := int(pos.Int32)
			sel.Position = &v
		}
		if cityStr != nil {
			city := models.City(*cityStr)
			sel.TeamCity = &city
		}
		list = append(list, sel)
	}
	return list, rows.Err()
}

// SetSemiFinalist updates is_semi_finalist flag for a team's selection.
func (r *PSSelectionRepository) SetSemiFinalist(ctx context.Context, teamID uuid.UUID, semi bool) error {
	query := `UPDATE ps_selections SET is_semi_finalist = $1, updated_at = NOW() WHERE team_id = $2`
	res, err := r.db.ExecContext(ctx, query, semi, teamID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("no selection found for team")
	}
	return nil
}

// GetSemiFinalistsWithDetails returns only semi-finalist selections with team and PS info.
func (r *PSSelectionRepository) GetSemiFinalistsWithDetails(ctx context.Context, city *string) ([]models.PSSelectionWithDetails, error) {
	query := `
		SELECT 
			ps.id, ps.team_id, ps.problem_statement_id, ps.leader_email, ps.locked_at, ps.created_at, ps.updated_at, ps.is_semi_finalist, ps.position, ps.best_web3,
			t.team_name, t.city AS team_city,
			tm.name AS leader_name, tm.email AS leader_email,
			pst.track AS ps_track, pst.title AS ps_name
		FROM ps_selections ps
		JOIN teams t ON ps.team_id = t.id
		LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.role = 'leader'
		JOIN problem_statements pst ON ps.problem_statement_id = pst.id
		WHERE t.status = 'checked_in' AND ps.is_semi_finalist = TRUE
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
		var pos sql.NullInt32
		err := rows.Scan(&sel.ID, &sel.TeamID, &sel.ProblemStatementID, &sel.LeaderEmail, &sel.LockedAt, &sel.CreatedAt, &sel.UpdatedAt, &sel.IsSemiFinalist, &pos, &sel.BestWeb3,
			&sel.TeamName, &cityStr, &sel.LeaderName, &sel.LeaderEmail, &sel.PSTrack, &sel.PSName)
		if err != nil {
			return nil, err
		}
		if pos.Valid {
			v := int(pos.Int32)
			sel.Position = &v
		}
		if cityStr != nil {
			city := models.City(*cityStr)
			sel.TeamCity = &city
		}
		list = append(list, sel)
	}
	return list, rows.Err()
}

// SetAwards updates position and best_web3 for a team's selection.
func (r *PSSelectionRepository) SetAwards(ctx context.Context, teamID uuid.UUID, position *int, bestWeb3 bool) error {
	query := `UPDATE ps_selections SET position = $1, best_web3 = $2, updated_at = NOW() WHERE team_id = $3`
	var posVal interface{}
	if position == nil {
		posVal = nil
	} else {
		posVal = *position
	}
	res, err := r.db.ExecContext(ctx, query, posVal, bestWeb3, teamID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("no selection found for team")
	}
	return nil
}
