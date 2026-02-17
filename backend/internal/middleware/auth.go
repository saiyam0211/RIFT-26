package middleware

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
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
			fmt.Printf("[AuthMiddleware] Token Validation Failed: %v\n", err)
			c.JSON(401, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

	// Debug Log
	fmt.Printf("[AuthMiddleware] Success. UserID: %v, Role: %v, Email: %s\n", claims.UserID, claims.Role, claims.Email)

	// Set user info in context
	c.Set("user_id", claims.UserID)
	c.Set("role", claims.Role)
	if claims.TeamID != nil {
		c.Set("team_id", *claims.TeamID)
	}
	c.Set("email", claims.Email)
	c.Set("user_email", claims.Email) // Also set as user_email for compatibility

	// Extract additional claims from raw token for volunteers (city)
	// Re-parse as MapClaims to get volunteer-specific fields
	rawToken := parts[1]
	if mapToken, err := jwt.Parse(rawToken, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	}); err == nil {
		if mapClaims, ok := mapToken.Claims.(jwt.MapClaims); ok {
			// Extract city
			if city, ok := mapClaims["city"].(string); ok {
				c.Set("city", city)
			}
		}
	}

	c.Next()
	}
}

// RoleMiddleware checks if user has required role
func RoleMiddleware(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleValue, exists := c.Get("role")
		if !exists {
			fmt.Println("[RoleMiddleware] Role not found in context")
			c.JSON(403, gin.H{"error": "Forbidden: role not found"})
			c.Abort()
			return
		}

		userRole := roleValue.(models.UserRole)
		fmt.Printf("[RoleMiddleware] Checking Role. UserRole: %v, Allowed: %v\n", userRole, allowedRoles)

		for _, role := range allowedRoles {
			if userRole == role {
				c.Next()
				return
			}
		}

		fmt.Printf("[RoleMiddleware] Access Denied. UserRole: %v != Allowed: %v\n", userRole, allowedRoles)
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
