package models

import (
	"time"

	"github.com/google/uuid"
)

// EventTable represents a physical table at the event
type EventTable struct {
	ID          uuid.UUID `json:"id" db:"id"`
	TableName   string    `json:"table_name" db:"table_name"`
	TableNumber string    `json:"table_number" db:"table_number"`
	City        string    `json:"city" db:"city"`
	Capacity    int       `json:"capacity" db:"capacity"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// CreateEventTableRequest represents the request to create a new table
type CreateEventTableRequest struct {
	TableName   string `json:"table_name" binding:"required"`
	TableNumber string `json:"table_number" binding:"required"`
	City        string `json:"city" binding:"required"`
	Capacity    int    `json:"capacity"`
}

// UpdateEventTableRequest represents the request to update a table
type UpdateEventTableRequest struct {
	TableName string `json:"table_name"`
	Capacity  int    `json:"capacity"`
	IsActive  *bool  `json:"is_active"`
}
