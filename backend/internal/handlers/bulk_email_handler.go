package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"
)

type BulkEmailHandler struct {
	db           *sql.DB
	emailService interface {
		SendBulkCustomEmail([]string, string, string) error
	}
	announcementService *services.AnnouncementService
}

func NewBulkEmailHandler(
	db *sql.DB,
	emailService interface {
		SendBulkCustomEmail([]string, string, string) error
	},
	announcementService *services.AnnouncementService,
) *BulkEmailHandler {
	return &BulkEmailHandler{
		db:                  db,
		emailService:        emailService,
		announcementService: announcementService,
	}
}

// POST /api/v1/admin/send-bulk-email
func (h *BulkEmailHandler) SendBulkEmail(c *gin.Context) {
	var req models.SendEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminEmail := c.GetString("user_email")
	if adminEmail == "" {
		adminEmail = "admin@rift.com"
	}

	// Get matching teams based on filters
	matchingTeams, err := h.announcementService.GetTeamsMatchingFilters(req.Filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(matchingTeams) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No teams match the specified filters"})
		return
	}

	// Get all recipient emails (leaders + members)
	recipients, err := h.getRecipientEmails(matchingTeams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Send emails
	err = h.emailService.SendBulkCustomEmail(recipients, req.Subject, req.HTMLContent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to send emails: %v", err)})
		return
	}

	// Log the email
	filtersJSON, _ := json.Marshal(req.Filters)
	recipientsJSON, _ := json.Marshal(recipients)

	// Get admin user ID
	var adminID uuid.UUID
	err = h.db.QueryRow(`SELECT id FROM users WHERE email = $1 LIMIT 1`, adminEmail).Scan(&adminID)
	if err != nil || adminID == uuid.Nil {
		adminID = uuid.Nil
	}

	var adminIDPtr *uuid.UUID
	if adminID != uuid.Nil {
		adminIDPtr = &adminID
	}

	_, err = h.db.Exec(`
		INSERT INTO email_logs (id, subject, recipients, html_content, filters, sent_count, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, uuid.New(), req.Subject, recipientsJSON, req.HTMLContent, filtersJSON, len(recipients), adminIDPtr, time.Now())

	c.JSON(http.StatusOK, gin.H{
		"message":          "Emails sent successfully",
		"recipients_count": len(recipients),
		"teams_count":      len(matchingTeams),
	})
}

func (h *BulkEmailHandler) getRecipientEmails(teamIDs []uuid.UUID) ([]string, error) {
	if len(teamIDs) == 0 {
		return []string{}, nil
	}

	placeholders := ""
	args := make([]interface{}, len(teamIDs))
	for i, tid := range teamIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += fmt.Sprintf("$%d", i+1)
		args[i] = tid
	}

	query := fmt.Sprintf(`
		SELECT DISTINCT email
		FROM team_members
		WHERE team_id IN (%s)
		ORDER BY email
	`, placeholders)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var emails []string
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err != nil {
			continue
		}
		emails = append(emails, email)
	}

	return emails, nil
}

// GET /api/v1/admin/email-logs
func (h *BulkEmailHandler) GetEmailLogs(c *gin.Context) {
	rows, err := h.db.Query(`
		SELECT id, subject, sent_count, created_by, created_at
		FROM email_logs
		ORDER BY created_at DESC
		LIMIT 50
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var logs []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var subject string
		var sentCount int
		var createdBy sql.NullString
		var createdAt time.Time

		if err := rows.Scan(&id, &subject, &sentCount, &createdBy, &createdAt); err != nil {
			continue
		}

		log := map[string]interface{}{
			"id":         id,
			"subject":    subject,
			"sent_count": sentCount,
			"created_at": createdAt,
		}
		if createdBy.Valid {
			uid, _ := uuid.Parse(createdBy.String)
			log["created_by"] = uid
		}

		logs = append(logs, log)
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":  logs,
		"count": len(logs),
	})
}
