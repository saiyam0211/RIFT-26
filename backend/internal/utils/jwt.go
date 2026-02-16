package utils

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
)

type Claims struct {
	UserID uuid.UUID       `json:"user_id"`
	TeamID *uuid.UUID      `json:"team_id,omitempty"`
	Email  string          `json:"email,omitempty"`
	Role   models.UserRole `json:"role"`
	jwt.RegisteredClaims
}

// GenerateJWT creates a JWT token for a user
func GenerateJWT(userID uuid.UUID, email string, role models.UserRole, teamID *uuid.UUID, secret string) (string, error) {
	claims := Claims{
		UserID: userID,
		TeamID: teamID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "rift26-api",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateJWT validates a JWT token and returns the claims
func ValidateJWT(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Handle both Claims struct and MapClaims (for volunteer tokens)
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	// If token was created with MapClaims, extract and convert
	if mapClaims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		claims := &Claims{}
		
		// Extract user_id
		if userIDStr, ok := mapClaims["user_id"].(string); ok {
			userID, err := uuid.Parse(userIDStr)
			if err == nil {
				claims.UserID = userID
			}
		}
		
		// Extract email
		if email, ok := mapClaims["email"].(string); ok {
			claims.Email = email
		}
		
		// Extract role (critical for RoleMiddleware)
		if roleStr, ok := mapClaims["role"].(string); ok {
			claims.Role = models.UserRole(roleStr)
		} else {
			// Fallback: if role not found, try to infer from type or default to volunteer
			if roleType, ok := mapClaims["type"].(string); ok && roleType == "volunteer" {
				claims.Role = models.UserRoleVolunteer
			} else {
				claims.Role = models.UserRoleVolunteer // Default for volunteer tokens
			}
		}
		
		// Extract team_id if present
		if teamIDStr, ok := mapClaims["team_id"].(string); ok {
			teamID, err := uuid.Parse(teamIDStr)
			if err == nil {
				claims.TeamID = &teamID
			}
		}
		
		// Note: table_id and city are in MapClaims but not in Claims struct
		// They'll be extracted separately by middleware if needed
		
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}
