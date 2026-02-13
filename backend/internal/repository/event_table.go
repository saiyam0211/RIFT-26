package repository

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
)

type EventTableRepository struct {
	db *sql.DB
}

func NewEventTableRepository(db *sql.DB) *EventTableRepository {
	return &EventTableRepository{db: db}
}

// Create creates a new event table
func (r *EventTableRepository) Create(table *models.EventTable) error {
	table.ID = uuid.New()
	query := `
		INSERT INTO event_tables (id, table_name, table_number, city, capacity, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`
	err := r.db.QueryRow(
		query,
		table.ID,
		table.TableName,
		table.TableNumber,
		table.City,
		table.Capacity,
		table.IsActive,
	).Scan(&table.CreatedAt, &table.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create event table: %w", err)
	}

	return nil
}

// GetByID retrieves an event table by ID
func (r *EventTableRepository) GetByID(id uuid.UUID) (*models.EventTable, error) {
	table := &models.EventTable{}
	query := `
		SELECT id, table_name, table_number, city, capacity, is_active, created_at, updated_at
		FROM event_tables
		WHERE id = $1
	`
	err := r.db.QueryRow(query, id).Scan(
		&table.ID,
		&table.TableName,
		&table.TableNumber,
		&table.City,
		&table.Capacity,
		&table.IsActive,
		&table.CreatedAt,
		&table.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("event table not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get event table: %w", err)
	}

	return table, nil
}

// GetAll retrieves all event tables with optional filters
func (r *EventTableRepository) GetAll(city *string, isActive *bool) ([]models.EventTable, error) {
	query := `
		SELECT id, table_name, table_number, city, capacity, is_active, created_at, updated_at
		FROM event_tables
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if city != nil {
		query += fmt.Sprintf(" AND city = $%d", argCount)
		args = append(args, *city)
		argCount++
	}

	if isActive != nil {
		query += fmt.Sprintf(" AND is_active = $%d", argCount)
		args = append(args, *isActive)
		argCount++
	}

	query += " ORDER BY city, table_number"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get event tables: %w", err)
	}
	defer rows.Close()

	tables := []models.EventTable{}
	for rows.Next() {
		var table models.EventTable
		err := rows.Scan(
			&table.ID,
			&table.TableName,
			&table.TableNumber,
			&table.City,
			&table.Capacity,
			&table.IsActive,
			&table.CreatedAt,
			&table.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event table: %w", err)
		}
		tables = append(tables, table)
	}

	return tables, nil
}

// Update updates an event table
func (r *EventTableRepository) Update(table *models.EventTable) error {
	query := `
		UPDATE event_tables
		SET table_name = $1, table_number = $2, city = $3, capacity = $4, is_active = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING updated_at
	`
	err := r.db.QueryRow(
		query,
		table.TableName,
		table.TableNumber,
		table.City,
		table.Capacity,
		table.IsActive,
		table.ID,
	).Scan(&table.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("event table not found")
	}
	if err != nil {
		return fmt.Errorf("failed to update event table: %w", err)
	}

	return nil
}

// Delete deletes an event table
func (r *EventTableRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM event_tables WHERE id = $1`
	result, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete event table: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("event table not found")
	}

	return nil
}
