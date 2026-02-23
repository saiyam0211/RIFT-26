package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/services"
)

type CheckPSHandler struct {
	psSelectionService *services.PSSelectionService
}

func NewCheckPSHandler(psSelectionService *services.PSSelectionService) *CheckPSHandler {
	return &CheckPSHandler{psSelectionService: psSelectionService}
}

// GetPSSelections returns all checked_in teams and their PS selections (with city filter).
// GET /api/v1/checkps?city=BLR
func (h *CheckPSHandler) GetPSSelections(c *gin.Context) {
	city := c.Query("city")
	var cityPtr *string
	if city != "" {
		cityPtr = &city
	}
	list, err := h.psSelectionService.GetAllWithDetails(c.Request.Context(), cityPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"selections": list, "count": len(list)})
}

// GetSemiFinalists returns only semi-finalist teams and their PS selections (admin, city filter supported).
// GET /api/v1/admin/semi-finalists?city=BLR
func (h *CheckPSHandler) GetSemiFinalists(c *gin.Context) {
	city := c.Query("city")
	var cityPtr *string
	if city != "" {
		cityPtr = &city
	}
	list, err := h.psSelectionService.GetSemiFinalistsWithDetails(c.Request.Context(), cityPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"semi_finalists": list, "count": len(list)})
}

// MarkSemiFinalist marks a team as semi-finalist (admin only).
// POST /api/v1/admin/semi-finalists/:team_id
func (h *CheckPSHandler) MarkSemiFinalist(c *gin.Context) {
	teamID, err := uuid.Parse(c.Param("team_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}
	if err := h.psSelectionService.SetSemiFinalist(c.Request.Context(), teamID, true); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Team marked as semi-finalist"})
}

// UnmarkSemiFinalist removes semi-finalist flag (admin only).
// DELETE /api/v1/admin/semi-finalists/:team_id
func (h *CheckPSHandler) UnmarkSemiFinalist(c *gin.Context) {
	teamID, err := uuid.Parse(c.Param("team_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}
	if err := h.psSelectionService.SetSemiFinalist(c.Request.Context(), teamID, false); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Team removed from semi-finalists"})
}

// SetAwards sets position and best_web3 flags for a semi-finalist team (admin only).
// POST /api/v1/admin/semi-finalists/:team_id/awards
func (h *CheckPSHandler) SetAwards(c *gin.Context) {
	teamID, err := uuid.Parse(c.Param("team_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}
	var req struct {
		Position *int  `json:"position"`   // 1–5 or null
		BestWeb3 bool  `json:"best_web3"`  // true/false
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if err := h.psSelectionService.SetAwards(c.Request.Context(), teamID, req.Position, req.BestWeb3); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Awards updated"})
}
