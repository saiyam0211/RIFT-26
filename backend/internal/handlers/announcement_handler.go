package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"
)

type AnnouncementHandler struct {
	announcementService *services.AnnouncementService
}

func NewAnnouncementHandler(announcementService *services.AnnouncementService) *AnnouncementHandler {
	return &AnnouncementHandler{announcementService: announcementService}
}

// POST /api/v1/admin/announcements
func (h *AnnouncementHandler) CreateAnnouncement(c *gin.Context) {
	var req models.CreateAnnouncementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get admin email from context (set by auth middleware)
	adminEmail := c.GetString("user_email")
	if adminEmail == "" {
		adminEmail = "admin@rift.com"
	}

	announcement, err := h.announcementService.CreateAnnouncement(req, adminEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Announcement created successfully",
		"announcement": announcement,
	})
}

// GET /api/v1/admin/announcements
func (h *AnnouncementHandler) GetAllAnnouncements(c *gin.Context) {
	announcements, err := h.announcementService.GetAllAnnouncements()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"announcements": announcements,
		"count":         len(announcements),
	})
}

// DELETE /api/v1/admin/announcements/:id
func (h *AnnouncementHandler) DeleteAnnouncement(c *gin.Context) {
	announcementID := c.Param("id")

	err := h.announcementService.DeleteAnnouncement(announcementID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Announcement deleted successfully"})
}

// GET /api/v1/teams/:id/announcements
// This endpoint is used by the dashboard to fetch announcements for a specific team
func (h *AnnouncementHandler) GetTeamAnnouncements(c *gin.Context) {
	teamID := c.Param("id")

	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	announcements, err := h.announcementService.GetAnnouncementsForTeam(teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, announcements)
}
