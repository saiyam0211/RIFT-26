package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
)

type AnnouncementService struct {
	db *sql.DB
}

func NewAnnouncementService(db *sql.DB) *AnnouncementService {
	return &AnnouncementService{db: db}
}

func (s *AnnouncementService) CreateAnnouncement(req models.CreateAnnouncementRequest, createdByEmail string) (*models.Announcement, error) {
	announcementID := uuid.New()

	// Get user ID from email
	var createdBy uuid.UUID
	err := s.db.QueryRow(`SELECT id FROM users WHERE email = $1 LIMIT 1`, createdByEmail).Scan(&createdBy)
	if err != nil {
		// If user not found, use nil
		createdBy = uuid.Nil
	}

	// Serialize filters
	filtersJSON, err := json.Marshal(req.Filters)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal filters: %w", err)
	}

	now := time.Now()
	priority := req.Priority
	if priority == 0 {
		priority = 1 // Default priority
	}

	var createdByPtr *uuid.UUID
	if createdBy != uuid.Nil {
		createdByPtr = &createdBy
	}

	_, err = s.db.Exec(`
		INSERT INTO announcements (id, title, content, priority, filters, is_active, created_by, created_at, updated_at, button_text, button_url)
		VALUES ($1, $2, $3, $4, $5, true, $6, $7, $7, $8, $9)
	`, announcementID, req.Title, req.Content, priority, filtersJSON, createdByPtr, now, req.ButtonText, req.ButtonURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create announcement: %w", err)
	}

	announcement := &models.Announcement{
		ID:         announcementID,
		Title:      req.Title,
		Content:    req.Content,
		Priority:   priority,
		IsActive:   true,
		ButtonText: req.ButtonText,
		ButtonURL:  req.ButtonURL,
		Filters:    filtersJSON,
		CreatedBy:  createdByPtr,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	return announcement, nil
}

func (s *AnnouncementService) GetAnnouncementsForTeam(teamID string) ([]models.Announcement, error) {
	tid, err := uuid.Parse(teamID)
	if err != nil {
		return nil, fmt.Errorf("invalid team ID")
	}

	// Get team info
	var memberCount int
	var city sql.NullString
	err = s.db.QueryRow(`
		SELECT member_count, COALESCE(city, '')
		FROM teams
		WHERE id = $1
	`, tid).Scan(&memberCount, &city)
	if err != nil {
		return nil, fmt.Errorf("team not found: %w", err)
	}

	cityStr := ""
	if city.Valid {
		cityStr = city.String
	}

	// Get all active announcements
	rows, err := s.db.Query(`
		SELECT id, title, content, priority, COALESCE(filters, '{}'), created_at, button_text, button_url
		FROM announcements
		WHERE is_active = true
		ORDER BY priority DESC, created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query announcements: %w", err)
	}
	defer rows.Close()

	var announcements []models.Announcement
	for rows.Next() {
		var ann models.Announcement
		var filtersJSON []byte
		var buttonText, buttonURL sql.NullString

		err := rows.Scan(&ann.ID, &ann.Title, &ann.Content, &ann.Priority, &filtersJSON, &ann.CreatedAt, &buttonText, &buttonURL)
		if err != nil {
			continue
		}

		if buttonText.Valid {
			ann.ButtonText = &buttonText.String
		}
		if buttonURL.Valid {
			ann.ButtonURL = &buttonURL.String
		}

		// Parse filters
		var filters models.AnnouncementFilters
		if len(filtersJSON) > 0 && string(filtersJSON) != "{}" && string(filtersJSON) != "null" {
			if err := json.Unmarshal(filtersJSON, &filters); err != nil {
				// If unmarshal fails, show to all
				announcements = append(announcements, ann)
				continue
			}
		}

		// Check if announcement matches team
		if s.matchesFilters(filters, memberCount, cityStr, teamID) {
			ann.Filters = filtersJSON
			announcements = append(announcements, ann)
		}
	}

	return announcements, nil
}

func (s *AnnouncementService) matchesFilters(filters models.AnnouncementFilters, memberCount int, city, teamID string) bool {
	// If no filters, show to all teams
	if len(filters.TeamSizes) == 0 && len(filters.Cities) == 0 && len(filters.TeamIDs) == 0 {
		return true
	}

	// Check team size filter
	if len(filters.TeamSizes) > 0 {
		matchSize := false
		for _, size := range filters.TeamSizes {
			if size == memberCount {
				matchSize = true
				break
			}
		}
		if !matchSize {
			return false
		}
	}

	// Check city filter
	if len(filters.Cities) > 0 {
		matchCity := false
		for _, c := range filters.Cities {
			if c == city {
				matchCity = true
				break
			}
		}
		if !matchCity {
			return false
		}
	}

	// Check specific team IDs
	if len(filters.TeamIDs) > 0 {
		matchTeam := false
		for _, tid := range filters.TeamIDs {
			if tid == teamID {
				matchTeam = true
				break
			}
		}
		if !matchTeam {
			return false
		}
	}

	return true
}

func (s *AnnouncementService) GetAllAnnouncements() ([]models.Announcement, error) {
	rows, err := s.db.Query(`
		SELECT id, title, content, priority, is_active, COALESCE(filters, '{}'), created_by, created_at, updated_at, button_text, button_url
		FROM announcements
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query announcements: %w", err)
	}
	defer rows.Close()

	var announcements []models.Announcement
	for rows.Next() {
		var ann models.Announcement
		var filtersJSON []byte
		var createdBy sql.NullString
		var buttonText, buttonURL sql.NullString

		err := rows.Scan(
			&ann.ID, &ann.Title, &ann.Content, &ann.Priority, &ann.IsActive,
			&filtersJSON, &createdBy, &ann.CreatedAt, &ann.UpdatedAt, &buttonText, &buttonURL,
		)
		if err != nil {
			continue
		}

		if createdBy.Valid {
			uid, _ := uuid.Parse(createdBy.String)
			ann.CreatedBy = &uid
		}

		if buttonText.Valid {
			ann.ButtonText = &buttonText.String
		}
		if buttonURL.Valid {
			ann.ButtonURL = &buttonURL.String
		}

		ann.Filters = filtersJSON
		announcements = append(announcements, ann)
	}

	return announcements, nil
}

func (s *AnnouncementService) DeleteAnnouncement(announcementID string) error {
	aid, err := uuid.Parse(announcementID)
	if err != nil {
		return fmt.Errorf("invalid announcement ID")
	}

	// Soft delete - set is_active to false
	result, err := s.db.Exec(`
		UPDATE announcements
		SET is_active = false, updated_at = $1
		WHERE id = $2
	`, time.Now(), aid)
	if err != nil {
		return fmt.Errorf("failed to delete announcement: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("announcement not found")
	}

	return nil
}

func (s *AnnouncementService) GetTeamsMatchingFilters(filters models.AnnouncementFilters) ([]uuid.UUID, error) {
	query := "SELECT id FROM teams WHERE 1=1"
	var args []interface{}
	argCount := 0

	// Filter: only teams with RSVP I done, Final Confirmation (RSVP II) not done.
	// Exclude any team that has completed RSVP II (status rsvp2_done/checked_in or rsvp2_locked = true).
	if filters.OnlyRSVP1Done {
		query += " AND status = 'rsvp_done' AND (rsvp2_locked = false OR rsvp2_locked IS NULL)"
	}

	// Filter by team size
	if len(filters.TeamSizes) > 0 {
		placeholders := ""
		for i, size := range filters.TeamSizes {
			if i > 0 {
				placeholders += ","
			}
			argCount++
			placeholders += fmt.Sprintf("$%d", argCount)
			args = append(args, size)
		}
		query += fmt.Sprintf(" AND member_count IN (%s)", placeholders)
	}

	// Filter by cities
	if len(filters.Cities) > 0 {
		placeholders := ""
		for i, city := range filters.Cities {
			if i > 0 {
				placeholders += ","
			}
			argCount++
			placeholders += fmt.Sprintf("$%d", argCount)
			args = append(args, city)
		}
		query += fmt.Sprintf(" AND city IN (%s)", placeholders)
	}

	// Filter by specific team IDs
	if len(filters.TeamIDs) > 0 {
		placeholders := ""
		validTeamIDs := []uuid.UUID{}
		for _, tidStr := range filters.TeamIDs {
			tid, err := uuid.Parse(tidStr)
			if err == nil {
				validTeamIDs = append(validTeamIDs, tid)
			}
		}

		for i, tid := range validTeamIDs {
			if i > 0 {
				placeholders += ","
			}
			argCount++
			placeholders += fmt.Sprintf("$%d", argCount)
			args = append(args, tid)
		}

		if len(validTeamIDs) > 0 {
			query += fmt.Sprintf(" AND id IN (%s)", placeholders)
		}
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query teams: %w", err)
	}
	defer rows.Close()

	var teamIDs []uuid.UUID
	for rows.Next() {
		var teamID uuid.UUID
		if err := rows.Scan(&teamID); err != nil {
			continue
		}
		teamIDs = append(teamIDs, teamID)
	}

	return teamIDs, nil
}
