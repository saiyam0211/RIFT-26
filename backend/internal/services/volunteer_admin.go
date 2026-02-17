package services

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type VolunteerAdminService struct {
	repo *repository.VolunteerAdminRepository
}

func NewVolunteerAdminService(repo *repository.VolunteerAdminRepository) *VolunteerAdminService {
	return &VolunteerAdminService{repo: repo}
}

func (s *VolunteerAdminService) Login(email, password string) (*models.VolunteerAdminLoginResponse, error) {
	v, err := s.repo.GetByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(v.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	token, err := s.generateToken(v)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token")
	}
	return &models.VolunteerAdminLoginResponse{
		Token: token,
		Email: v.Email,
		City:  v.City,
	}, nil
}

func (s *VolunteerAdminService) generateToken(v *models.VolunteerAdmin) (string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-secret-key-change-in-production"
	}
	claims := jwt.MapClaims{
		"user_id": v.ID.String(),
		"email":   v.Email,
		"city":    v.City,
		"role":    string(models.UserRoleVolunteerAdmin),
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
		"iss":     "rift26-api",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func (s *VolunteerAdminService) Create(req *models.CreateVolunteerAdminRequest, createdBy uuid.UUID) (*models.VolunteerAdmin, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}
	v := &models.VolunteerAdmin{
		Email:        req.Email,
		PasswordHash: string(hash),
		City:         req.City,
		IsActive:     true,
		CreatedBy:    &createdBy,
	}
	if err := s.repo.Create(v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *VolunteerAdminService) GetAll() ([]models.VolunteerAdmin, error) {
	return s.repo.GetAll()
}

func (s *VolunteerAdminService) Delete(id uuid.UUID) error {
	return s.repo.Delete(id)
}
