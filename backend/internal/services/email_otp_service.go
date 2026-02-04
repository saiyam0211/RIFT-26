package services

import (
	"context"
	"fmt"
	"log"

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
	enableOTP    bool // Feature flag to enable/disable OTP
}

// NewEmailOTPService creates a new EmailOTPService instance
func NewEmailOTPService(
	otpRepo *repository.OTPRepository,
	teamRepo *repository.TeamRepository,
	emailService *email.EmailService,
	jwtSecret string,
	enableOTP bool,
) *EmailOTPService {
	return &EmailOTPService{
		otpRepo:      otpRepo,
		teamRepo:     teamRepo,
		emailService: emailService,
		jwtSecret:    jwtSecret,
		enableOTP:    enableOTP,
	}
}

// SendOTP generates and sends an OTP to the team leader's email
// If enableOTP is false, it only validates the email and returns success
func (s *EmailOTPService) SendOTP(ctx context.Context, teamID uuid.UUID, email string) error {
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

	// If OTP is disabled, skip OTP generation and email sending
	if !s.enableOTP {
		log.Printf("[AUTH] OTP disabled - email validated successfully for %s (Team: %s)", email, team.TeamName)
		return nil
	}

	// Check rate limiting (only when OTP is enabled)
	isRateLimited, err := s.otpRepo.IsRateLimited(ctx, email)
	if err != nil {
		return fmt.Errorf("failed to check rate limit: %w", err)
	}
	if isRateLimited {
		return fmt.Errorf("too many OTP requests. Please try again later")
	}

	// Generate OTP
	otp, err := s.otpRepo.CreateOTP(ctx, email, teamID)
	if err != nil {
		return fmt.Errorf("failed to create OTP: %w", err)
	}

	// Send email asynchronously (don't block the response)
	go func() {
		log.Printf("[EMAIL] Attempting to send OTP to %s (Team: %s)", email, team.TeamName)
		err := s.emailService.SendOTP(email, otp.OTPCode, team.TeamName)
		if err != nil {
			// Log the error but don't fail the request
			log.Printf("[EMAIL ERROR] Failed to send OTP email to %s: %v", email, err)
		} else {
			log.Printf("[EMAIL SUCCESS] OTP sent successfully to %s", email)
		}
	}()

	return nil
}

// VerifyOTP verifies an OTP and returns JWT token and team data
// If enableOTP is false, it skips OTP verification and only validates email
func (s *EmailOTPService) VerifyOTP(ctx context.Context, teamID uuid.UUID, email, otpCode string) (*models.FirebaseAuthResponse, error) {
	// Get team details first
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team details: %w", err)
	}
	if team == nil {
		return nil, fmt.Errorf("team not found")
	}

	// If OTP is disabled, skip OTP verification
	if !s.enableOTP {
		// Validate email matches team leader
		members, err := s.teamRepo.GetMembersByTeamID(ctx, teamID)
		if err != nil {
			return nil, fmt.Errorf("failed to get team members: %w", err)
		}
		if len(members) == 0 {
			return nil, fmt.Errorf("no members found for this team")
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

		// Verify email matches
		if !caseInsensitiveEqual(leaderEmail, email) {
			return nil, fmt.Errorf("email does not match team leader's registered email")
		}

		log.Printf("[AUTH] OTP disabled - email-only auth successful for %s (Team: %s)", email, team.TeamName)
	} else {
		// OTP is enabled - verify it
		valid, err := s.otpRepo.VerifyOTP(ctx, email, otpCode, teamID)
		if err != nil {
			return nil, fmt.Errorf("OTP verification failed: %w", err)
		}
		if !valid {
			return nil, fmt.Errorf("invalid or expired OTP")
		}
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
