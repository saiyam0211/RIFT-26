package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/services"
)

type PSSubmissionHandler struct {
	service *services.PSSubmissionService
}

func NewPSSubmissionHandler(service *services.PSSubmissionService) *PSSubmissionHandler {
	return &PSSubmissionHandler{service: service}
}

// GetTeamForm returns the submission form and existing data for a team.
// GET /api/v1/teams/:id/submission
func (h *PSSubmissionHandler) GetTeamForm(c *gin.Context) {
	teamID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}
	form, err := h.service.GetTeamForm(c.Request.Context(), teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, form)
}

// Submit handles project submission for a team.
// POST /api/v1/teams/:id/submission
func (h *PSSubmissionHandler) Submit(c *gin.Context) {
	teamID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}
	var req struct {
		LinkedinURL       string                 `json:"linkedin_url"`
		GithubURL        string                 `json:"github_url"`
		LiveURL          string                 `json:"live_url"`
		ExtraNotes       string                 `json:"extra_notes"`
		CustomFieldValues map[string]interface{} `json:"custom_field_values,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}
	// Coerce custom field values to string (client may send strings or other types)
	customStrings := make(map[string]string)
	for k, v := range req.CustomFieldValues {
		if v == nil {
			customStrings[k] = ""
			continue
		}
		switch val := v.(type) {
		case string:
			customStrings[k] = val
		default:
			customStrings[k] = fmt.Sprint(val)
		}
	}
	if err := h.service.Submit(c.Request.Context(), teamID, req.LinkedinURL, req.GithubURL, req.LiveURL, req.ExtraNotes, customStrings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Submission saved"})
}

