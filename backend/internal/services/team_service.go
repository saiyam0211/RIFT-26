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

// SubmitRSVP2 handles RSVP II submission (member selection)
func (s *TeamService) SubmitRSVP2(ctx context.Context, teamID uuid.UUID, userEmail string, req models.RSVP2SubmissionRequest) (*models.Team, error) {
	// Get team and verify it exists and is in correct state
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("team not found: %w", err)
	}

	// Verify team has completed RSVP I
	if team.Status != models.StatusRSVPDone {
		return nil, fmt.Errorf("team must complete RSVP I before RSVP II")
	}

	// Verify RSVP II not already locked
	if team.RSVP2Locked {
		return nil, fmt.Errorf("RSVP II already completed for this team")
	}

	// Get team members to validate selection
	members, err := s.teamRepo.GetMembersByTeamID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team members: %w", err)
	}

	// Verify user is team leader
	var isLeader bool
	for _, member := range members {
		if member.Email == userEmail && member.Role == models.RoleLeader {
			isLeader = true
			break
		}
	}
	if !isLeader {
		return nil, fmt.Errorf("only team leader can submit RSVP II")
	}

	// At least 2 members must be selected
	if len(req.SelectedMemberIDs) < 2 {
		return nil, fmt.Errorf("at least 2 team members must be selected to participate")
	}

	// Validate selected member IDs exist in team
	memberMap := make(map[uuid.UUID]bool)
	for _, member := range members {
		memberMap[member.ID] = true
	}

	for _, selectedID := range req.SelectedMemberIDs {
		if !memberMap[selectedID] {
			return nil, fmt.Errorf("invalid member ID: %s", selectedID)
		}
	}

	// Update team with RSVP II data
	err = s.teamRepo.UpdateRSVP2(ctx, teamID, req.SelectedMemberIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to update RSVP II: %w", err)
	}

	// Get updated team
	updatedTeam, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated team: %w", err)
	}

	return updatedTeam, nil
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

	// Find the team leader in existing members
	var teamLeader *models.TeamMember
	for _, em := range team.Members {
		if em.Role == "leader" {
			teamLeader = &em
			break
		}
	}

	if teamLeader == nil {
		return fmt.Errorf("team leader not found")
	}

	// Validate: must have exactly one leader in updates
	leaderCount := 0
	var leaderUpdate *models.TeamMemberUpdate
	for i := range memberUpdates {
		update := &memberUpdates[i]
		if update.ID == teamLeader.ID {
			leaderCount++
			leaderUpdate = update
			break
		}
	}

	if leaderCount == 0 {
		return fmt.Errorf("team leader must be included in RSVP")
	}

	// Validate: Team leader details cannot be changed
	if leaderUpdate != nil {
		if !strings.EqualFold(leaderUpdate.Name, teamLeader.Name) {
			return fmt.Errorf("team leader name cannot be changed")
		}
		if !strings.EqualFold(leaderUpdate.Email, teamLeader.Email) {
			return fmt.Errorf("team leader email cannot be changed")
		}
		if leaderUpdate.Phone != teamLeader.Phone {
			return fmt.Errorf("team leader phone cannot be changed")
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
			
			// For team leader, keep original details (no changes allowed)
			if existingMember.Role == "leader" {
				updatedMember.Name = existingMember.Name
				updatedMember.Email = existingMember.Email
				updatedMember.Phone = existingMember.Phone
				updatedMember.TShirtSize = update.TShirtSize // Only allow t-shirt size update
			} else {
				// For regular members, allow updates
				updatedMember.Name = update.Name
				updatedMember.Email = update.Email
				updatedMember.Phone = update.Phone
				updatedMember.TShirtSize = update.TShirtSize
			}
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
