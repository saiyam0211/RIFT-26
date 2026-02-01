package models

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserRole string

const (
	UserRoleParticipant UserRole = "participant"
	UserRoleVolunteer   UserRole = "volunteer"
	UserRoleAdmin       UserRole = "admin"
)

type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Name         string    `json:"name" db:"name"`
	Role         UserRole  `json:"role" db:"role"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// ComparePassword compares a plaintext password with the hashed password
func (u *User) ComparePassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

// GenerateJWT generates a JWT token for the user
func (u *User) GenerateJWT(jwtSecret string) (string, error) {
	// Create claims
	claims := jwt.MapClaims{
		"user_id": u.ID.String(),
		"email":   u.Email,
		"role":    string(u.Role),
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
		"nbf":     time.Now().Unix(),
		"iss":     "rift26-api",
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// Request DTOs
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
