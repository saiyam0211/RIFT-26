package models

import (
	"time"

	"github.com/google/uuid"
)

// VolunteerAdmin is a city-scoped admin who can view volunteers, check-ins, and seat data for their city.
type VolunteerAdmin struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	Email        string     `json:"email" db:"email"`
	PasswordHash string     `json:"-" db:"password_hash"`
	City         string     `json:"city" db:"city"`
	IsActive     bool       `json:"is_active" db:"is_active"`
	CreatedBy    *uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// VolunteerAdminLoginRequest is the login payload.
type VolunteerAdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// VolunteerAdminLoginResponse is the login response with token and city.
type VolunteerAdminLoginResponse struct {
	Token   string `json:"token"`
	Email   string `json:"email"`
	City    string `json:"city"`
	Message string `json:"message,omitempty"`
}

// CreateVolunteerAdminRequest is used by organiser admin to create a volunteer admin.
type CreateVolunteerAdminRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	City     string `json:"city" binding:"required"`
}
