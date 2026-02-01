package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/utils"
	"github.com/rift26/backend/pkg/auth"
)

type AuthService struct {
	teamRepo     *repository.TeamRepository
	firebaseAuth *auth.FirebaseAuthService
	jwtSecret    string
}

func NewAuthService(
	teamRepo *repository.TeamRepository,
	firebaseAuth *auth.FirebaseAuthService,
	jwtSecret string,
) *AuthService {
	return &AuthService{
		teamRepo:     teamRepo,
		firebaseAuth: firebaseAuth,
		jwtSecret:    jwtSecret,
	}
}

// VerifyFirebaseToken verifies Firebase ID token and authenticates team leader
func (s *AuthService) VerifyFirebaseToken(ctx context.Context, idToken string, teamID uuid.UUID) (*models.FirebaseAuthResponse, error) {
	// Verify Firebase ID token
	_, phoneNumber, err := s.firebaseAuth.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("invalid Firebase token: %w", err)
	}

	// Get team from database
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team: %w", err)
	}
	if team == nil {
		return nil, fmt.Errorf("team not found")
	}

	// Get team leader's phone number
	leaderPhone, err := s.teamRepo.GetLeaderPhone(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get leader phone: %w", err)
	}

	// Normalize phone numbers (remove country code if present)
	normalizedFirebasePhone := normalizePhone(phoneNumber)
	normalizedLeaderPhone := normalizePhone(leaderPhone)

	// Verify that the authenticated phone matches the team leader's phone
	if normalizedFirebasePhone != normalizedLeaderPhone {
		return nil, fmt.Errorf("phone number does not match team leader")
	}

	// Generate JWT token for the team leader
	// Firebase UID is not a valid UUID format, so we use the teamID for JWT
	token, err := utils.GenerateJWT(
		teamID, // Use team ID as the primary identifier
		"",     // Email not required for phone auth
		models.UserRoleParticipant,
		&teamID,
		s.jwtSecret,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	return &models.FirebaseAuthResponse{
		Token:       token,
		Team:        *team,
		PhoneNumber: phoneNumber,
	}, nil
}

// normalizePhone removes country code and formatting from phone number
func normalizePhone(phone string) string {
	// Remove +91 country code if present
	if len(phone) > 10 && phone[0] == '+' {
		return phone[len(phone)-10:]
	}
	if len(phone) > 10 && phone[:2] == "91" {
		return phone[len(phone)-10:]
	}
	return phone
}
