package repository

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"
)

type VolunteerAdminRepository struct {
	db *database.DB
}

func NewVolunteerAdminRepository(db *database.DB) *VolunteerAdminRepository {
	return &VolunteerAdminRepository{db: db}
}

func (r *VolunteerAdminRepository) GetByEmail(email string) (*models.VolunteerAdmin, error) {
	var v models.VolunteerAdmin
	query := `SELECT id, email, password_hash, city, is_active, created_by, created_at, updated_at
	          FROM volunteer_admins WHERE email = $1 AND is_active = true`
	err := r.db.QueryRow(query, email).Scan(
		&v.ID, &v.Email, &v.PasswordHash, &v.City, &v.IsActive, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("volunteer admin not found")
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *VolunteerAdminRepository) GetByID(id uuid.UUID) (*models.VolunteerAdmin, error) {
	var v models.VolunteerAdmin
	query := `SELECT id, email, password_hash, city, is_active, created_by, created_at, updated_at
	          FROM volunteer_admins WHERE id = $1`
	err := r.db.QueryRow(query, id).Scan(
		&v.ID, &v.Email, &v.PasswordHash, &v.City, &v.IsActive, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("volunteer admin not found")
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *VolunteerAdminRepository) Create(v *models.VolunteerAdmin) error {
	query := `INSERT INTO volunteer_admins (email, password_hash, city, created_by)
	          VALUES ($1, $2, $3, $4)
	          RETURNING id, created_at, updated_at, is_active`
	var createdBy interface{}
	if v.CreatedBy != nil && *v.CreatedBy != uuid.Nil {
		createdBy = *v.CreatedBy
	} else {
		createdBy = nil
	}
	return r.db.QueryRow(query, v.Email, v.PasswordHash, v.City, createdBy).
		Scan(&v.ID, &v.CreatedAt, &v.UpdatedAt, &v.IsActive)
}

func (r *VolunteerAdminRepository) GetAll() ([]models.VolunteerAdmin, error) {
	query := `SELECT id, email, city, is_active, created_by, created_at, updated_at
	          FROM volunteer_admins ORDER BY created_at DESC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.VolunteerAdmin
	for rows.Next() {
		var v models.VolunteerAdmin
		err := rows.Scan(&v.ID, &v.Email, &v.City, &v.IsActive, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, nil
}

func (r *VolunteerAdminRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM volunteer_admins WHERE id = $1`, id)
	return err
}
