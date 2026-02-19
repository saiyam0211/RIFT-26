package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
)

const settingKeyPSSubmissionPortalOpen = "ps_final_submission_open" // Same key as ProblemStatementService uses

type PSSubmissionService struct {
	subRepo        *repository.PSSubmissionRepository
	selectionRepo  *repository.PSSelectionRepository
	teamRepo       *repository.TeamRepository
	psRepo         *repository.ProblemStatementRepository
	settingsRepo   *repository.SettingsRepository
}

func NewPSSubmissionService(
	subRepo *repository.PSSubmissionRepository,
	selectionRepo *repository.PSSelectionRepository,
	teamRepo *repository.TeamRepository,
	psRepo *repository.ProblemStatementRepository,
	settingsRepo *repository.SettingsRepository,
) *PSSubmissionService {
	return &PSSubmissionService{
		subRepo:       subRepo,
		selectionRepo: selectionRepo,
		teamRepo:      teamRepo,
		psRepo:        psRepo,
		settingsRepo:  settingsRepo,
	}
}

func (s *PSSubmissionService) IsPortalOpen(ctx context.Context) (bool, error) {
	val, err := s.settingsRepo.Get(ctx, settingKeyPSSubmissionPortalOpen)
	if err != nil {
		return false, err
	}
	return val == "true", nil
}

func (s *PSSubmissionService) SetPortalOpen(ctx context.Context, open bool) error {
	val := "false"
	if open {
		val = "true"
	}
	return s.settingsRepo.Set(ctx, settingKeyPSSubmissionPortalOpen, val)
}

type PSSubmissionForm struct {
	Allowed           bool                     `json:"allowed"`
	PortalOpen        bool                     `json:"portal_open"`
	Submitted         bool                     `json:"submitted"` // true when team has already saved a submission (read-only form)
	ProblemName       string                   `json:"problem_name,omitempty"`
	LinkedinURL       string                   `json:"linkedin_url,omitempty"`
	GithubURL         string                   `json:"github_url,omitempty"`
	LiveURL           string                   `json:"live_url,omitempty"`
	ExtraNotes        string                   `json:"extra_notes,omitempty"`
	CustomFieldValues map[string]string        `json:"custom_field_values,omitempty"`
	Fields            PSSubmissionFieldsConfig `json:"fields"`
}

type PSSubmissionFieldsConfig struct {
	Linkedin     bool                     `json:"linkedin"`
	Github       bool                     `json:"github"`
	Live         bool                     `json:"live"`
	ExtraNotes   bool                     `json:"extra_notes"`
	CustomFields []CustomFieldDefinition  `json:"custom_fields,omitempty"`
}

type CustomFieldDefinition struct {
	Key   string `json:"key"`   // e.g., "custom_1", "custom_2"
	Label string `json:"label"` // e.g., "Demo Video", "Documentation"
}

// GetTeamForm returns submission form data for a team if portal is open and PS is locked.
func (s *PSSubmissionService) GetTeamForm(ctx context.Context, teamID uuid.UUID) (*PSSubmissionForm, error) {
	form := &PSSubmissionForm{}

	open, err := s.IsPortalOpen(ctx)
	if err != nil {
		return nil, fmt.Errorf("check portal status: %w", err)
	}
	form.PortalOpen = open
	if !open {
		// Portal closed; nothing more to show
		return form, nil
	}

	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("get team: %w", err)
	}
	if team == nil || team.Status != models.StatusCheckedIn {
		return form, nil
	}

	// Team must have locked a PS
	sel, err := s.selectionRepo.GetByTeamID(ctx, teamID)
	if err != nil || sel == nil {
		return form, nil
	}

	ps, err := s.psRepo.GetByID(ctx, sel.ProblemStatementID)
	if err != nil || ps == nil {
		return form, nil
	}

	form.Allowed = true
	form.ProblemName = ps.Name

	// Use submission criteria for this PS only. Omitted booleans = false so only configured fields show.
	var cfg PSSubmissionFieldsConfig
	if ps.SubmissionFields.Valid && ps.SubmissionFields.String != "" {
		_ = json.Unmarshal([]byte(ps.SubmissionFields.String), &cfg)
	} else {
		// No config stored: default all standard fields on for backward compatibility
		cfg = PSSubmissionFieldsConfig{
			Linkedin:   true,
			Github:     true,
			Live:       true,
			ExtraNotes: true,
		}
	}
	form.Fields = cfg

	// Existing submission if any
	existing, err := s.subRepo.GetByTeamAndPS(ctx, teamID, sel.ProblemStatementID)
	if err == nil && existing != nil {
		form.Submitted = true
		form.LinkedinURL = existing.LinkedinURL
		form.GithubURL = existing.GithubURL
		form.LiveURL = existing.LiveURL
		form.ExtraNotes = existing.ExtraNotes
		// Load custom fields if present
		if existing.CustomFields.Valid && existing.CustomFields.String != "" {
			var customFields map[string]string
			if err := json.Unmarshal([]byte(existing.CustomFields.String), &customFields); err == nil {
				form.CustomFieldValues = customFields
			}
		}
	}

	return form, nil
}

// Submit saves the submission for a team; requires checked_in and locked PS.
func (s *PSSubmissionService) Submit(
	ctx context.Context,
	teamID uuid.UUID,
	linkedinURL, githubURL, liveURL, extraNotes string,
	customFieldValues map[string]string,
) error {
	open, err := s.IsPortalOpen(ctx)
	if err != nil {
		return fmt.Errorf("check portal status: %w", err)
	}
	if !open {
		return fmt.Errorf("submission portal is closed")
	}

	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("get team: %w", err)
	}
	if team == nil || team.Status != models.StatusCheckedIn {
		return fmt.Errorf("team must be checked_in to submit")
	}

	sel, err := s.selectionRepo.GetByTeamID(ctx, teamID)
	if err != nil || sel == nil {
		return fmt.Errorf("team has not locked a problem statement yet")
	}

	// Basic trimming; detailed URL validation can be added if needed
	sub := &models.PSSubmission{
		TeamID:             teamID,
		ProblemStatementID: sel.ProblemStatementID,
		LinkedinURL:        strings.TrimSpace(linkedinURL),
		GithubURL:          strings.TrimSpace(githubURL),
		LiveURL:            strings.TrimSpace(liveURL),
		ExtraNotes:         strings.TrimSpace(extraNotes),
	}

	// Handle custom fields
	if len(customFieldValues) > 0 {
		customFieldsJSON, err := json.Marshal(customFieldValues)
		if err != nil {
			return fmt.Errorf("marshal custom fields: %w", err)
		}
		sub.CustomFields = sql.NullString{
			String: string(customFieldsJSON),
			Valid:  true,
		}
	}

	if err := s.subRepo.Upsert(ctx, sub); err != nil {
		return err
	}
	return nil
}

