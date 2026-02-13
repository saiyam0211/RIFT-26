package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"
)

type EventTableHandler struct {
	service *services.EventTableService
}

func NewEventTableHandler(service *services.EventTableService) *EventTableHandler {
	return &EventTableHandler{service: service}
}

// CreateEventTable creates a new event table (admin only)
func (h *EventTableHandler) CreateEventTable(c *gin.Context) {
	var req models.CreateEventTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	table, err := h.service.CreateEventTable(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, table)
}

// GetEventTable retrieves an event table by ID
func (h *EventTableHandler) GetEventTable(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	table, err := h.service.GetEventTable(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, table)
}

// GetAllEventTables retrieves all event tables with optional filters
func (h *EventTableHandler) GetAllEventTables(c *gin.Context) {
	city := c.Query("city")
	isActiveStr := c.Query("is_active")

	var cityPtr *string
	var isActivePtr *bool

	if city != "" {
		cityPtr = &city
	}

	if isActiveStr != "" {
		isActive := isActiveStr == "true"
		isActivePtr = &isActive
	}

	tables, err := h.service.GetAllEventTables(cityPtr, isActivePtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tables": tables})
}

// UpdateEventTable updates an event table
func (h *EventTableHandler) UpdateEventTable(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	var req models.UpdateEventTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	table, err := h.service.UpdateEventTable(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, table)
}

// DeleteEventTable deletes an event table
func (h *EventTableHandler) DeleteEventTable(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	err = h.service.DeleteEventTable(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Event table deleted successfully"})
}
