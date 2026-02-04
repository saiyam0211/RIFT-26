package services

import (
	"context"
	"fmt"
	"strings"

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

// SearchTeams performs fuzzy search and returns masked emails with leader details
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
		var leaderEmail string
		for _, member := range members {
			if member.Role == "leader" {
				leaderName = member.Name
				leaderEmail = member.Email
				break
			}
		}

		// If no leader found, use first member
		if leaderName == "" && len(members) > 0 {
			leaderName = members[0].Name
			leaderEmail = members[0].Email
		}

		results = append(results, models.TeamSearchResponse{
			ID:          team.ID,
			TeamName:    team.TeamName,
			LeaderName:  leaderName,
			MaskedEmail: utils.MaskEmail(leaderEmail),
			City:        team.City,
			Status:      team.Status,
			MemberCount: team.MemberCount, // Use count from database
			RSVPLocked:  team.RSVPLocked,  // Include RSVP lock status
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

	// Validate: must have 2-4 members
	if len(memberUpdates) < 2 {
		return fmt.Errorf("team must have at least 2 members")
	}
	if len(memberUpdates) > 4 {
		return fmt.Errorf("team cannot have more than 4 members")
	}

	// Validate: must have exactly one leader
	leaderCount := 0
	for _, update := range memberUpdates {
		// Check if this is an existing member by checking if ID exists in team
		for _, existingMember := range team.Members {
			if existingMember.ID == update.ID && existingMember.Role == "leader" {
				leaderCount++
				break
			}
		}
	}

	// Map updates to team members (support both existing and new members)
	var updatedMembers []models.TeamMember
	for i, update := range memberUpdates {
		// Check if this is an existing member
		var existingMember *models.TeamMember
		for _, em := range team.Members {
			if em.ID == update.ID {
				existingMember = &em
				break
			}
		}

		if existingMember != nil {
			// Update existing member
			updatedMember := *existingMember
			updatedMember.Name = update.Name
			updatedMember.Email = update.Email
			updatedMember.Phone = update.Phone
			updatedMember.TShirtSize = update.TShirtSize
			updatedMembers = append(updatedMembers, updatedMember)
		} else {
			// Create new member
			// Validate required fields for new members
			if update.Name == "" || update.Email == "" || update.Phone == "" {
				return fmt.Errorf("new member %d must have name, email, and phone", i+1)
			}

			newMember := models.TeamMember{
				ID:         uuid.New(), // Generate new UUID for new member
				TeamID:     teamID,
				Name:       update.Name,
				Email:      update.Email,
				Phone:      update.Phone,
				Role:       "member", // New members are always regular members
				TShirtSize: update.TShirtSize,
			}
			updatedMembers = append(updatedMembers, newMember)
		}
	}

	// Ensure we still have the team leader
	if leaderCount == 0 {
		return fmt.Errorf("team must have a leader")
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

// VerifyAndGetLeaderEmail verifies email matches team leader and returns leader email
func (s *TeamService) VerifyAndGetLeaderEmail(ctx context.Context, teamID uuid.UUID, email string) (string, error) {
	// Get team members
	members, err := s.teamRepo.GetMembersByTeamID(ctx, teamID)
	if err != nil {
		return "", fmt.Errorf("failed to get team members: %w", err)
	}

	if len(members) == 0 {
		return "", fmt.Errorf("no members found for this team")
	}

	// Find team leader
	var leaderEmail string
	for _, member := range members {
		if member.Role == "leader" {
			leaderEmail = member.Email
			break
		}
	}

	// If no explicit leader, use first member
	if leaderEmail == "" {
		leaderEmail = members[0].Email
	}

	// Verify email matches (case-insensitive)
	if !strings.EqualFold(leaderEmail, email) {
		return "", fmt.Errorf("email verification failed: email does not match team leader's email")
	}

	return leaderEmail, nil
}
