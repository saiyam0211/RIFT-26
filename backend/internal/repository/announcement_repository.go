package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"
)

type AnnouncementRepository struct {
	db *database.DB
}

func NewAnnouncementRepository(db *database.DB) *AnnouncementRepository {
	return &AnnouncementRepository{db: db}
}

// GetActiveAnnouncements retrieves all active announcements ordered by priority
func (r *AnnouncementRepository) GetActiveAnnouncements(ctx context.Context) ([]models.Announcement, error) {
	query := `
		SELECT id, title, content, priority, is_active, created_by, created_at, updated_at
		FROM announcements
		WHERE is_active = true
		ORDER BY priority DESC, created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get announcements: %w", err)
	}
	defer rows.Close()

	var announcements []models.Announcement
	for rows.Next() {
		var announcement models.Announcement
		err := rows.Scan(
			&announcement.ID, &announcement.Title, &announcement.Content,
			&announcement.Priority, &announcement.IsActive, &announcement.CreatedBy,
			&announcement.CreatedAt, &announcement.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan announcement: %w", err)
		}
		announcements = append(announcements, announcement)
	}

	return announcements, nil
}

// Create creates a new announcement (modified for simpler use)
func (r *AnnouncementRepository) Create(ctx context.Context, announcement models.Announcement) error {
	query := `
		INSERT INTO announcements (id, title, content, priority, is_active)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := r.db.ExecContext(ctx, query, announcement.ID, announcement.Title, announcement.Content, announcement.Priority, announcement.IsActive)
	if err != nil {
		return fmt.Errorf("failed to create announcement: %w", err)
	}
	return nil
}

// GetAll retrieves all announcements (active and inactive)
func (r *AnnouncementRepository) GetAll(ctx context.Context) ([]models.Announcement, error) {
	query := `
		SELECT id, title, content, priority, is_active, created_by, created_at, updated_at
		FROM announcements
		ORDER BY priority DESC, created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get all announcements: %w", err)
	}
	defer rows.Close()

	var announcements []models.Announcement
	for rows.Next() {
		var announcement models.Announcement
		err := rows.Scan(
			&announcement.ID, &announcement.Title, &announcement.Content,
			&announcement.Priority, &announcement.IsActive, &announcement.CreatedBy,
			&announcement.CreatedAt, &announcement.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan announcement: %w", err)
		}
		announcements = append(announcements, announcement)
	}

	return announcements, nil
}

// Update updates an announcement
func (r *AnnouncementRepository) Update(ctx context.Context, id uuid.UUID, title, content string, priority int, isActive *bool) error {
	query := `UPDATE announcements SET `
	args := []interface{}{}
	argPos := 1
	updates := []string{}

	if title != "" {
		updates = append(updates, fmt.Sprintf("title = $%d", argPos))
		args = append(args, title)
		argPos++
	}

	if content != "" {
		updates = append(updates, fmt.Sprintf("content = $%d", argPos))
		args = append(args, content)
		argPos++
	}

	if priority > 0 {
		updates = append(updates, fmt.Sprintf("priority = $%d", argPos))
		args = append(args, priority)
		argPos++
	}

	if isActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *isActive)
		argPos++
	}

	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}

	query += fmt.Sprintf("%s, updated_at = NOW() WHERE id = $%d",
		fmt.Sprintf("%s", updates),
		argPos)
	args = append(args, id)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update announcement: %w", err)
	}

	return nil
}
