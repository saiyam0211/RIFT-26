package handlers

import (
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/services"
)

type AdminHandler struct {
	teamRepo         *repository.TeamRepository
	announcementRepo *repository.AnnouncementRepository
	teamService      *services.TeamService
	userRepo         *repository.UserRepository
	jwtSecret        string
}

func NewAdminHandler(
	teamRepo *repository.TeamRepository,
	announcementRepo *repository.AnnouncementRepository,
	teamService *services.TeamService,
	userRepo *repository.UserRepository,
	jwtSecret string,
) *AdminHandler {
	return &AdminHandler{
		teamRepo:         teamRepo,
		announcementRepo: announcementRepo,
		teamService:      teamService,
		userRepo:         userRepo,
		jwtSecret:        jwtSecret,
	}
}

// AdminLogin handles admin email/password authentication
// POST /api/v1/admin/login
func (h *AdminHandler) AdminLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}

	// Get user by email
	user, err := h.userRepo.GetByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	// Check if user is admin
	if user.Role != "admin" {
		c.JSON(403, gin.H{"error": "Access denied: admin role required"})
		return
	}

	// Verify password
	if !user.ComparePassword(req.Password) {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT token
	token, err := user.GenerateJWT(h.jwtSecret)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(200, gin.H{
		"token": token,
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
			"role":  user.Role,
		},
	})
}

// mapCity converts city name from CSV to City enum
func mapCity(cityName string) *models.City {
	cityLower := strings.ToLower(strings.TrimSpace(cityName))

	if strings.Contains(cityLower, "lucknow") || cityLower == "lko" {
		city := models.CityLKO
		return &city
	}
	if strings.Contains(cityLower, "pune") {
		city := models.CityPUNE
		return &city
	}
	if strings.Contains(cityLower, "bengaluru") || strings.Contains(cityLower, "bangalore") || cityLower == "blr" {
		city := models.CityBLR
		return &city
	}
	if strings.Contains(cityLower, "noida") {
		city := models.CityNOIDA
		return &city
	}

	return nil // Unknown city
}

// BulkUploadTeams handles CSV upload for team creation with optimizations
// POST /api/v1/admin/teams/bulk-upload
func (h *AdminHandler) BulkUploadTeams(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "File is required"})
		return
	}

	// Open the file
	src, err := file.Open()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	// Parse CSV
	reader := csv.NewReader(src)
	reader.TrimLeadingSpace = true
	// Handle both tab and comma separated files
	reader.Comma = '\t' // Try tab first
	records, err := reader.ReadAll()
	if err != nil {
		// Try comma if tab fails
		src.Close()
		src, _ = file.Open()
		reader = csv.NewReader(src)
		reader.TrimLeadingSpace = true
		records, err = reader.ReadAll()
		if err != nil {
			c.JSON(400, gin.H{"error": "Failed to parse CSV"})
			return
		}
	}

	if len(records) < 2 {
		c.JSON(400, gin.H{"error": "CSV must have header and at least one candidate"})
		return
	}

	// Expected CSV format (tab or comma separated):
	// Col 0: Team ID
	// Col 1: Team Name
	// Col 2: Candidate's Name
	// Col 3: Candidate's Email
	// Col 4: Candidate's Mobile
	// Col 5: Candidate's Location
	// Col 6: User Type (Team Leader / Team Member)
	// Col 18: In Which City You Will Join Us For The RIFT '26?

	// Group candidates by Team ID
	type CandidateData struct {
		TeamID   string
		TeamName string
		Name     string
		Email    string
		Mobile   string
		Location string
		UserType string
		City     string
	}

	teamsMap := make(map[string][]CandidateData)
	teamCities := make(map[string]string)

	for _, record := range records[1:] { // Skip header row
		if len(record) < 19 {
			continue // Skip incomplete rows
		}

		teamID := strings.TrimSpace(record[0])
		if teamID == "" {
			continue
		}

		candidate := CandidateData{
			TeamID:   teamID,
			TeamName: strings.TrimSpace(record[1]),
			Name:     strings.TrimSpace(record[2]),
			Email:    strings.TrimSpace(record[3]),
			Mobile:   strings.TrimSpace(record[4]),
			Location: strings.TrimSpace(record[5]),
			UserType: strings.TrimSpace(record[6]),
			City:     strings.TrimSpace(record[18]), // Column 19 (0-indexed: 18)
		}

		teamsMap[teamID] = append(teamsMap[teamID], candidate)

		// Store city for this team (all members should have same city)
		if candidate.City != "" {
			teamCities[teamID] = candidate.City
		}
	}

	var successCount, errorCount, skippedCount int
	var errors []string
	var warnings []string

	// Use transaction for batch insert
	ctx := c.Request.Context()

	// Prepare all teams and members first
	type TeamWithMembers struct {
		Team    models.Team
		Members []models.TeamMember
	}

	var teamsBatch []TeamWithMembers

	for teamID, candidates := range teamsMap {
		if len(candidates) == 0 {
			continue
		}

		// Use team name from first candidate
		teamName := candidates[0].TeamName
		if teamName == "" {
			teamName = "Team " + teamID
		}

		// Determine leader (first candidate with "leader" in User Type, or first candidate)
		leaderIndex := 0
		for i, candidate := range candidates {
			if strings.Contains(strings.ToLower(candidate.UserType), "leader") {
				leaderIndex = i
				break
			}
		}

		leaderEmail := candidates[leaderIndex].Email

		// VALIDATION 1: Check if team with same name and leader already exists
		existingTeam, err := h.teamRepo.CheckTeamExistsByNameAndLeader(ctx, teamName, leaderEmail)
		if err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Team %s: Failed to validate - %v", teamName, err))
			continue
		}
		if existingTeam != nil {
			skippedCount++
			rsvpStatus := "not done"
			if existingTeam.RSVPLocked {
				rsvpStatus = "done"
			}
			warnings = append(warnings, fmt.Sprintf("Team '%s' with leader '%s' already exists (RSVP: %s) - Skipped", teamName, leaderEmail, rsvpStatus))
			continue
		}

		// VALIDATION 2: Check for duplicate phone numbers and emails in CSV and database
		validationFailed := false
		var validationErrors []string

		for i, candidate := range candidates {
			// Clean phone number
			phone := strings.TrimSpace(strings.TrimPrefix(candidate.Mobile, "+91"))

			// Skip empty phone/email
			if phone == "" || candidate.Email == "" {
				validationFailed = true
				validationErrors = append(validationErrors, fmt.Sprintf("Member %s has empty phone or email", candidate.Name))
				continue
			}

			// Check if phone exists in database
			phoneExists, existingTeamName, err := h.teamRepo.CheckPhoneExists(ctx, phone)
			if err != nil {
				validationFailed = true
				validationErrors = append(validationErrors, fmt.Sprintf("Failed to validate phone %s: %v", phone, err))
				continue
			}
			if phoneExists {
				validationFailed = true
				validationErrors = append(validationErrors, fmt.Sprintf("Phone %s (member: %s) already exists in team '%s'", phone, candidate.Name, existingTeamName))
				continue
			}

			// Check if email exists in database
			emailExists, existingTeamName, err := h.teamRepo.CheckEmailExists(ctx, candidate.Email)
			if err != nil {
				validationFailed = true
				validationErrors = append(validationErrors, fmt.Sprintf("Failed to validate email %s: %v", candidate.Email, err))
				continue
			}
			if emailExists {
				validationFailed = true
				validationErrors = append(validationErrors, fmt.Sprintf("Email %s (member: %s) already exists in team '%s'", candidate.Email, candidate.Name, existingTeamName))
				continue
			}

			// Check for duplicates within the same CSV upload
			for j := i + 1; j < len(candidates); j++ {
				otherPhone := strings.TrimSpace(strings.TrimPrefix(candidates[j].Mobile, "+91"))

				if phone == otherPhone {
					validationFailed = true
					validationErrors = append(validationErrors, fmt.Sprintf("Duplicate phone %s within team (members: %s and %s)", phone, candidate.Name, candidates[j].Name))
				}

				if strings.EqualFold(candidate.Email, candidates[j].Email) {
					validationFailed = true
					validationErrors = append(validationErrors, fmt.Sprintf("Duplicate email %s within team (members: %s and %s)", candidate.Email, candidate.Name, candidates[j].Name))
				}
			}
		}

		if validationFailed {
			errorCount++
			errors = append(errors, fmt.Sprintf("Team %s: %s", teamName, strings.Join(validationErrors, "; ")))
			continue
		}

		// Map city from CSV
		cityName := teamCities[teamID]
		city := mapCity(cityName)

		// Create team
		teamUUID := uuid.New()
		team := models.Team{
			ID:          teamUUID,
			TeamName:    teamName,
			City:        city,
			Status:      "shortlisted",
			MemberCount: len(candidates),
		}

		// Prepare team members
		var members []models.TeamMember
		for i, candidate := range candidates {
			var role models.MemberRole
			if i == leaderIndex {
				role = "leader"
			} else {
				role = "member"
			}

			// Clean phone number - remove +91 prefix if present
			phone := strings.TrimSpace(strings.TrimPrefix(candidate.Mobile, "+91"))

			member := models.TeamMember{
				ID:     uuid.New(),
				TeamID: teamUUID,
				Name:   candidate.Name,
				Email:  candidate.Email,
				Phone:  phone,
				Role:   role,
			}
			members = append(members, member)
		}

		teamsBatch = append(teamsBatch, TeamWithMembers{
			Team:    team,
			Members: members,
		})
	}

	// Batch insert teams and members
	for _, item := range teamsBatch {
		err := h.teamRepo.CreateTeamWithMembers(ctx, item.Team, item.Members)
		if err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Team %s: %v", item.Team.TeamName, err))
		} else {
			successCount++
		}
	}

	c.JSON(200, gin.H{
		"message":       "Bulk upload completed",
		"success_count": successCount,
		"error_count":   errorCount,
		"skipped_count": skippedCount,
		"total_teams":   len(teamsMap),
		"errors":        errors,
		"warnings":      warnings,
	})
}

// ClearAllData deletes all teams and members - for testing only
// DELETE /api/v1/admin/data/clear
func (h *AdminHandler) ClearAllData(c *gin.Context) {
	err := h.teamRepo.ClearAllData(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to clear data"})
		return
	}

	c.JSON(200, gin.H{"message": "All teams and members deleted successfully"})
}

// CreateAnnouncement creates a new announcement
// POST /api/v1/admin/announcements
func (h *AdminHandler) CreateAnnouncement(c *gin.Context) {
	var req struct {
		Title    string `json:"title" binding:"required"`
		Content  string `json:"content" binding:"required"`
		Priority int    `json:"priority" binding:"required,min=1,max=5"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	announcement := models.Announcement{
		ID:       uuid.New(),
		Title:    req.Title,
		Content:  req.Content,
		Priority: req.Priority,
		IsActive: true,
	}

	err := h.announcementRepo.Create(c.Request.Context(), announcement)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create announcement"})
		return
	}

	c.JSON(201, announcement)
}

// GetAllAnnouncements returns all announcements (including inactive)
// GET /api/v1/admin/announcements
func (h *AdminHandler) GetAllAnnouncements(c *gin.Context) {
	announcements, err := h.announcementRepo.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch announcements"})
		return
	}

	c.JSON(200, gin.H{"announcements": announcements})
}

// UpdateAnnouncement updates an announcement
// PUT /api/v1/admin/announcements/:id
func (h *AdminHandler) UpdateAnnouncement(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid announcement ID"})
		return
	}

	var req struct {
		Title    string `json:"title"`
		Content  string `json:"content"`
		Priority int    `json:"priority"`
		IsActive *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	err = h.announcementRepo.Update(c.Request.Context(), id, req.Title, req.Content, req.Priority, req.IsActive)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update announcement"})
		return
	}

	c.JSON(200, gin.H{"message": "Announcement updated successfully"})
}

// GetCheckInStats returns check-in statistics
// GET /api/v1/admin/stats/checkin
func (h *AdminHandler) GetCheckInStats(c *gin.Context) {
	stats, err := h.teamRepo.GetCheckInStats(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch stats"})
		return
	}

	c.JSON(200, stats)
}

// GetAllTeams returns all teams with filters
// GET /api/v1/admin/teams?status=&city=
func (h *AdminHandler) GetAllTeams(c *gin.Context) {
	status := c.Query("status")
	city := c.Query("city")

	teams, err := h.teamRepo.GetAllWithFilters(c.Request.Context(), status, city)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch teams"})
		return
	}

	// Transform teams to include checked_in boolean
	type TeamResponse struct {
		ID               string                `json:"id"`
		TeamName         string                `json:"team_name"`
		City             *models.City          `json:"city"`
		Status           models.TeamStatus     `json:"status"`
		ProblemStatement *string               `json:"problem_statement"`
		QRCodeToken      *string               `json:"qr_code_token"`
		RSVPLocked       bool                  `json:"rsvp_locked"`
		RSVPLockedAt     *string               `json:"rsvp_locked_at"`
		CheckedIn        bool                  `json:"checked_in"`
		CheckedInAt      *string               `json:"checked_in_at"`
		CheckedInBy      *string               `json:"checked_in_by"`
		DashboardToken   *string               `json:"dashboard_token"`
		MemberCount      int                   `json:"member_count"`
		CreatedAt        string                `json:"created_at"`
		UpdatedAt        string                `json:"updated_at"`
		Members          []models.TeamMember   `json:"members,omitempty"`
	}

	var response []TeamResponse
	for _, team := range teams {
		tr := TeamResponse{
			ID:               team.ID.String(),
			TeamName:         team.TeamName,
			City:             team.City,
			Status:           team.Status,
			ProblemStatement: team.ProblemStatement,
			QRCodeToken:      team.QRCodeToken,
			RSVPLocked:       team.RSVPLocked,
			CheckedIn:        team.CheckedInAt != nil,
			DashboardToken:   team.DashboardToken,
			MemberCount:      team.MemberCount,
			CreatedAt:        team.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt:        team.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
			Members:          team.Members,
		}

		if team.RSVPLockedAt != nil {
			formatted := team.RSVPLockedAt.Format("2006-01-02T15:04:05Z07:00")
			tr.RSVPLockedAt = &formatted
		}

		if team.CheckedInAt != nil {
			formatted := team.CheckedInAt.Format("2006-01-02T15:04:05Z07:00")
			tr.CheckedInAt = &formatted
		}

		if team.CheckedInBy != nil {
			checkedInBy := team.CheckedInBy.String()
			tr.CheckedInBy = &checkedInBy
		}

		response = append(response, tr)
	}

	c.JSON(200, gin.H{"teams": response, "count": len(response)})
}

// CreateTeamManually creates a new team with members directly (admin only)
// POST /api/v1/admin/teams/create
func (h *AdminHandler) CreateTeamManually(c *gin.Context) {
	var req struct {
		TeamName      string `json:"team_name" binding:"required"`
		City          string `json:"city"`
		RSVPCompleted bool   `json:"rsvp_completed"`
		Members       []struct {
			Name  string `json:"name" binding:"required"`
			Email string `json:"email" binding:"required,email"`
			Phone string `json:"phone" binding:"required"`
			Role  string `json:"role" binding:"required,oneof=leader member"`
		} `json:"members" binding:"required,min=2,max=4"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": fmt.Sprintf("Invalid request: %v", err)})
		return
	}

	ctx := c.Request.Context()

	// Validate exactly one leader
	leaderCount := 0
	for _, member := range req.Members {
		if member.Role == "leader" {
			leaderCount++
		}
	}
	if leaderCount != 1 {
		c.JSON(400, gin.H{"error": "Team must have exactly one leader"})
		return
	}

	// Check for duplicate emails within the team
	emailMap := make(map[string]bool)
	for _, member := range req.Members {
		emailLower := strings.ToLower(member.Email)
		if emailMap[emailLower] {
			c.JSON(400, gin.H{"error": fmt.Sprintf("Duplicate email in team: %s", member.Email)})
			return
		}
		emailMap[emailLower] = true
	}

	// Check for duplicate phones within the team
	phoneMap := make(map[string]bool)
	for _, member := range req.Members {
		phone := strings.TrimSpace(strings.TrimPrefix(member.Phone, "+91"))
		if phoneMap[phone] {
			c.JSON(400, gin.H{"error": fmt.Sprintf("Duplicate phone in team: %s", phone)})
			return
		}
		phoneMap[phone] = true
	}

	// Check if any email already exists in database
	for _, member := range req.Members {
		exists, existingTeam, err := h.teamRepo.CheckEmailExists(ctx, member.Email)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to validate email"})
			return
		}
		if exists {
			c.JSON(400, gin.H{"error": fmt.Sprintf("Email %s already exists in team '%s'", member.Email, existingTeam)})
			return
		}
	}

	// Check if any phone already exists in database
	for _, member := range req.Members {
		phone := strings.TrimSpace(strings.TrimPrefix(member.Phone, "+91"))
		exists, existingTeam, err := h.teamRepo.CheckPhoneExists(ctx, phone)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to validate phone"})
			return
		}
		if exists {
			c.JSON(400, gin.H{"error": fmt.Sprintf("Phone %s already exists in team '%s'", phone, existingTeam)})
			return
		}
	}

	// Map city
	var city *models.City
	if req.City != "" {
		mappedCity := mapCity(req.City)
		city = mappedCity
	}

	// Create team
	teamID := uuid.New()
	team := models.Team{
		ID:          teamID,
		TeamName:    req.TeamName,
		City:        city,
		Status:      "shortlisted",
		MemberCount: len(req.Members),
		RSVPLocked:  req.RSVPCompleted,
	}

	// Generate dashboard token
	dashboardToken := uuid.New().String()
	team.DashboardToken = &dashboardToken

	// Prepare team members
	var teamMembers []models.TeamMember
	for _, member := range req.Members {
		phone := strings.TrimSpace(strings.TrimPrefix(member.Phone, "+91"))
		
		var role models.MemberRole
		if member.Role == "leader" {
			role = models.RoleLeader
		} else {
			role = models.RoleMember
		}

		// Generate individual QR token
		individualQR := uuid.New().String()

		teamMember := models.TeamMember{
			ID:                uuid.New(),
			TeamID:            teamID,
			Name:              member.Name,
			Email:             member.Email,
			Phone:             phone,
			Role:              role,
			IndividualQRToken: &individualQR,
		}
		teamMembers = append(teamMembers, teamMember)
	}

	// Create team with members
	err := h.teamRepo.CreateTeamWithMembers(ctx, team, teamMembers)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to create team: %v", err)})
		return
	}

	c.JSON(201, gin.H{
		"message":         "Team created successfully",
		"team_id":         teamID.String(),
		"dashboard_token": dashboardToken,
		"rsvp_required":   !req.RSVPCompleted,
	})
}
