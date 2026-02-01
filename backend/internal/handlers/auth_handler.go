package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// VerifyFirebase verifies Firebase ID token and issues JWT
// POST /api/v1/auth/verify-firebase
func (h *AuthHandler) VerifyFirebase(c *gin.Context) {
	var req models.FirebaseAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	response, err := h.authService.VerifyFirebaseToken(c.Request.Context(), req.IDToken, req.TeamID)
	if err != nil {
		c.JSON(401, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, response)
}
