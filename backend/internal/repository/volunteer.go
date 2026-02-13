package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"

	"github.com/google/uuid"
)

type VolunteerRepository struct {
	db *database.DB
}

func NewVolunteerRepository(db *database.DB) *VolunteerRepository {
	return &VolunteerRepository{db: db}
}

// GetByEmail retrieves a volunteer by email
func (r *VolunteerRepository) GetByEmail(email string) (*models.Volunteer, error) {
	var volunteer models.Volunteer
	query := `
		SELECT v.id, v.email, v.password_hash, v.table_id, v.city, v.is_active, v.created_by, v.created_at, v.updated_at,
		       t.table_name, t.table_number
		FROM volunteers v
		LEFT JOIN event_tables t ON v.table_id = t.id
		WHERE v.email = $1 AND v.is_active = true
	`
	err := r.db.QueryRow(query, email).Scan(
		&volunteer.ID,
		&volunteer.Email,
		&volunteer.PasswordHash,
		&volunteer.TableID,
		&volunteer.City,
		&volunteer.IsActive,
		&volunteer.CreatedBy,
		&volunteer.CreatedAt,
		&volunteer.UpdatedAt,
		&volunteer.TableName,
		&volunteer.TableNumber,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("volunteer not found")
	}
	if err != nil {
		return nil, err
	}
	return &volunteer, nil
}

// GetByID retrieves a volunteer by ID
func (r *VolunteerRepository) GetByID(id uuid.UUID) (*models.Volunteer, error) {
	var volunteer models.Volunteer
	query := `
		SELECT v.id, v.email, v.password_hash, v.table_id, v.city, v.is_active, v.created_by, v.created_at, v.updated_at,
		       t.table_name, t.table_number
		FROM volunteers v
		LEFT JOIN event_tables t ON v.table_id = t.id
		WHERE v.id = $1
	`
	err := r.db.QueryRow(query, id).Scan(
		&volunteer.ID,
		&volunteer.Email,
		&volunteer.PasswordHash,
		&volunteer.TableID,
		&volunteer.City,
		&volunteer.IsActive,
		&volunteer.CreatedBy,
		&volunteer.CreatedAt,
		&volunteer.UpdatedAt,
		&volunteer.TableName,
		&volunteer.TableNumber,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("volunteer not found")
	}
	if err != nil {
		return nil, err
	}
	return &volunteer, nil
}

// Create creates a new volunteer
func (r *VolunteerRepository) Create(volunteer *models.Volunteer) error {
	query := `
		INSERT INTO volunteers (email, password_hash, table_id, city, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at, is_active
	`

	// Handle nil UUID for created_by
	var createdBy interface{}
	if volunteer.CreatedBy != nil && *volunteer.CreatedBy != uuid.Nil {
		createdBy = *volunteer.CreatedBy
	} else {
		createdBy = nil
	}

	return r.db.QueryRow(
		query,
		volunteer.Email,
		volunteer.PasswordHash,
		volunteer.TableID,
		volunteer.City,
		createdBy,
	).Scan(&volunteer.ID, &volunteer.CreatedAt, &volunteer.UpdatedAt, &volunteer.IsActive)
}

// GetAll retrieves all volunteers with optional filters
func (r *VolunteerRepository) GetAll(city *string, tableID *uuid.UUID) ([]models.Volunteer, error) {
	query := `
		SELECT v.id, v.email, v.password_hash, v.table_id, v.city, v.is_active, v.created_by, v.created_at, v.updated_at,
		       t.table_name, t.table_number
		FROM volunteers v
		LEFT JOIN event_tables t ON v.table_id = t.id
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if city != nil && *city != "" {
		query += fmt.Sprintf(" AND v.city = $%d", argCount)
		args = append(args, *city)
		argCount++
	}

	if tableID != nil {
		query += fmt.Sprintf(" AND v.table_id = $%d", argCount)
		args = append(args, *tableID)
		argCount++
	}

	query += " ORDER BY v.created_at DESC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var volunteers []models.Volunteer
	for rows.Next() {
		var volunteer models.Volunteer
		err := rows.Scan(
			&volunteer.ID,
			&volunteer.Email,
			&volunteer.PasswordHash,
			&volunteer.TableID,
			&volunteer.City,
			&volunteer.IsActive,
			&volunteer.CreatedBy,
			&volunteer.CreatedAt,
			&volunteer.UpdatedAt,
			&volunteer.TableName,
			&volunteer.TableNumber,
		)
		if err != nil {
			return nil, err
		}
		volunteers = append(volunteers, volunteer)
	}

	return volunteers, nil
}

// Update updates a volunteer
func (r *VolunteerRepository) Update(volunteer *models.Volunteer) error {
	query := `
		UPDATE volunteers
		SET email = $1, table_id = $2, city = $3, is_active = $4, updated_at = NOW()
		WHERE id = $5
	`
	_, err := r.db.Exec(
		query,
		volunteer.Email,
		volunteer.TableID,
		volunteer.City,
		volunteer.IsActive,
		volunteer.ID,
	)
	return err
}

// Delete deletes a volunteer
func (r *VolunteerRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM volunteers WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// LogActivity logs a volunteer activity
func (r *VolunteerRepository) LogActivity(log *models.VolunteerLog) error {
	// Convert details map to JSON
	detailsJSON, err := json.Marshal(log.Details)
	if err != nil {
		return fmt.Errorf("failed to marshal details: %w", err)
	}

	query := `
		INSERT INTO volunteer_logs (volunteer_id, action, details)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`
	return r.db.QueryRow(query, log.VolunteerID, log.Action, detailsJSON).Scan(&log.ID, &log.CreatedAt)
}

// GetLogs retrieves activity logs for a volunteer
func (r *VolunteerRepository) GetLogs(volunteerID uuid.UUID, limit int) ([]models.VolunteerLog, error) {
	query := `
		SELECT id, volunteer_id, action, details, created_at
		FROM volunteer_logs
		WHERE volunteer_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.Query(query, volunteerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.VolunteerLog
	for rows.Next() {
		var log models.VolunteerLog
		var detailsJSON []byte
		err := rows.Scan(
			&log.ID,
			&log.VolunteerID,
			&log.Action,
			&detailsJSON,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Unmarshal JSON details
		if len(detailsJSON) > 0 {
			if err := json.Unmarshal(detailsJSON, &log.Details); err != nil {
				return nil, fmt.Errorf("failed to unmarshal details: %w", err)
			}
		}

		logs = append(logs, log)
	}

	return logs, nil
}
