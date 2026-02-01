package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/utils"
	"github.com/rift26/backend/pkg/email"
)

// EmailOTPService handles email OTP operations
type EmailOTPService struct {
	otpRepo      *repository.OTPRepository
	teamRepo     *repository.TeamRepository
	emailService *email.EmailService
	jwtSecret    string
}

// NewEmailOTPService creates a new EmailOTPService instance
func NewEmailOTPService(
	otpRepo *repository.OTPRepository,
	teamRepo *repository.TeamRepository,
	emailService *email.EmailService,
	jwtSecret string,
) *EmailOTPService {
	return &EmailOTPService{
		otpRepo:      otpRepo,
		teamRepo:     teamRepo,
		emailService: emailService,
		jwtSecret:    jwtSecret,
	}
}

// SendOTP generates and sends an OTP to the team leader's email
func (s *EmailOTPService) SendOTP(ctx context.Context, teamID uuid.UUID, email string) error {
	// Check rate limiting
	isRateLimited, err := s.otpRepo.IsRateLimited(ctx, email)
	if err != nil {
		return fmt.Errorf("failed to check rate limit: %w", err)
	}
	if isRateLimited {
		return fmt.Errorf("too many OTP requests. Please try again later")
	}

	// Get team details
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("failed to get team details: %w", err)
	}
	if team == nil {
		return fmt.Errorf("team not found")
	}

	// Verify email matches team leader
	members, err := s.teamRepo.GetMembersByTeamID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("failed to get team members: %w", err)
	}
	if len(members) == 0 {
		return fmt.Errorf("no members found for this team")
	}

	// Find leader email
	var leaderEmail string
	for _, member := range members {
		if member.Role == "leader" {
			leaderEmail = member.Email
			break
		}
	}
	if leaderEmail == "" {
		leaderEmail = members[0].Email
	}

	// Verify email matches (case-insensitive comparison)
	if !caseInsensitiveEqual(leaderEmail, email) {
		return fmt.Errorf("email does not match team leader's registered email")
	}

	// Generate OTP
	otp, err := s.otpRepo.CreateOTP(ctx, email, teamID)
	if err != nil {
		return fmt.Errorf("failed to create OTP: %w", err)
	}

	// Send email
	err = s.emailService.SendOTP(email, otp.OTPCode, team.TeamName)
	if err != nil {
		return fmt.Errorf("failed to send OTP email: %w", err)
	}

	return nil
}

// VerifyOTP verifies an OTP and returns JWT token and team data
func (s *EmailOTPService) VerifyOTP(ctx context.Context, teamID uuid.UUID, email, otpCode string) (*models.FirebaseAuthResponse, error) {
	// Verify OTP
	valid, err := s.otpRepo.VerifyOTP(ctx, email, otpCode, teamID)
	if err != nil {
		return nil, fmt.Errorf("OTP verification failed: %w", err)
	}
	if !valid {
		return nil, fmt.Errorf("invalid or expired OTP")
	}

	// Get team details
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team details: %w", err)
	}
	if team == nil {
		return nil, fmt.Errorf("team not found")
	}

	// Generate JWT token
	token, err := utils.GenerateJWT(
		teamID,
		"",
		models.UserRoleParticipant,
		&teamID,
		s.jwtSecret,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT token: %w", err)
	}

	// Return response (reusing FirebaseAuthResponse model)
	response := &models.FirebaseAuthResponse{
		Token:       token,
		Team:        *team,
		PhoneNumber: email, // Using this field for email  for backward compatibility
	}

	return response, nil
}

// caseInsensitiveEqual compares two strings case-insensitively
func caseInsensitiveEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca := a[i]
		cb := b[i]
		// Convert to lowercase
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}
