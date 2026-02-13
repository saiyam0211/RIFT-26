package middleware

import (
	"net/http"
	"strings"

	"github.com/rift26/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// VolunteerAuthMiddleware validates volunteer JWT tokens
func VolunteerAuthMiddleware(volunteerService *services.VolunteerService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		token := parts[1]
		volunteer, err := volunteerService.VerifyToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Store volunteer in context
		c.Set("volunteer", volunteer)
		c.Set("volunteer_id", volunteer.ID)
		if volunteer.TableID != nil {
			c.Set("volunteer_table_id", *volunteer.TableID)
		}
		if volunteer.TableName != nil {
			c.Set("volunteer_table_name", *volunteer.TableName)
		}
		c.Set("volunteer_city", volunteer.City)
		c.Next()
	}
}

// VolunteerRoleMiddleware checks if volunteer has required role
func VolunteerRoleMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("volunteer_role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Volunteer role not found"})
			c.Abort()
			return
		}

		if role != requiredRole {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			c.Abort()
			return
		}

		c.Next()
	}
}
