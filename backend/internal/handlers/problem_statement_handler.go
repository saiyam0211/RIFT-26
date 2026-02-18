package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/services"
)

type ProblemStatementHandler struct {
	service *services.ProblemStatementService
}

func NewProblemStatementHandler(service *services.ProblemStatementService) *ProblemStatementHandler {
	return &ProblemStatementHandler{service: service}
}

// GetPublic returns problem statements for the public only if released (11 AM 19 Feb or after early release).
// GET /api/v1/problem-statements
func (h *ProblemStatementHandler) GetPublic(c *gin.Context) {
	list, released, err := h.service.ListPublic(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load problem statements"})
		return
	}
	if !released {
		c.JSON(http.StatusForbidden, gin.H{"error": "Problem statements are not yet released", "released": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"released": true, "problem_statements": list})
}

// ServePDF serves a problem statement PDF by filename (only files under upload dir).
// GET /api/v1/uploads/problem-statements/:filename
func (h *ProblemStatementHandler) ServePDF(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" || strings.Contains(filename, "..") || strings.ContainsRune(filename, filepath.Separator) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename"})
		return
	}
	fullPath := filepath.Join(h.service.UploadDir(), filename)
	c.File(fullPath)
}

// ListAdmin returns all problem statements (admin).
// GET /api/v1/admin/problem-statements
func (h *ProblemStatementHandler) ListAdmin(c *gin.Context) {
	list, err := h.service.ListAdmin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"problem_statements": list})
}

// CreateAdmin creates a problem statement with a Google Drive (or any) PDF link (admin).
// POST /api/v1/admin/problem-statements (form: track, name, link)
func (h *ProblemStatementHandler) CreateAdmin(c *gin.Context) {
	track := strings.TrimSpace(c.PostForm("track"))
	name := strings.TrimSpace(c.PostForm("name"))
	link := strings.TrimSpace(c.PostForm("link"))
	if track == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "track and name are required"})
		return
	}
	if link == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "link is required (e.g. Google Drive share link)"})
		return
	}
	parsed, err := url.Parse(link)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "link must be a valid URL"})
		return
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "link must be http or https"})
		return
	}
	// Store the full URL in file_path (used as download URL when it's a link)
	ps, err := h.service.Create(c.Request.Context(), track, name, link)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, ps)
}

// DeleteAdmin deletes a problem statement (admin).
// DELETE /api/v1/admin/problem-statements/:id
func (h *ProblemStatementHandler) DeleteAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ReleaseEarly sets release time to now for testing (admin).
// POST /api/v1/admin/problem-statements/release-early
func (h *ProblemStatementHandler) ReleaseEarly(c *gin.Context) {
	if err := h.service.ReleaseEarly(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Problem statements released now (for testing)"})
}

// ResetRelease clears the early-release flag so the timer/countdown shows again (admin, testing only).
// POST /api/v1/admin/problem-statements/reset-release
func (h *ProblemStatementHandler) ResetRelease(c *gin.Context) {
	if err := h.service.ResetRelease(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Release reset. Timer will show until 11 AM 19 Feb or release early again."})
}

// GetSubmissionStatus returns PS submission window status (admin).
// GET /api/v1/admin/problem-statements/submission-status
func (h *ProblemStatementHandler) GetSubmissionStatus(c *gin.Context) {
	open, err := h.service.IsSubmissionOpen(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"submission_open": open})
}

// ToggleSubmissionWindow toggles PS submission window open/closed (admin).
// POST /api/v1/admin/problem-statements/toggle-submission
func (h *ProblemStatementHandler) ToggleSubmissionWindow(c *gin.Context) {
	var req struct {
		Open bool `json:"open"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.service.SetSubmissionOpen(c.Request.Context(), req.Open); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	status := "locked"
	if req.Open {
		status = "unlocked"
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("PS submission window %s", status), "submission_open": req.Open})
}
