package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/pkg/qrcode"
)

type CheckinService struct {
	teamRepo *repository.TeamRepository
}

func NewCheckinService(teamRepo *repository.TeamRepository) *CheckinService {
	return &CheckinService{teamRepo: teamRepo}
}

// ScanQRCode decodes QR data and retrieves team information
func (s *CheckinService) ScanQRCode(ctx context.Context, qrDataString string) (*models.Team, bool, *time.Time, error) {
	// Decode QR code
	qrData, err := qrcode.DecodeQR(qrDataString)
	if err != nil {
		return nil, false, nil, fmt.Errorf("invalid QR code format: %w", err)
	}

	// Get team by QR token
	team, err := s.teamRepo.GetByQRToken(ctx, qrData.Token)
	if err != nil {
		return nil, false, nil, fmt.Errorf("failed to get team: %w", err)
	}
	if team == nil {
		return nil, false, nil, fmt.Errorf("team not found for QR code")
	}

	// Check if already checked in
	isCheckedIn, checkedInAt, err := s.teamRepo.IsTeamCheckedIn(ctx, team.ID)
	if err != nil {
		return nil, false, nil, fmt.Errorf("failed to check team status: %w", err)
	}

	return team, isCheckedIn, checkedInAt, nil
}

// ConfirmCheckin marks a team as checked in
func (s *CheckinService) ConfirmCheckin(ctx context.Context, teamID, volunteerID uuid.UUID) error {
	// Check if already checked in
	isCheckedIn, checkedInAt, err := s.teamRepo.IsTeamCheckedIn(ctx, teamID)
	if err != nil {
		return fmt.Errorf("failed to check team status: %w", err)
	}

	if isCheckedIn {
		return fmt.Errorf("team already checked in at %s", checkedInAt.Format(time.RFC3339))
	}

	// Perform check-in
	err = s.teamRepo.CheckIn(ctx, teamID, volunteerID)
	if err != nil {
		return fmt.Errorf("failed to check in team: %w", err)
	}

	return nil
}
