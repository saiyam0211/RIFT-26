package services

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
)

type PSSelectionService struct {
	repo       *repository.PSSelectionRepository
	teamRepo   *repository.TeamRepository
	psRepo     *repository.ProblemStatementRepository
	settingsRepo *repository.SettingsRepository
}

func NewPSSelectionService(repo *repository.PSSelectionRepository, teamRepo *repository.TeamRepository, psRepo *repository.ProblemStatementRepository, settingsRepo *repository.SettingsRepository) *PSSelectionService {
	return &PSSelectionService{repo: repo, teamRepo: teamRepo, psRepo: psRepo, settingsRepo: settingsRepo}
}

// LockPS locks a problem statement for a team (requires checked_in, submission window open, leader email match).
func (s *PSSelectionService) LockPS(ctx context.Context, teamID, psID uuid.UUID, leaderEmail string) error {
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("get team: %w", err)
	}
	if team == nil {
		return fmt.Errorf("team not found")
	}
	// Only teams that have successfully checked in at the venue can lock a problem statement
	if team.Status != models.StatusCheckedIn {
		return fmt.Errorf("team must be checked_in to lock a problem statement")
	}
	// Check submission window
	val, err := s.settingsRepo.Get(ctx, "ps_submission_open")
	if err != nil {
		return fmt.Errorf("check submission window: %w", err)
	}
	if val != "true" {
		return fmt.Errorf("PS submission window is locked by admin")
	}
	// Verify leader email matches
	var leaderFound bool
	for _, m := range team.Members {
		if m.Role == models.RoleLeader && strings.EqualFold(m.Email, leaderEmail) {
			leaderFound = true
			break
		}
	}
	if !leaderFound {
		return fmt.Errorf("leader email does not match team leader")
	}
	// Verify PS exists
	_, err = s.psRepo.GetByID(ctx, psID)
	if err != nil {
		return fmt.Errorf("problem statement not found: %w", err)
	}
	sel := &models.PSSelection{
		TeamID:            teamID,
		ProblemStatementID: psID,
		LeaderEmail:       leaderEmail,
	}
	return s.repo.Create(ctx, sel)
}

// GetByTeamID returns the team's locked PS selection.
func (s *PSSelectionService) GetByTeamID(ctx context.Context, teamID uuid.UUID) (*models.PSSelection, error) {
	return s.repo.GetByTeamID(ctx, teamID)
}

// GetAllWithDetails returns all PS selections with team and PS details (for /checkps).
func (s *PSSelectionService) GetAllWithDetails(ctx context.Context, city *string) ([]models.PSSelectionWithDetails, error) {
	return s.repo.GetAllWithDetails(ctx, city)
}

// GetSemiFinalistsWithDetails returns only semi-finalist selections.
func (s *PSSelectionService) GetSemiFinalistsWithDetails(ctx context.Context, city *string) ([]models.PSSelectionWithDetails, error) {
	return s.repo.GetSemiFinalistsWithDetails(ctx, city)
}

// SetSemiFinalist marks or unmarks a team's selection as semi-finalist.
func (s *PSSelectionService) SetSemiFinalist(ctx context.Context, teamID uuid.UUID, semi bool) error {
	// Ensure selection exists
	_, err := s.repo.GetByTeamID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("team has not locked a problem statement yet")
	}
	return s.repo.SetSemiFinalist(ctx, teamID, semi)
}

// SetAwards assigns position (1–5 or nil) and best_web3 flag for certificates.
func (s *PSSelectionService) SetAwards(ctx context.Context, teamID uuid.UUID, position *int, bestWeb3 bool) error {
	if position != nil {
		if *position < 1 || *position > 5 {
			return fmt.Errorf("position must be between 1 and 5")
		}
	}
	// Ensure selection exists
	_, err := s.repo.GetByTeamID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("team has not locked a problem statement yet")
	}
	return s.repo.SetAwards(ctx, teamID, position, bestWeb3)
}
