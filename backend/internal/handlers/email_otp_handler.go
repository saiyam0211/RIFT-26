package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/services"
)

type EmailOTPHandler struct {
	emailOTPService *services.EmailOTPService
	enableOTP       bool
}

func NewEmailOTPHandler(emailOTPService *services.EmailOTPService, enableOTP bool) *EmailOTPHandler {
	return &EmailOTPHandler{
		emailOTPService: emailOTPService,
		enableOTP:       enableOTP,
	}
}

// SendEmailOTP sends an OTP to the team leader's email
// POST /api/v1/auth/send-email-otp
func (h *EmailOTPHandler) SendEmailOTP(c *gin.Context) {
	var req struct {
		TeamID string `json:"team_id" binding:"required"`
		Email  string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request. Please provide team_id and email"})
		return
	}

	teamID, err := uuid.Parse(req.TeamID)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid team ID"})
		return
	}

	// Send OTP
	err = h.emailOTPService.SendOTP(c.Request.Context(), teamID, req.Email)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"message":      "OTP sent successfully to your email",
		"email":        req.Email,
		"otp_enabled":  h.enableOTP,
		"requires_otp": h.enableOTP,
	})
}

// VerifyEmailOTP verifies the OTP and issues JWT token
// POST /api/v1/auth/verify-email-otp
func (h *EmailOTPHandler) VerifyEmailOTP(c *gin.Context) {
	var req struct {
		TeamID  string `json:"team_id" binding:"required"`
		Email   string `json:"email" binding:"required,email"`
		OTPCode string `json:"otp_code"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request. Please provide team_id and email"})
		return
	}

	// Only require OTP code when OTP is enabled
	if h.enableOTP && req.OTPCode == "" {
		c.JSON(400, gin.H{"error": "OTP code is required"})
		return
	}

	if h.enableOTP && len(req.OTPCode) != 6 {
		c.JSON(400, gin.H{"error": "OTP code must be 6 digits"})
		return
	}

	teamID, err := uuid.Parse(req.TeamID)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid team ID"})
		return
	}

	// Verify OTP and get response
	response, err := h.emailOTPService.VerifyOTP(c.Request.Context(), teamID, req.Email, req.OTPCode)
	if err != nil {
		c.JSON(401, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, response)
}
