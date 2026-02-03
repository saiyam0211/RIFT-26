package handlers

import (
	"net/http"

	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"

	"github.com/gin-gonic/gin"
)

type TicketHandler struct {
	ticketService *services.TicketService
}

func NewTicketHandler(ticketService *services.TicketService) *TicketHandler {
	return &TicketHandler{ticketService: ticketService}
}

// POST /api/v1/tickets
func (h *TicketHandler) CreateTicket(c *gin.Context) {
	var req models.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, err := h.ticketService.CreateTicket(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Ticket created successfully",
		"ticket":  ticket,
	})
}

// GET /api/v1/admin/tickets
func (h *TicketHandler) GetAllTickets(c *gin.Context) {
	status := c.DefaultQuery("status", "all")

	tickets, err := h.ticketService.GetAllTickets(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tickets": tickets,
		"count":   len(tickets),
	})
}

// GET /api/v1/admin/tickets/:id
func (h *TicketHandler) GetTicket(c *gin.Context) {
	ticketID := c.Param("id")

	ticket, err := h.ticketService.GetTicketByID(ticketID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	c.JSON(http.StatusOK, ticket)
}

// POST /api/v1/admin/tickets/:id/resolve
func (h *TicketHandler) ResolveTicket(c *gin.Context) {
	ticketID := c.Param("id")
	adminEmail := c.GetString("admin_email") // From auth middleware

	if adminEmail == "" {
		adminEmail = "admin" // Fallback
	}

	var req models.ResolveTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.ticketService.ResolveTicket(ticketID, req, adminEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ticket resolved successfully"})
}

// PATCH /api/v1/admin/tickets/:id/status
func (h *TicketHandler) UpdateTicketStatus(c *gin.Context) {
	ticketID := c.Param("id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.ticketService.UpdateTicketStatus(ticketID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}
