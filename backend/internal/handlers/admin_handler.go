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

	var successCount, errorCount int
	var errors []string

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

		// Determine leader (first candidate with "leader" in User Type, or first candidate)
		leaderIndex := 0
		for i, candidate := range candidates {
			if strings.Contains(strings.ToLower(candidate.UserType), "leader") {
				leaderIndex = i
				break
			}
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

			// Clean phone number - only remove first 3 characters (+91)
			phone := candidate.Mobile
			if strings.HasPrefix(phone, "+91") {
				phone = phone[3:] // Remove first 3 characters: +91
			}
			phone = strings.TrimSpace(phone)

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
		"total_teams":   len(teamsMap),
		"errors":        errors,
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

	c.JSON(200, gin.H{"teams": teams, "count": len(teams)})
}
