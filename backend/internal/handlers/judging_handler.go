package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/repository"
)

type JudgingHandler struct {
	subRepo *repository.PSSubmissionRepository
}

func NewJudgingHandler(subRepo *repository.PSSubmissionRepository) *JudgingHandler {
	return &JudgingHandler{subRepo: subRepo}
}

// JudgingRowResponse is the API response row (custom_fields as map).
type JudgingRowResponse struct {
	TeamID             string            `json:"team_id"`
	TeamName           string            `json:"team_name"`
	City               string            `json:"city"`
	LeaderName         string            `json:"leader_name"`
	LeaderEmail        string            `json:"leader_email"`
	MemberNames        string            `json:"member_names"`
	ProblemStatementID string            `json:"problem_statement_id"`
	PSTrack            string            `json:"ps_track"`
	PSName             string            `json:"ps_name"`
	LinkedinURL        string            `json:"linkedin_url"`
	GithubURL          string            `json:"github_url"`
	LiveURL            string            `json:"live_url"`
	ExtraNotes         string            `json:"extra_notes"`
	CustomFields       map[string]string  `json:"custom_fields,omitempty"`
	SubmittedAt        string            `json:"submitted_at"`
}

// GetSubmissions returns all submitted projects with optional city and PS filters.
// GET /api/v1/judging/submissions?city=BLR&problem_statement_id=uuid
func (h *JudgingHandler) GetSubmissions(c *gin.Context) {
	var city *string
	if v := c.Query("city"); v != "" {
		city = &v
	}
	var psID *uuid.UUID
	if v := c.Query("problem_statement_id"); v != "" {
		if parsed, err := uuid.Parse(v); err == nil {
			psID = &parsed
		}
	}
	list, err := h.subRepo.GetAllForJudging(c.Request.Context(), city, psID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Convert to response with parsed custom_fields
	resp := make([]JudgingRowResponse, 0, len(list))
	for _, row := range list {
		r := JudgingRowResponse{
			TeamID:             row.TeamID.String(),
			TeamName:           row.TeamName,
			LeaderName:         row.LeaderName,
			LeaderEmail:        row.LeaderEmail,
			MemberNames:        row.MemberNames,
			ProblemStatementID: row.ProblemStatementID.String(),
			PSTrack:            row.PSTrack,
			PSName:             row.PSName,
			LinkedinURL:        row.LinkedinURL,
			GithubURL:          row.GithubURL,
			LiveURL:            row.LiveURL,
			ExtraNotes:         row.ExtraNotes,
			SubmittedAt:        row.SubmittedAt,
		}
		if row.City != nil {
			r.City = *row.City
		}
		if row.CustomFieldsJSON.Valid && row.CustomFieldsJSON.String != "" {
			var raw map[string]interface{}
			if json.Unmarshal([]byte(row.CustomFieldsJSON.String), &raw) == nil {
				r.CustomFields = make(map[string]string)
				for k, v := range raw {
					if v == nil {
						r.CustomFields[k] = ""
					} else if s, ok := v.(string); ok {
						r.CustomFields[k] = s
					} else {
						r.CustomFields[k] = fmt.Sprint(v)
					}
				}
			}
		}
		resp = append(resp, r)
	}
	// Build custom field labels map from all PS submission_fields configs
	fieldLabels := make(map[string]string)
	for _, row := range list {
		if row.PSFieldsJSON.Valid && row.PSFieldsJSON.String != "" {
			var psConfig struct {
				CustomFields []struct {
					Key   string `json:"key"`
					Label string `json:"label"`
				} `json:"custom_fields"`
			}
			if json.Unmarshal([]byte(row.PSFieldsJSON.String), &psConfig) == nil {
				for _, cf := range psConfig.CustomFields {
					if _, exists := fieldLabels[cf.Key]; !exists {
						fieldLabels[cf.Key] = cf.Label
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"count":          len(resp),
		"submissions":    resp,
		"field_labels":   fieldLabels, // Map of custom field key -> label
	})
}
