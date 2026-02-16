package models

import (
	"time"

	"github.com/google/uuid"
)

// Volunteer represents a volunteer user in the system
type Volunteer struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	Email        string     `json:"email" db:"email"`
	PasswordHash string     `json:"-" db:"password_hash"`
	TableID      *uuid.UUID `json:"table_id" db:"table_id"`
	City         string     `json:"city" db:"city"`
	IsActive     bool       `json:"is_active" db:"is_active"`
	CreatedBy    *uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`

	// Joined fields (not in DB)
	TableName   *string `json:"table_name,omitempty" db:"-"`
	TableNumber *string `json:"table_number,omitempty" db:"-"`
}

// VolunteerLog represents an activity log entry for a volunteer
type VolunteerLog struct {
	ID          uuid.UUID              `json:"id" db:"id"`
	VolunteerID uuid.UUID              `json:"volunteer_id" db:"volunteer_id"`
	Action      string                 `json:"action" db:"action"`
	Details     map[string]interface{} `json:"details" db:"details"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
}

// VolunteerLoginRequest represents the login request payload
type VolunteerLoginRequest struct {
	Email   string     `json:"email" binding:"required,email"`
	Password string     `json:"password" binding:"required"`
	TableID  *uuid.UUID `json:"table_id"` // Optional: volunteer selects table during login
}

// VolunteerLoginResponse represents the login response
type VolunteerLoginResponse struct {
	Token     string    `json:"token"`
	Volunteer Volunteer `json:"volunteer"`
}

// CreateVolunteerRequest represents the request to create a new volunteer
type CreateVolunteerRequest struct {
	Email    string     `json:"email" binding:"required,email"`
	Password string     `json:"password" binding:"required,min=6"`
	TableID  *uuid.UUID `json:"table_id"` // Optional: can be assigned later
	City     string     `json:"city" binding:"required"`
}
