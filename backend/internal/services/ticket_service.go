package services

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
)

type TicketService struct {
	db           *sql.DB
	emailService interface {
		SendTicketCreatedEmail(to, teamName, subject, ticketID string) error
		SendTicketResolvedEmail(to, teamName, subject, resolution string, editAllowed bool, editMinutes int) error
	}
}

func NewTicketService(db *sql.DB, emailService interface {
	SendTicketCreatedEmail(to, teamName, subject, ticketID string) error
	SendTicketResolvedEmail(to, teamName, subject, resolution string, editAllowed bool, editMinutes int) error
}) *TicketService {
	return &TicketService{
		db:           db,
		emailService: emailService,
	}
}

func (s *TicketService) CreateTicket(req models.CreateTicketRequest) (*models.Ticket, error) {
	teamID, err := uuid.Parse(req.TeamID)
	if err != nil {
		return nil, fmt.Errorf("invalid team ID")
	}

	// Get team and leader info
	var teamName string
	var city sql.NullString
	var leaderEmail string

	err = s.db.QueryRow(`
		SELECT t.team_name, t.city, tm.email
		FROM teams t
		JOIN team_members tm ON t.id = tm.team_id AND tm.role = 'leader'
		WHERE t.id = $1
		LIMIT 1
	`, teamID).Scan(&teamName, &city, &leaderEmail)
	if err != nil {
		return nil, fmt.Errorf("team or leader not found: %w", err)
	}

	// Create ticket
	ticketID := uuid.New()
	now := time.Now()

	// Insert into support_tickets table
	_, err = s.db.Exec(`
		INSERT INTO support_tickets (id, team_id, subject, description, message, status, created_at)
		VALUES ($1, $2, $3, $4, $4, 'open', $5)
	`, ticketID, teamID, req.Subject, req.Message, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create ticket: %w", err)
	}

	ticket := &models.Ticket{
		ID:          ticketID,
		TeamID:      teamID,
		Subject:     req.Subject,
		Description: req.Message,
		Status:      "open",
		CreatedAt:   now,
	}

	// Send email to leader asynchronously
	go s.emailService.SendTicketCreatedEmail(leaderEmail, teamName, req.Subject, ticketID.String())

	return ticket, nil
}

func (s *TicketService) GetAllTickets(status string) ([]models.Ticket, error) {
	query := `
		SELECT 
			t.id, t.team_id, t.subject, t.description, 
			COALESCE(t.message, t.description) as message,
			t.status, t.resolution, t.created_at, t.resolved_at, t.resolved_by_email,
			tm.team_name, tm.city, tm.member_count
		FROM support_tickets t
		JOIN teams tm ON t.team_id = tm.id
	`

	var args []interface{}
	if status != "" && status != "all" {
		query += " WHERE t.status = $1"
		args = append(args, status)
	}

	query += " ORDER BY t.created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query tickets: %w", err)
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var ticket models.Ticket
		var city sql.NullString
		var message string
		var resolution sql.NullString
		var resolvedAt sql.NullTime
		var resolvedByEmail sql.NullString

		// Separate variables for team fields
		var teamName string
		var memberCount int

		err := rows.Scan(
			&ticket.ID, &ticket.TeamID, &ticket.Subject, &ticket.Description,
			&message, &ticket.Status, &resolution,
			&ticket.CreatedAt, &resolvedAt, &resolvedByEmail,
			&teamName, &city, &memberCount,
		)
		if err != nil {
			continue
		}

		// Set message
		ticket.Message = &message

		if resolution.Valid {
			ticket.Resolution = &resolution.String
		}
		if resolvedAt.Valid {
			ticket.ResolvedAt = &resolvedAt.Time
		}
		if resolvedByEmail.Valid {
			ticket.ResolvedByEmail = &resolvedByEmail.String
		}

		// Initialize Team struct
		ticket.Team = models.Team{
			TeamName:    teamName,
			MemberCount: memberCount,
		}

		if city.Valid {
			cityVal := models.City(city.String)
			ticket.Team.City = &cityVal
		}

		tickets = append(tickets, ticket)
	}

	return tickets, nil
}

func (s *TicketService) GetTicketByID(ticketID string) (*models.Ticket, error) {
	tid, err := uuid.Parse(ticketID)
	if err != nil {
		return nil, fmt.Errorf("invalid ticket ID")
	}

	var ticket models.Ticket
	var city sql.NullString
	var message sql.NullString
	var resolution sql.NullString
	var resolvedAt sql.NullTime
	var resolvedByEmail sql.NullString

	err = s.db.QueryRow(`
		SELECT 
			t.id, t.team_id, t.subject, t.description,
			t.message, t.status, t.resolution,
			t.created_at, t.resolved_at, t.resolved_by_email,
			tm.team_name, tm.city, tm.member_count
		FROM support_tickets t
		JOIN teams tm ON t.team_id = tm.id
		WHERE t.id = $1
	`, tid).Scan(
		&ticket.ID, &ticket.TeamID, &ticket.Subject, &ticket.Description,
		&message, &ticket.Status, &resolution,
		&ticket.CreatedAt, &resolvedAt, &resolvedByEmail,
		&ticket.Team.TeamName, &city, &ticket.Team.MemberCount,
	)
	if err != nil {
		return nil, fmt.Errorf("ticket not found: %w", err)
	}

	if message.Valid {
		ticket.Message = &message.String
	}
	if resolution.Valid {
		ticket.Resolution = &resolution.String
	}
	if resolvedAt.Valid {
		ticket.ResolvedAt = &resolvedAt.Time
	}
	if resolvedByEmail.Valid {
		ticket.ResolvedByEmail = &resolvedByEmail.String
	}
	if city.Valid {
		cityVal := models.City(city.String)
		ticket.Team.City = &cityVal
	}

	return &ticket, nil
}

func (s *TicketService) ResolveTicket(ticketID string, req models.ResolveTicketRequest, adminEmail string) error {
	tid, err := uuid.Parse(ticketID)
	if err != nil {
		return fmt.Errorf("invalid ticket ID")
	}

	// Get ticket and team info
	var teamID uuid.UUID
	var teamName string
	var subject string
	var leaderEmail string

	err = s.db.QueryRow(`
		SELECT t.team_id, t.subject, tm.team_name, tml.email
		FROM support_tickets t
		JOIN teams tm ON t.team_id = tm.id
		JOIN team_members tml ON tm.id = tml.team_id AND tml.role = 'leader'
		WHERE t.id = $1
		LIMIT 1
	`, tid).Scan(&teamID, &subject, &teamName, &leaderEmail)
	if err != nil {
		return fmt.Errorf("ticket not found: %w", err)
	}

	// Update ticket
	now := time.Now()
	_, err = s.db.Exec(`
		UPDATE support_tickets
		SET status = 'resolved',
			resolution = $1,
			resolved_at = $2,
			resolved_by_email = $3
		WHERE id = $4
	`, req.Resolution, now, adminEmail, tid)
	if err != nil {
		return fmt.Errorf("failed to update ticket: %w", err)
	}

	// Allow team editing if requested
	if req.AllowEdit && req.EditMinutes > 0 {
		editUntil := time.Now().Add(time.Duration(req.EditMinutes) * time.Minute)
		_, err = s.db.Exec(`
			UPDATE teams
			SET edit_allowed_until = $1
			WHERE id = $2
		`, editUntil, teamID)
		if err != nil {
			return fmt.Errorf("failed to update team edit permissions: %w", err)
		}
	}

	// Send resolution email
	if req.SendEmail {
		go s.emailService.SendTicketResolvedEmail(
			leaderEmail,
			teamName,
			subject,
			req.Resolution,
			req.AllowEdit,
			req.EditMinutes,
		)
	}

	return nil
}

func (s *TicketService) UpdateTicketStatus(ticketID string, status string) error {
	tid, err := uuid.Parse(ticketID)
	if err != nil {
		return fmt.Errorf("invalid ticket ID")
	}

	validStatuses := map[string]bool{
		"open":        true,
		"in_progress": true,
		"resolved":    true,
		"closed":      true,
	}

	if !validStatuses[status] {
		return fmt.Errorf("invalid status")
	}

	_, err = s.db.Exec(`
		UPDATE support_tickets
		SET status = $1
		WHERE id = $2
	`, status, tid)
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	return nil
}
