package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rift26/backend/internal/rsvppin"
)

type RSVPPinHandler struct {
	pinSecret   string
	rsvpOpenMode string
}

func NewRSVPPinHandler(pinSecret, rsvpOpenMode string) *RSVPPinHandler {
	return &RSVPPinHandler{
		pinSecret:   pinSecret,
		rsvpOpenMode: rsvpOpenMode,
	}
}

// ValidatePIN validates the 6-digit RSVP PIN (public, rate-limited).
// POST /api/v1/auth/validate-rsvp-pin
func (h *RSVPPinHandler) ValidatePIN(c *gin.Context) {
	if h.rsvpOpenMode != "pin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RSVP is not in PIN mode"})
		return
	}

	var req struct {
		Pin string `json:"pin" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN is required"})
		return
	}

	valid := rsvppin.ValidatePIN(h.pinSecret, req.Pin)
	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"valid": false, "error": "Invalid PIN"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true})
}

// GetRSVPPin returns the current 6-digit PIN and next rotation time (admin only).
// GET /api/v1/admin/rsvp-pin
func (h *RSVPPinHandler) GetRSVPPin(c *gin.Context) {
	if h.rsvpOpenMode != "pin" {
		c.JSON(http.StatusOK, gin.H{
			"enabled":   false,
			"pin":       "",
			"message":   "RSVP is not in PIN mode",
			"next_rotation_at": nil,
			"seconds_until_rotation": 0,
		})
		return
	}

	pin := rsvppin.GetCurrentPIN(h.pinSecret)
	nextAt := rsvppin.GetNextRotationTime()
	secondsUntil := rsvppin.GetSecondsUntilRotation()

	c.JSON(http.StatusOK, gin.H{
		"enabled":                  true,
		"pin":                      pin,
		"next_rotation_at":         nextAt.Format(time.RFC3339),
		"seconds_until_rotation":   secondsUntil,
	})
}
