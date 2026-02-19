package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"
)

type ProblemStatementRepository struct {
	db *database.DB
}

func NewProblemStatementRepository(db *database.DB) *ProblemStatementRepository {
	return &ProblemStatementRepository{db: db}
}

func (r *ProblemStatementRepository) Create(ctx context.Context, ps *models.PSItem) error {
	ps.ID = uuid.New()
	var submissionFieldsValue interface{}
	if ps.SubmissionFields.Valid {
		submissionFieldsValue = ps.SubmissionFields.String
	} else {
		submissionFieldsValue = nil
	}
	query := `
		INSERT INTO problem_statements (id, track, title, file_path, submission_fields, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query, ps.ID, ps.Track, ps.Name, ps.FilePath, submissionFieldsValue).Scan(&ps.CreatedAt, &ps.UpdatedAt)
}

func (r *ProblemStatementRepository) GetAll(ctx context.Context) ([]models.PSItem, error) {
	query := `
		SELECT id, track, title, file_path, submission_fields, created_at, updated_at
		FROM problem_statements
		ORDER BY created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.PSItem
	for rows.Next() {
		var ps models.PSItem
		if err := rows.Scan(&ps.ID, &ps.Track, &ps.Name, &ps.FilePath, &ps.SubmissionFields, &ps.CreatedAt, &ps.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, ps)
	}
	return list, rows.Err()
}

func (r *ProblemStatementRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.PSItem, error) {
	query := `SELECT id, track, title, file_path, submission_fields, created_at, updated_at FROM problem_statements WHERE id = $1`
	var ps models.PSItem
	err := r.db.QueryRowContext(ctx, query, id).Scan(&ps.ID, &ps.Track, &ps.Name, &ps.FilePath, &ps.SubmissionFields, &ps.CreatedAt, &ps.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &ps, nil
}

func (r *ProblemStatementRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM problem_statements WHERE id = $1`, id)
	return err
}
