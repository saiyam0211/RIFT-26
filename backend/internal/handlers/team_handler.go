package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/middleware"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"
)

type TeamHandler struct {
	teamService           *services.TeamService
	jwtSecret              string
	allowCityChange        bool
	seatAllocationService  *services.SeatAllocationService
}

func NewTeamHandler(teamService *services.TeamService, jwtSecret string, allowCityChange bool, seatAllocationService *services.SeatAllocationService) *TeamHandler {
	return &TeamHandler{
		teamService:          teamService,
		jwtSecret:            jwtSecret,
		allowCityChange:      allowCityChange,
		seatAllocationService: seatAllocationService,
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

	// If city change is not allowed, get the existing team city
	cityToUse := req.City
	if !h.allowCityChange {
		team, err := h.teamService.GetTeamByID(c.Request.Context(), teamID)
		if err != nil {
			c.JSON(400, gin.H{"error": "Failed to fetch team"})
			return
		}
		if team.City != nil {
			cityToUse = *team.City
		}
	}

	err = h.teamService.SubmitRSVP(c.Request.Context(), teamID, cityToUse, req.Members)
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

	var seatAllocation interface{}
	if h.seatAllocationService != nil {
		if alloc, err := h.seatAllocationService.GetTeamAllocation(team.ID); err == nil {
			seatAllocation = gin.H{
				"block_name": alloc.BlockName,
				"room_name":  alloc.RoomName,
				"seat_label": alloc.SeatLabel,
				"team_size":  alloc.TeamSize,
			}
		}
	}
	if seatAllocation == nil {
		seatAllocation = nil
	}

	c.JSON(200, gin.H{
		"team":            team,
		"announcements":   announcements,
		"qr_code":         qrCode,
		"seat_allocation": seatAllocation,
	})
}

// SubmitRSVP2 handles RSVP II submission (member selection)
// PUT /api/v1/teams/:id/rsvp2
func (h *TeamHandler) SubmitRSVP2(c *gin.Context) {
	teamIDStr := c.Param("id")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid team ID"})
		return
	}

	var req models.RSVP2SubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Get user email from context (set by auth middleware)
	userEmail := c.GetString("user_email")
	if userEmail == "" {
		c.JSON(401, gin.H{"error": "Authentication required"})
		return
	}

	updatedTeam, err := h.teamService.SubmitRSVP2(c.Request.Context(), teamID, userEmail, req)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"message": "RSVP II submitted successfully",
		"team":    updatedTeam,
	})
}
