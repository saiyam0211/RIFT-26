package handlers

import (
	"net/http"

	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type VolunteerAuthHandler struct {
	service *services.VolunteerService
}

func NewVolunteerAuthHandler(service *services.VolunteerService) *VolunteerAuthHandler {
	return &VolunteerAuthHandler{service: service}
}

// Login handles volunteer login
func (h *VolunteerAuthHandler) Login(c *gin.Context) {
	var req models.VolunteerLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// VerifyToken verifies the volunteer token and returns volunteer info
func (h *VolunteerAuthHandler) VerifyToken(c *gin.Context) {
	volunteer, exists := c.Get("volunteer")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"volunteer": volunteer})
}

// CreateVolunteer creates a new volunteer (admin only)
func (h *VolunteerAuthHandler) CreateVolunteer(c *gin.Context) {
	var req models.CreateVolunteerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get admin ID from context (set by admin auth middleware)
	adminID := uuid.Nil
	if userIDValue, exists := c.Get("user_id"); exists {
		// Try to convert to UUID
		switch v := userIDValue.(type) {
		case uuid.UUID:
			adminID = v
		case string:
			parsed, err := uuid.Parse(v)
			if err == nil {
				adminID = parsed
			}
		}
	}

	volunteer, err := h.service.CreateVolunteer(&req, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, volunteer)
}

// GetAllVolunteers retrieves all volunteers with optional filters (admin only)
func (h *VolunteerAuthHandler) GetAllVolunteers(c *gin.Context) {
	city := c.Query("city")
	tableIDStr := c.Query("table_id")

	var cityPtr *string
	var tableIDPtr *uuid.UUID

	if city != "" {
		cityPtr = &city
	}

	if tableIDStr != "" {
		tableID, err := uuid.Parse(tableIDStr)
		if err == nil {
			tableIDPtr = &tableID
		}
	}

	volunteers, err := h.service.GetAllVolunteers(cityPtr, tableIDPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"volunteers": volunteers})
}

// GetVolunteerByID retrieves a volunteer by ID (admin only)
func (h *VolunteerAuthHandler) GetVolunteerByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid volunteer ID"})
		return
	}

	// We can reuse service logic, might need to expose GetByID in service
	// Or use GetAll with filter, but that returns a slice.
	// Let's check service again.
	// Service has VerifyToken that calls repo.GetByID.
	// The repo likely has GetByID.
	// But service doesn't expose it directly except via VerifyToken.
	// Let's add GetByID to service and handler.

	// For now, let's use GetAll with filter as a hack if GetByID isn't in service?
	// No, let's do it properly. I will assume I can update service.

	// Wait, I can't update service here.
	// Let's implement this handler assuming service has GetByID, and if not I will add it to service next.

	volunteer, err := h.service.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Volunteer not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"volunteer": volunteer})
}

// GetVolunteerLogs retrieves activity logs for a volunteer (admin only)
func (h *VolunteerAuthHandler) GetVolunteerLogs(c *gin.Context) {
	volunteerIDStr := c.Param("id")
	volunteerID, err := uuid.Parse(volunteerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid volunteer ID"})
		return
	}

	limit := 50
	logs, err := h.service.GetVolunteerLogs(volunteerID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

// UpdateVolunteer updates a volunteer (admin only)
func (h *VolunteerAuthHandler) UpdateVolunteer(c *gin.Context) {
	volunteerIDStr := c.Param("id")
	volunteerID, err := uuid.Parse(volunteerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid volunteer ID"})
		return
	}

	var volunteer models.Volunteer
	if err := c.ShouldBindJSON(&volunteer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	volunteer.ID = volunteerID
	err = h.service.UpdateVolunteer(&volunteer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Volunteer updated successfully"})
}

// DeleteVolunteer deletes a volunteer (admin only)
func (h *VolunteerAuthHandler) DeleteVolunteer(c *gin.Context) {
	volunteerIDStr := c.Param("id")
	volunteerID, err := uuid.Parse(volunteerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid volunteer ID"})
		return
	}

	err = h.service.DeleteVolunteer(volunteerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Volunteer deleted successfully"})
}
