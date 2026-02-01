package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/middleware"
	"github.com/rift26/backend/internal/services"
)

type VolunteerHandler struct {
	checkinService *services.CheckinService
}

func NewVolunteerHandler(checkinService *services.CheckinService) *VolunteerHandler {
	return &VolunteerHandler{checkinService: checkinService}
}

// ScanQR scans and decodes QR code
// POST /api/v1/checkin/scan
func (h *VolunteerHandler) ScanQR(c *gin.Context) {
	var req struct {
		QRData string `json:"qr_data" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	team, isCheckedIn, checkedInAt, err := h.checkinService.ScanQRCode(c.Request.Context(), req.QRData)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"team":               team,
		"already_checked_in": isCheckedIn,
	}

	if isCheckedIn && checkedInAt != nil {
		response["checked_in_at"] = checkedInAt
	}

	c.JSON(200, response)
}

// ConfirmCheckin confirms team check-in
// POST /api/v1/checkin/confirm
func (h *VolunteerHandler) ConfirmCheckin(c *gin.Context) {
	var req struct {
		TeamID uuid.UUID `json:"team_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Get volunteer ID from JWT
	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(401, gin.H{"error": "Volunteer ID not found"})
		return
	}

	err := h.checkinService.ConfirmCheckin(c.Request.Context(), req.TeamID, volunteerID)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"message":    "Team checked in successfully",
		"team_id":    req.TeamID,
		"checked_by": volunteerID,
	})
}
