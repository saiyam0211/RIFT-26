package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/middleware"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/services"
	"gorm.io/gorm"
)

type VolunteerAdminHandler struct {
	volunteerAdminService *services.VolunteerAdminService
	volunteerRepo         *repository.VolunteerRepository
	checkinRepo           *repository.ParticipantCheckInRepository
	seatAllocService      *services.SeatAllocationService
	gormDB                *gorm.DB
}

func NewVolunteerAdminHandler(
	volunteerAdminService *services.VolunteerAdminService,
	volunteerRepo *repository.VolunteerRepository,
	checkinRepo *repository.ParticipantCheckInRepository,
	seatAllocService *services.SeatAllocationService,
	gormDB *gorm.DB,
) *VolunteerAdminHandler {
	return &VolunteerAdminHandler{
		volunteerAdminService: volunteerAdminService,
		volunteerRepo:         volunteerRepo,
		checkinRepo:          checkinRepo,
		seatAllocService:     seatAllocService,
		gormDB:               gormDB,
	}
}

// Login is public; returns token with role=volunteer_admin and city.
func (h *VolunteerAdminHandler) Login(c *gin.Context) {
	var req models.VolunteerAdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.volunteerAdminService.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// getCityFromContext returns the volunteer_admin's city (set from JWT).
func getCityFromContext(c *gin.Context) string {
	cityVal, _ := c.Get("city")
	if s, ok := cityVal.(string); ok && s != "" {
		return s
	}
	return ""
}

// normalizeCity for comparison (BLR, bengaluru, bangalore -> BLR).
func normalizeCityForFilter(city string) string {
	lower := strings.ToLower(strings.TrimSpace(city))
	switch {
	case lower == "bengaluru" || lower == "bangalore" || lower == "blr":
		return "BLR"
	case lower == "pune":
		return "PUNE"
	case lower == "noida":
		return "NOIDA"
	case lower == "lucknow" || lower == "lko":
		return "LKO"
	}
	return strings.ToUpper(lower)
}

// GetVolunteers returns volunteers for the admin's city.
func (h *VolunteerAdminHandler) GetVolunteers(c *gin.Context) {
	city := getCityFromContext(c)
	if city == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "city not set"})
		return
	}
	normalized := normalizeCityForFilter(city)
	volunteers, err := h.volunteerRepo.GetAll(&normalized, nil)
	if err != nil {
		log.Printf("[VolunteerAdmin] GetVolunteers: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch volunteers", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"volunteers": volunteers, "city": city})
}

// GetCheckIns returns recent check-ins for the admin's city.
func (h *VolunteerAdminHandler) GetCheckIns(c *gin.Context) {
	city := getCityFromContext(c)
	if city == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "city not set"})
		return
	}
	normalized := normalizeCityForFilter(city)
	limit := 200
	list, err := h.checkinRepo.GetRecentByCity(normalized, limit)
	if err != nil {
		log.Printf("[VolunteerAdmin] GetCheckIns: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch check-ins", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"check_ins": list, "city": city})
}

// GetCheckInTeams returns checked-in teams (team name, size, room allocated) with optional filters.
func (h *VolunteerAdminHandler) GetCheckInTeams(c *gin.Context) {
	city := getCityFromContext(c)
	if city == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "city not set"})
		return
	}
	normalized := normalizeCityForFilter(city)
	limit := 200
	if l := c.Query("limit"); l != "" {
		if n, err := parseInt(l, 10, 1, 500); err == nil {
			limit = n
		}
	}
	f := repository.CheckedInTeamFilters{
		TeamNameSearch:  strings.TrimSpace(c.Query("search")),
		VolunteerEmail:  strings.TrimSpace(c.Query("volunteer_email")),
		FromDate:        strings.TrimSpace(c.Query("from_date")),
		ToDate:          strings.TrimSpace(c.Query("to_date")),
		RoomNameFilter:  strings.TrimSpace(c.Query("room")),
	}
	list, err := h.checkinRepo.GetCheckedInTeamsByCity(normalized, limit, f)
	if err != nil {
		log.Printf("[VolunteerAdmin] GetCheckInTeams: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch checked-in teams", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"check_in_teams": list, "city": city})
}

func parseInt(s string, base, min, max int) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	if err != nil {
		return 0, err
	}
	if n < min {
		return min, nil
	}
	if n > max {
		return max, nil
	}
	return n, nil
}

// GetSeatSummary returns seat allocation summary for the city (Bengaluru only has seats).
func (h *VolunteerAdminHandler) GetSeatSummary(c *gin.Context) {
	city := getCityFromContext(c)
	if city == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "city not set"})
		return
	}
	normalized := normalizeCityForFilter(city)
	if normalized != "BLR" {
		c.JSON(http.StatusOK, gin.H{"city": city, "seat_allocation_available": false, "message": "Seat allocation is only for Bengaluru"})
		return
	}
	if h.seatAllocService == nil {
		c.JSON(http.StatusOK, gin.H{"city": city, "seat_allocation_available": false})
		return
	}
	stats, err := h.seatAllocService.GetAllocationStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch seat stats"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"city": city, "seat_allocation_available": true, "stats": stats})
}

// CreateVolunteerAdmin (admin only) creates a new volunteer admin for a city.
func (h *VolunteerAdminHandler) CreateVolunteerAdmin(c *gin.Context) {
	var req models.CreateVolunteerAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID, _ := middleware.GetUserID(c)
	v, err := h.volunteerAdminService.Create(&req, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Don't return password hash
	c.JSON(http.StatusCreated, gin.H{
		"id":         v.ID,
		"email":      v.Email,
		"city":       v.City,
		"is_active":  v.IsActive,
		"created_at": v.CreatedAt,
	})
}

// GetAllVolunteerAdmins (admin only) lists all volunteer admins.
func (h *VolunteerAdminHandler) GetAllVolunteerAdmins(c *gin.Context) {
	list, err := h.volunteerAdminService.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Strip password hash from response
	out := make([]gin.H, 0, len(list))
	for _, v := range list {
		out = append(out, gin.H{
			"id":         v.ID.String(),
			"email":      v.Email,
			"city":       v.City,
			"is_active":  v.IsActive,
			"created_at": v.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"volunteer_admins": out})
}

// DeleteVolunteerAdmin (admin only) deletes a volunteer admin.
func (h *VolunteerAdminHandler) DeleteVolunteerAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.volunteerAdminService.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Volunteer admin deleted"})
}
