package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type UserRepository struct {
	db *database.DB
}

func NewUserRepository(db *database.DB) *UserRepository {
	return &UserRepository{db: db}
}

// GetByEmail retrieves a user by email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, name, role, created_at, updated_at
		FROM users WHERE email = $1
	`

	var user models.User
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name,
		&user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}

	return &user, nil
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, name, role, created_at, updated_at
		FROM users WHERE id = $1
	`

	var user models.User
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name,
		&user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}

	return &user, nil
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, email, password, name string, role models.UserRole) (*models.User, error) {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	query := `
		INSERT INTO users (email, password_hash, name, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, password_hash, name, role, created_at, updated_at
	`

	var user models.User
	err = r.db.QueryRowContext(ctx, query, email, string(hashedPassword), name, role).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name,
		&user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

// ValidatePassword checks if the provided password matches the user's hashed password
func (r *UserRepository) ValidatePassword(user *models.User, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	return err == nil
}
