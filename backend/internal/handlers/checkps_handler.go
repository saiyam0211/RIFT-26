package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
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
