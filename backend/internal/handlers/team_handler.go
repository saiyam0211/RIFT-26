package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/middleware"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"
	"github.com/rift26/backend/internal/utils"
)

type TeamHandler struct {
	teamService *services.TeamService
	jwtSecret   string
}

func NewTeamHandler(teamService *services.TeamService, jwtSecret string) *TeamHandler {
	return &TeamHandler{
		teamService: teamService,
		jwtSecret:   jwtSecret,
	}
}

// SearchTeams handles team search requests
// GET /api/v1/teams/search?name=query
func (h *TeamHandler) SearchTeams(c *gin.Context) {
	var query models.TeamSearchRequest
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	results, err := h.teamService.SearchTeams(c.Request.Context(), query.Query)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to search teams"})
		return
	}

	c.JSON(200, gin.H{
		"teams": results,
		"count": len(results),
	})
}

// GetTeam retrieves team details by ID (requires auth)
// GET /api/v1/teams/:id
func (h *TeamHandler) GetTeam(c *gin.Context) {
	teamIDStr := c.Param("id")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid team ID"})
		return
	}

	team, err := h.teamService.GetTeamByID(c.Request.Context(), teamID)
	if err != nil {
		c.JSON(404, gin.H{"error": "Team not found"})
		return
	}

	c.JSON(200, team)
}

// SubmitRSVP handles RSVP submission (requires auth)
// PUT /api/v1/teams/:id/rsvp
func (h *TeamHandler) SubmitRSVP(c *gin.Context) {
	teamIDStr := c.Param("id")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid team ID"})
		return
	}

	// Verify user has access to this team
	userTeamID, exists := middleware.GetTeamID(c)
	if !exists || userTeamID != teamID {
		c.JSON(403, gin.H{"error": "Not authorized for this team"})
		return
	}

	var req models.RSVPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	err = h.teamService.SubmitRSVP(c.Request.Context(), teamID, req.City, req.Members)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"message": "RSVP submitted successfully",
		"locked":  true,
	})
}

// GetDashboard retrieves team dashboard data via token (no auth required)
// GET /api/v1/dashboard/:token
func (h *TeamHandler) GetDashboard(c *gin.Context) {
	token := c.Param("token")

	team, announcements, qrCode, err := h.teamService.GetDashboard(c.Request.Context(), token)
	if err != nil {
		c.JSON(404, gin.H{"error": "Dashboard not found"})
		return
	}

	c.JSON(200, gin.H{
		"team":          team,
		"announcements": announcements,
		"qr_code":       qrCode,
	})
}

// VerifyPhone verifies last 4 digits of team leader's phone and returns full number
// If team RSVP is locked, also generates JWT token for direct dashboard access
// POST /api/v1/teams/verify-phone
func (h *TeamHandler) VerifyPhone(c *gin.Context) {
	var req struct {
		TeamID      string `json:"team_id" binding:"required"`
		Last4Digits string `json:"last_4_digits" binding:"required,len=4"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request. Please provide team_id and last_4_digits"})
		return
	}

	teamID, err := uuid.Parse(req.TeamID)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid team ID"})
		return
	}

	// Verify last 4 digits
	phoneNumber, err := h.teamService.VerifyAndGetLeaderPhone(c.Request.Context(), teamID, req.Last4Digits)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Get team to check RSVP status
	team, err := h.teamService.GetTeamByID(c.Request.Context(), teamID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get team details"})
		return
	}

	response := gin.H{
		"phone_number":    phoneNumber,
		"message":         "Phone number verified successfully",
		"rsvp_locked":     team.RSVPLocked,
		"dashboard_token": team.DashboardToken,
	}

	// If RSVP is locked, generate JWT token for direct access
	if team.RSVPLocked && team.DashboardToken != nil {
		token, err := utils.GenerateJWT(
			teamID,
			"",
			models.UserRoleParticipant,
			&teamID,
			h.jwtSecret,
		)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to generate access token"})
			return
		}
		response["token"] = token
		response["team"] = team
	}

	c.JSON(200, response)
}
