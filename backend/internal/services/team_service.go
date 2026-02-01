package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/utils"
	"github.com/rift26/backend/pkg/qrcode"
)

type TeamService struct {
	teamRepo         *repository.TeamRepository
	announcementRepo *repository.AnnouncementRepository
}

func NewTeamService(
	teamRepo *repository.TeamRepository,
	announcementRepo *repository.AnnouncementRepository,
) *TeamService {
	return &TeamService{
		teamRepo:         teamRepo,
		announcementRepo: announcementRepo,
	}
}

// SearchTeams performs fuzzy search and returns masked phone numbers with leader details
func (s *TeamService) SearchTeams(ctx context.Context, query string) ([]models.TeamSearchResponse, error) {
	teams, err := s.teamRepo.SearchByName(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to search teams: %w", err)
	}

	var results []models.TeamSearchResponse
	for _, team := range teams {
		// Get team members to find leader
		members, err := s.teamRepo.GetMembersByTeamID(ctx, team.ID)
		if err != nil || len(members) == 0 {
			continue // Skip teams without members
		}

		// Find leader
		var leaderName string
		var leaderPhone string
		for _, member := range members {
			if member.Role == "leader" {
				leaderName = member.Name
				leaderPhone = member.Phone
				break
			}
		}

		// If no leader found, use first member
		if leaderName == "" && len(members) > 0 {
			leaderName = members[0].Name
			leaderPhone = members[0].Phone
		}

		results = append(results, models.TeamSearchResponse{
			ID:          team.ID,
			TeamName:    team.TeamName,
			LeaderName:  leaderName,
			MaskedPhone: utils.MaskPhone(leaderPhone),
			City:        team.City,
			Status:      team.Status,
			MemberCount: team.MemberCount, // Use count from database
		})
	}

	return results, nil
}

// GetTeamByID retrieves full team details
func (s *TeamService) GetTeamByID(ctx context.Context, teamID uuid.UUID) (*models.Team, error) {
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team: %w", err)
	}
	if team == nil {
		return nil, fmt.Errorf("team not found")
	}

	return team, nil
}

// SubmitRSVP processes RSVP submission and locks the team
func (s *TeamService) SubmitRSVP(ctx context.Context, teamID uuid.UUID, city models.City, memberUpdates []models.TeamMemberUpdate) error {
	// Get existing team
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("failed to get team: %w", err)
	}
	if team == nil {
		return fmt.Errorf("team not found")
	}

	// Check if already locked
	if team.RSVPLocked {
		return fmt.Errorf("team RSVP is already locked")
	}

	// Validate member updates
	if len(memberUpdates) == 0 {
		return fmt.Errorf("at least one member required")
	}

	// Map updates to team members
	var updatedMembers []models.TeamMember
	for _, update := range memberUpdates {
		// Find corresponding member in team
		var found bool
		for _, existingMember := range team.Members {
			if existingMember.ID == update.ID {
				existingMember.Name = update.Name
				existingMember.Email = update.Email
				existingMember.Phone = update.Phone
				existingMember.TShirtSize = &update.TShirtSize
				updatedMembers = append(updatedMembers, existingMember)
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("member ID %s not found in team", update.ID)
		}
	}

	// Update RSVP in database (this locks the team)
	err = s.teamRepo.UpdateRSVP(ctx, teamID, city, updatedMembers)
	if err != nil {
		return fmt.Errorf("failed to update RSVP: %w", err)
	}

	return nil
}

// GetDashboard retrieves team dashboard data including QR code and announcements
func (s *TeamService) GetDashboard(ctx context.Context, token string) (*models.Team, []models.Announcement, string, error) {
	// Get team by dashboard token
	team, err := s.teamRepo.GetByDashboardToken(ctx, token)
	if err != nil {
		return nil, nil, "", fmt.Errorf("failed to get team: %w", err)
	}
	if team == nil {
		return nil, nil, "", fmt.Errorf("invalid dashboard token")
	}

	// Get active announcements
	announcements, err := s.announcementRepo.GetActiveAnnouncements(ctx)
	if err != nil {
		// Log error but don't fail the request
		announcements = []models.Announcement{}
	}

	// Generate QR code
	var qrCodeDataURL string
	if team.QRCodeToken != nil {
		qrCodeDataURL, err = qrcode.GenerateTeamQR(team.ID, *team.QRCodeToken)
		if err != nil {
			return nil, nil, "", fmt.Errorf("failed to generate QR code: %w", err)
		}
	}

	return team, announcements, qrCodeDataURL, nil
}
