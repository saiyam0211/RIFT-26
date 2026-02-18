package services

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
)

// PS release: 19 Feb 2026 11:00 AM IST = 2026-02-19 05:30 UTC
var defaultReleaseTime = time.Date(2026, 2, 19, 5, 30, 0, 0, time.UTC)

const settingKeyPSReleasedAt = "ps_released_at"
const settingKeyPSSubmissionOpen = "ps_submission_open" // "true" or "false"

type ProblemStatementService struct {
	repo       *repository.ProblemStatementRepository
	settingsRepo *repository.SettingsRepository
	baseURL    string // e.g. https://api.example.com - for building download URLs
	uploadDir  string
}

func NewProblemStatementService(repo *repository.ProblemStatementRepository, settingsRepo *repository.SettingsRepository, baseURL, uploadDir string) *ProblemStatementService {
	return &ProblemStatementService{repo: repo, settingsRepo: settingsRepo, baseURL: baseURL, uploadDir: uploadDir}
}

// IsReleased returns true if problem statements should be visible (after 19 Feb 2026 11 AM IST or early release).
func (s *ProblemStatementService) IsReleased(ctx context.Context) (bool, error) {
	val, err := s.settingsRepo.Get(ctx, settingKeyPSReleasedAt)
	if err != nil {
		return false, err
	}
	if val != "" {
		t, err := time.Parse(time.RFC3339, val)
		if err == nil && time.Now().UTC().After(t) {
			return true, nil
		}
	}
	return time.Now().UTC().After(defaultReleaseTime), nil
}

// ReleaseEarly sets ps_released_at to now (for testing).
func (s *ProblemStatementService) ReleaseEarly(ctx context.Context) error {
	return s.settingsRepo.Set(ctx, settingKeyPSReleasedAt, time.Now().UTC().Format(time.RFC3339))
}

// ResetRelease clears the early-release flag so the countdown shows again (for testing).
func (s *ProblemStatementService) ResetRelease(ctx context.Context) error {
	return s.settingsRepo.Delete(ctx, settingKeyPSReleasedAt)
}

// ListPublic returns problem statements for public only if released; otherwise nil, false.
func (s *ProblemStatementService) ListPublic(ctx context.Context) ([]models.ProblemStatementPublic, bool, error) {
	released, err := s.IsReleased(ctx)
	if err != nil || !released {
		return nil, false, err
	}
	list, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, false, err
	}
	out := make([]models.ProblemStatementPublic, 0, len(list))
	for _, ps := range list {
		// Download URL: if FilePath is a full URL (e.g. Google Drive link), use as-is; else legacy local file
		var downloadURL string
		if strings.HasPrefix(ps.FilePath, "http://") || strings.HasPrefix(ps.FilePath, "https://") {
			downloadURL = ps.FilePath
		} else {
			filename := filepath.Base(ps.FilePath)
			downloadURL = s.baseURL + "/api/v1/uploads/problem-statements/" + filename
		}
		out = append(out, models.ProblemStatementPublic{
			ID:          ps.ID.String(),
			Track:       ps.Track,
			Name:        ps.Name,
			DownloadURL: downloadURL,
			CreatedAt:   ps.CreatedAt.Format(time.RFC3339),
		})
	}
	return out, true, nil
}

// ListAdmin returns all problem statements (admin only).
func (s *ProblemStatementService) ListAdmin(ctx context.Context) ([]models.PSItem, error) {
	return s.repo.GetAll(ctx)
}

// Create saves a new problem statement (track, name, file path after upload).
func (s *ProblemStatementService) Create(ctx context.Context, track, name, filePath string) (*models.PSItem, error) {
	ps := &models.PSItem{Track: track, Name: name, FilePath: filePath}
	if err := s.repo.Create(ctx, ps); err != nil {
		return nil, fmt.Errorf("create problem statement: %w", err)
	}
	return ps, nil
}

// Delete removes a problem statement by ID.
func (s *ProblemStatementService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// UploadDir returns the directory for storing PDFs.
func (s *ProblemStatementService) UploadDir() string {
	return s.uploadDir
}

// IsSubmissionOpen returns true if PS submission window is unlocked by admin.
func (s *ProblemStatementService) IsSubmissionOpen(ctx context.Context) (bool, error) {
	val, err := s.settingsRepo.Get(ctx, settingKeyPSSubmissionOpen)
	if err != nil {
		return false, err
	}
	return val == "true", nil
}

// SetSubmissionOpen sets PS submission window open/closed (admin).
func (s *ProblemStatementService) SetSubmissionOpen(ctx context.Context, open bool) error {
	val := "false"
	if open {
		val = "true"
	}
	return s.settingsRepo.Set(ctx, settingKeyPSSubmissionOpen, val)
}
