package services

import (
	"fmt"
	"os"
	"time"

	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type VolunteerService struct {
	repo *repository.VolunteerRepository
}

func NewVolunteerService(repo *repository.VolunteerRepository) *VolunteerService {
	return &VolunteerService{repo: repo}
}

// Login authenticates a volunteer and returns a JWT token
func (s *VolunteerService) Login(email, password string, sessionTableID *uuid.UUID) (*models.VolunteerLoginResponse, error) {
	volunteer, err := s.repo.GetByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(volunteer.PasswordHash), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// Generate JWT token with session table_id (overrides DB table_id if provided)
	token, err := s.generateToken(volunteer, sessionTableID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token")
	}

	// Log login activity
	_ = s.repo.LogActivity(&models.VolunteerLog{
		VolunteerID: volunteer.ID,
		Action:      "login",
		Details: map[string]interface{}{
			"timestamp":        time.Now(),
			"session_table_id": sessionTableID,
		},
	})

	return &models.VolunteerLoginResponse{
		Token:     token,
		Volunteer: *volunteer,
	}, nil
}

// generateToken creates a JWT token for a volunteer
func (s *VolunteerService) generateToken(volunteer *models.Volunteer, sessionTableID *uuid.UUID) (string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-secret-key-change-in-production"
	}

	// Use the standard Claims struct to ensure compatibility with ValidateJWT
	// This ensures the role is properly typed as models.UserRole
	claims := jwt.MapClaims{
		"user_id": volunteer.ID.String(), // Required by AuthMiddleware
		"email":   volunteer.Email,
		"city":    volunteer.City,
		"role":    string(models.UserRoleVolunteer), // Must be "volunteer" string for models.UserRole
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
		"nbf":     time.Now().Unix(),
		"iss":     "rift26-api",
	}

	// Use session table_id if provided (from login), otherwise use DB table_id
	// This allows volunteers to select a table during login for this session
	tableIDToUse := sessionTableID
	if tableIDToUse == nil {
		tableIDToUse = volunteer.TableID
	}

	if tableIDToUse != nil {
		claims["table_id"] = tableIDToUse.String()
	}
	if volunteer.TableName != nil {
		claims["table_name"] = *volunteer.TableName
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// VerifyToken verifies a volunteer JWT token and returns the volunteer
func (s *VolunteerService) VerifyToken(tokenString string) (*models.Volunteer, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-secret-key-change-in-production"
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Check if this is a volunteer token
	tokenType, _ := claims["type"].(string)
	if tokenType != "volunteer" {
		return nil, fmt.Errorf("invalid token type")
	}

	volunteerIDStr, ok := claims["volunteer_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid volunteer ID in token")
	}

	volunteerID, err := uuid.Parse(volunteerIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid volunteer ID format")
	}

	return s.repo.GetByID(volunteerID)
}

// GetByID retrieves a volunteer by ID (wraps repo method)
func (s *VolunteerService) GetByID(id uuid.UUID) (*models.Volunteer, error) {
	return s.repo.GetByID(id)
}

// CreateVolunteer creates a new volunteer (admin only)
func (s *VolunteerService) CreateVolunteer(req *models.CreateVolunteerRequest, adminID uuid.UUID) (*models.Volunteer, error) {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password")
	}

	// Only set CreatedBy if we have a valid admin ID
	var createdBy *uuid.UUID
	if adminID != uuid.Nil {
		createdBy = &adminID
	}

	volunteer := &models.Volunteer{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		TableID:      req.TableID,
		City:         req.City,
		CreatedBy:    createdBy,
	}

	err = s.repo.Create(volunteer)
	if err != nil {
		return nil, err
	}

	return volunteer, nil
}

// GetAllVolunteers retrieves all volunteers with optional filters
func (s *VolunteerService) GetAllVolunteers(city *string, tableID *uuid.UUID) ([]models.Volunteer, error) {
	return s.repo.GetAll(city, tableID)
}

// GetVolunteerLogs retrieves activity logs for a volunteer
func (s *VolunteerService) GetVolunteerLogs(volunteerID uuid.UUID, limit int) ([]models.VolunteerLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.GetLogs(volunteerID, limit)
}

// UpdateVolunteer updates a volunteer
func (s *VolunteerService) UpdateVolunteer(volunteer *models.Volunteer) error {
	return s.repo.Update(volunteer)
}

// DeleteVolunteer deletes a volunteer
func (s *VolunteerService) DeleteVolunteer(id uuid.UUID) error {
	return s.repo.Delete(id)
}

// LogActivity logs a volunteer activity
func (s *VolunteerService) LogActivity(volunteerID uuid.UUID, action string, details map[string]interface{}) error {
	return s.repo.LogActivity(&models.VolunteerLog{
		VolunteerID: volunteerID,
		Action:      action,
		Details:     details,
	})
}
