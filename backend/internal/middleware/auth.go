package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/utils"
)

// AuthMiddleware validates JWT tokens
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(401, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		token := parts[1]

		// Validate JWT
		claims, err := utils.ValidateJWT(token, jwtSecret)
		if err != nil {
			c.JSON(401, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		if claims.TeamID != nil {
			c.Set("team_id", *claims.TeamID)
		}
		c.Set("email", claims.Email)

		c.Next()
	}
}

// RoleMiddleware checks if user has required role
func RoleMiddleware(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleValue, exists := c.Get("role")
		if !exists {
			c.JSON(403, gin.H{"error": "Forbidden: role not found"})
			c.Abort()
			return
		}

		userRole := roleValue.(models.UserRole)
		for _, role := range allowedRoles {
			if userRole == role {
				c.Next()
				return
			}
		}

		c.JSON(403, gin.H{"error": "Forbidden: insufficient permissions"})
		c.Abort()
	}
}

// Helper functions to get claims from context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}
	userID, ok := userIDValue.(uuid.UUID)
	return userID, ok
}

func GetTeamID(c *gin.Context) (uuid.UUID, bool) {
	teamIDValue, exists := c.Get("team_id")
	if !exists {
		return uuid.Nil, false
	}
	teamID, ok := teamIDValue.(uuid.UUID)
	return teamID, ok
}

func GetRole(c *gin.Context) (models.UserRole, bool) {
	roleValue, exists := c.Get("role")
	if !exists {
		return "", false
	}
	role, ok := roleValue.(models.UserRole)
	return role, ok
}
