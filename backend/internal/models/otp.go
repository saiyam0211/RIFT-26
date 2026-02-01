package models

import (
	"time"

	"github.com/google/uuid"
)

// FirebaseAuthRequest represents the request to verify Firebase ID token
type FirebaseAuthRequest struct {
	IDToken string    `json:"id_token" binding:"required"`
	TeamID  uuid.UUID `json:"team_id" binding:"required"`
}

// FirebaseAuthResponse represents the response after Firebase verification
type FirebaseAuthResponse struct {
	Token       string `json:"token"`
	Team        Team   `json:"team"`
	PhoneNumber string `json:"phone_number"`
}

// OTP model for email-based OTP authentication
type OTP struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	Phone     *string    `json:"phone,omitempty" db:"phone"` // Optional, for backward compatibility
	Email     *string    `json:"email,omitempty" db:"email"` // Email for email-based OTP
	OTPCode   string     `json:"otp_code" db:"otp_code"`
	TeamID    *uuid.UUID `json:"team_id" db:"team_id"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	Verified  bool       `json:"verified" db:"verified"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}
