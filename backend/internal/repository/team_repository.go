package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/models"
)

type TeamRepository struct {
	db *database.DB
}

func NewTeamRepository(db *database.DB) *TeamRepository {
	return &TeamRepository{db: db}
}

// SearchByName performs fuzzy search on team names (teams that completed RSVP I and/or Final Confirmation)
func (r *TeamRepository) SearchByName(ctx context.Context, teamName string) ([]models.Team, error) {
	query := `
		SELECT id, team_name, city, status, problem_statement, qr_code_token,
		       rsvp_locked, rsvp_locked_at, checked_in_at, checked_in_by,
		       dashboard_token, created_at, updated_at, member_count
		FROM teams
		WHERE LOWER(team_name) LIKE LOWER($1) 
		  AND status IN ('rsvp_done', 'rsvp2_done', 'checked_in')
		ORDER BY team_name
		LIMIT 10
	`
	rows, err := r.db.QueryContext(ctx, query, "%"+teamName+"%")
	if err != nil {
		return nil, fmt.Errorf("failed to search teams: %w", err)
	}
	defer rows.Close()

	var teams []models.Team
	for rows.Next() {
		var team models.Team
		err := rows.Scan(
			&team.ID, &team.TeamName, &team.City, &team.Status,
			&team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
			&team.RSVPLockedAt, &team.CheckedInAt, &team.CheckedInBy,
			&team.DashboardToken, &team.CreatedAt, &team.UpdatedAt,
			&team.MemberCount,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team: %w", err)
		}
		teams = append(teams, team)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return teams, nil
}

// GetByID retrieves a team with its members
func (r *TeamRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Team, error) {
	// Use QueryRow instead of QueryRowContext to avoid prepared statement caching issues
	query := `
		SELECT id, team_name, city, status, problem_statement, qr_code_token,
		       rsvp_locked, rsvp_locked_at, rsvp2_locked, rsvp2_locked_at, rsvp2_selected_members,
		       checked_in_at, checked_in_by, dashboard_token, created_at, updated_at
		FROM teams WHERE id = $1
	`
	var team models.Team
	err := r.db.QueryRow(query, id).Scan(
		&team.ID, &team.TeamName, &team.City, &team.Status,
		&team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
		&team.RSVPLockedAt, &team.RSVP2Locked, &team.RSVP2LockedAt, &team.RSVP2SelectedMembers,
		&team.CheckedInAt, &team.CheckedInBy, &team.DashboardToken, 
		&team.CreatedAt, &team.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get team by ID: %w", err)
	}

	// Fetch team members
	members, err := r.GetMembersByTeamID(ctx, id)
	if err != nil {
		return nil, err
	}
	team.Members = members

	return &team, nil
}

// GetByQRToken retrieves a team by QR code token (for volunteer scanner)
func (r *TeamRepository) GetByQRToken(ctx context.Context, token string) (*models.Team, error) {
	// Use QueryRow instead of QueryRowContext to avoid prepared statement caching issues
	query := `
		SELECT id, team_name, city, status, problem_statement, qr_code_token,
		       rsvp_locked, rsvp_locked_at, rsvp2_locked, rsvp2_locked_at, rsvp2_selected_members,
		       checked_in_at, checked_in_by, dashboard_token, created_at, updated_at
		FROM teams WHERE qr_code_token = $1
	`
	var team models.Team
	err := r.db.QueryRow(query, token).Scan(
		&team.ID, &team.TeamName, &team.City, &team.Status,
		&team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
		&team.RSVPLockedAt, &team.RSVP2Locked, &team.RSVP2LockedAt, &team.RSVP2SelectedMembers,
		&team.CheckedInAt, &team.CheckedInBy, &team.DashboardToken, 
		&team.CreatedAt, &team.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get team by QR token: %w", err)
	}

	members, err := r.GetMembersByTeamID(ctx, team.ID)
	if err != nil {
		return nil, err
	}
	team.Members = members

	return &team, nil
}

// GetByDashboardToken retrieves a team by dashboard token (for member access).
// Joins event_tables to return registration desk name/number when allocated.
func (r *TeamRepository) GetByDashboardToken(ctx context.Context, token string) (*models.Team, error) {
	query := `
		SELECT t.id, t.team_name, t.city, t.status, t.problem_statement, t.qr_code_token,
		       t.rsvp_locked, t.rsvp_locked_at, t.rsvp2_locked, t.rsvp2_locked_at, t.rsvp2_selected_members,
		       t.checked_in_at, t.checked_in_by, t.dashboard_token, t.created_at, t.updated_at,
		       t.registration_desk_id, et.table_name AS registration_desk_table_name, et.table_number AS registration_desk_table_number
		FROM teams t
		LEFT JOIN event_tables et ON t.registration_desk_id = et.id
		WHERE t.dashboard_token = $1
	`
	var team models.Team
	var deskName, deskNumber sql.NullString
	err := r.db.QueryRowContext(ctx, query, token).Scan(
		&team.ID, &team.TeamName, &team.City, &team.Status,
		&team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
		&team.RSVPLockedAt, &team.RSVP2Locked, &team.RSVP2LockedAt, &team.RSVP2SelectedMembers,
		&team.CheckedInAt, &team.CheckedInBy, &team.DashboardToken,
		&team.CreatedAt, &team.UpdatedAt,
		&team.RegistrationDeskID, &deskName, &deskNumber,
	)
	if err == nil {
		if deskName.Valid {
			team.RegistrationDeskTableName = &deskName.String
		}
		if deskNumber.Valid {
			team.RegistrationDeskTableNumber = &deskNumber.String
		}
	}
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get team by dashboard token: %w", err)
	}

	// Get members based on RSVP II status
	if team.RSVP2Locked && len(team.RSVP2SelectedMembers) > 0 {
		// Team completed RSVP II, show only selected members
		members, err := r.GetSelectedMembersByTeamID(ctx, team.ID, team.RSVP2SelectedMembers)
		if err != nil {
			return nil, err
		}
		team.Members = members
	} else {
		// Show all members (RSVP II not completed yet)
		members, err := r.GetMembersByTeamID(ctx, team.ID)
		if err != nil {
			return nil, err
		}
		team.Members = members
	}

	return &team, nil
}

// GetTeamIDsByCity returns team IDs for teams in the given city with status rsvp2_done only (eligible for registration desk), ordered by created_at.
func (r *TeamRepository) GetTeamIDsByCity(ctx context.Context, city string) ([]uuid.UUID, error) {
	query := `
		SELECT id FROM teams
		WHERE city = $1 AND status = 'rsvp2_done'
		ORDER BY created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, city)
	if err != nil {
		return nil, fmt.Errorf("failed to get team IDs by city: %w", err)
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan team ID: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating team IDs: %w", err)
	}
	return ids, nil
}

// SetRegistrationDesk sets the registration desk (event_table) for a team.
func (r *TeamRepository) SetRegistrationDesk(ctx context.Context, teamID, deskID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `UPDATE teams SET registration_desk_id = $1, updated_at = NOW() WHERE id = $2`, deskID, teamID)
	if err != nil {
		return fmt.Errorf("failed to set registration desk: %w", err)
	}
	return nil
}

// ClearRegistrationDesksForRSVP2Teams sets registration_desk_id = NULL for all teams with status = 'rsvp2_done'.
// Call before re-running allocation so previous allocations are removed.
func (r *TeamRepository) ClearRegistrationDesksForRSVP2Teams(ctx context.Context) (int64, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE teams SET registration_desk_id = NULL, updated_at = NOW() WHERE status = 'rsvp2_done'`)
	if err != nil {
		return 0, fmt.Errorf("failed to clear registration desks: %w", err)
	}
	return res.RowsAffected()
}

// ClearAllRegistrationDesks sets registration_desk_id = NULL for all teams that have a desk allocated.
func (r *TeamRepository) ClearAllRegistrationDesks(ctx context.Context) (int64, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE teams SET registration_desk_id = NULL, updated_at = NOW() WHERE registration_desk_id IS NOT NULL`)
	if err != nil {
		return 0, fmt.Errorf("failed to clear all registration desks: %w", err)
	}
	return res.RowsAffected()
}

// GetMembersByTeamID retrieves all members of a team
func (r *TeamRepository) GetMembersByTeamID(ctx context.Context, teamID uuid.UUID) ([]models.TeamMember, error) {
	// Use Query instead of QueryContext to avoid prepared statement caching issues
	query := fmt.Sprintf(`
		SELECT id, team_id, name, email, phone, role, tshirt_size,
		       individual_qr_token, created_at, updated_at
		FROM team_members 
		WHERE team_id = '%s'
		ORDER BY role DESC, name ASC
	`, teamID.String())

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get team members: %w", err)
	}
	defer rows.Close()

	var members []models.TeamMember
	for rows.Next() {
		var member models.TeamMember
		err := rows.Scan(
			&member.ID, &member.TeamID, &member.Name, &member.Email,
			&member.Phone, &member.Role, &member.TShirtSize,
			&member.IndividualQRToken, &member.CreatedAt, &member.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}
		members = append(members, member)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating members: %w", err)
	}

	return members, nil
}

// GetLeaderPhone retrieves the team leader's phone number
func (r *TeamRepository) GetLeaderPhone(ctx context.Context, teamID uuid.UUID) (string, error) {
	query := `
		SELECT phone FROM team_members
		WHERE team_id = $1 AND role = 'leader'
		LIMIT 1
	`
	var phone string
	err := r.db.QueryRowContext(ctx, query, teamID).Scan(&phone)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("no leader found for team")
	}
	if err != nil {
		return "", fmt.Errorf("failed to get leader phone: %w", err)
	}

	return phone, nil
}

// UpdateRSVP confirms RSVP and locks the team (transaction-wrapped)
// This method handles adding new members, updating existing members, and deleting removed members
func (r *TeamRepository) UpdateRSVP(ctx context.Context, teamID uuid.UUID, city models.City, members []models.TeamMember) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Generate unique tokens
	qrToken := uuid.New().String()
	dashboardToken := uuid.New().String()

	// Update team with new member count
	_, err = tx.ExecContext(ctx, `
		UPDATE teams SET
		    city = $1, status = 'rsvp_done', qr_code_token = $2,
		    rsvp_locked = true, rsvp_locked_at = NOW(),
		    dashboard_token = $3, member_count = $4, updated_at = NOW()
		WHERE id = $5
	`, city, qrToken, dashboardToken, len(members), teamID)
	if err != nil {
		return fmt.Errorf("failed to update team: %w", err)
	}

	// Get existing member IDs to determine which ones to delete
	existingMemberIDs := make(map[uuid.UUID]bool)
	rows, err := tx.QueryContext(ctx, `SELECT id FROM team_members WHERE team_id = $1`, teamID)
	if err != nil {
		return fmt.Errorf("failed to get existing members: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("failed to scan member ID: %w", err)
		}
		existingMemberIDs[id] = true
	}

	// Track which members are in the update
	updatedMemberIDs := make(map[uuid.UUID]bool)

	// Insert or update members
	for _, member := range members {
		individualQR := uuid.New().String()
		updatedMemberIDs[member.ID] = true

		if existingMemberIDs[member.ID] {
			// Update existing member
			_, err = tx.ExecContext(ctx, `
				UPDATE team_members SET
				    name = $1, email = $2, phone = $3, tshirt_size = $4,
				    individual_qr_token = $5, updated_at = NOW()
				WHERE id = $6
			`, member.Name, member.Email, member.Phone, member.TShirtSize, individualQR, member.ID)
			if err != nil {
				return fmt.Errorf("failed to update member %s: %w", member.Name, err)
			}
		} else {
			// Insert new member
			_, err = tx.ExecContext(ctx, `
				INSERT INTO team_members (id, team_id, name, email, phone, role, tshirt_size, individual_qr_token)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, member.ID, member.TeamID, member.Name, member.Email, member.Phone, member.Role, member.TShirtSize, individualQR)
			if err != nil {
				return fmt.Errorf("failed to insert new member %s: %w", member.Name, err)
			}
		}
	}

	// Delete members that were removed
	for existingID := range existingMemberIDs {
		if !updatedMemberIDs[existingID] {
			_, err = tx.ExecContext(ctx, `DELETE FROM team_members WHERE id = $1`, existingID)
			if err != nil {
				return fmt.Errorf("failed to delete removed member: %w", err)
			}
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// CheckIn marks a team as checked in
func (r *TeamRepository) CheckIn(ctx context.Context, teamID, volunteerID uuid.UUID) error {
	query := `
		UPDATE teams SET
		    status = 'checked_in', checked_in_at = NOW(),
		    checked_in_by = $1, updated_at = NOW()
		WHERE id = $2
	`
	result, err := r.db.ExecContext(ctx, query, volunteerID, teamID)
	if err != nil {
		return fmt.Errorf("failed to check in team: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("team not found")
	}

	return nil
}

// IsTeamCheckedIn checks if a team is already checked in
func (r *TeamRepository) IsTeamCheckedIn(ctx context.Context, teamID uuid.UUID) (bool, *time.Time, error) {
	query := `SELECT checked_in_at FROM teams WHERE id = $1`
	var checkedInAt *time.Time
	err := r.db.QueryRowContext(ctx, query, teamID).Scan(&checkedInAt)
	if err == sql.ErrNoRows {
		return false, nil, fmt.Errorf("team not found")
	}
	if err != nil {
		return false, nil, fmt.Errorf("failed to check team status: %w", err)
	}

	return checkedInAt != nil, checkedInAt, nil
}

// Create creates a new team
func (r *TeamRepository) Create(ctx context.Context, team models.Team) error {
	query := `
		INSERT INTO teams (id, team_name, city, status, member_count, problem_statement)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.ExecContext(ctx, query, team.ID, team.TeamName, team.City, team.Status, team.MemberCount, team.ProblemStatement)
	if err != nil {
		return fmt.Errorf("failed to create team: %w", err)
	}
	return nil
}

// CreateMember creates a new team member
func (r *TeamRepository) CreateMember(ctx context.Context, member models.TeamMember) error {
	query := `
		INSERT INTO team_members (id, team_id, name, email, phone, role, tshirt_size)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.db.ExecContext(ctx, query, member.ID, member.TeamID, member.Name, member.Email, member.Phone, member.Role, member.TShirtSize)
	if err != nil {
		return fmt.Errorf("failed to create member: %w", err)
	}
	return nil
}

// GetCheckInStats returns check-in statistics
func (r *TeamRepository) GetCheckInStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total teams
	var totalTeams int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM teams`).Scan(&totalTeams)
	if err != nil {
		return nil, fmt.Errorf("failed to get total teams: %w", err)
	}
	stats["total_teams"] = totalTeams

	// RSVP confirmed (RSVP I)
	var rsvpConfirmed int
	err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM teams WHERE rsvp_locked = true`).Scan(&rsvpConfirmed)
	if err != nil {
		return nil, fmt.Errorf("failed to get RSVP count: %w", err)
	}
	stats["rsvp_confirmed"] = rsvpConfirmed

	// RSVP II confirmed
	var rsvp2Confirmed int
	err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM teams WHERE rsvp2_locked = true`).Scan(&rsvp2Confirmed)
	if err != nil {
		return nil, fmt.Errorf("failed to get RSVP II count: %w", err)
	}
	stats["rsvp2_confirmed"] = rsvp2Confirmed

	// Checked in
	var checkedIn int
	err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM teams WHERE checked_in_at IS NOT NULL`).Scan(&checkedIn)
	if err != nil {
		return nil, fmt.Errorf("failed to get checked-in count: %w", err)
	}
	stats["checked_in"] = checkedIn

	// By city
	rows, err := r.db.QueryContext(ctx, `SELECT city, COUNT(*) FROM teams WHERE city IS NOT NULL GROUP BY city`)
	if err != nil {
		return nil, fmt.Errorf("failed to get city stats: %w", err)
	}
	defer rows.Close()

	byCity := make(map[string]int)
	for rows.Next() {
		var city string
		var count int
		if err := rows.Scan(&city, &count); err != nil {
			return nil, fmt.Errorf("failed to scan city stats: %w", err)
		}
		byCity[city] = count
	}
	stats["by_city"] = byCity

	return stats, nil
}

// GetAllWithFilters retrieves all teams with optional filters
func (r *TeamRepository) GetAllWithFilters(ctx context.Context, status, city string) ([]models.Team, error) {
	query := `
		SELECT id, team_name, city, status, problem_statement, qr_code_token,
		       rsvp_locked, rsvp_locked_at, checked_in_at, checked_in_by,
		       dashboard_token, member_count, created_at, updated_at
		FROM teams
		WHERE 1=1
	`
	args := []interface{}{}
	argPos := 1

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, status)
		argPos++
	}

	if city != "" {
		query += fmt.Sprintf(" AND city = $%d", argPos)
		args = append(args, city)
		argPos++
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query teams: %w", err)
	}
	defer rows.Close()

	var teams []models.Team
	for rows.Next() {
		var team models.Team
		err := rows.Scan(
			&team.ID, &team.TeamName, &team.City, &team.Status,
			&team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
			&team.RSVPLockedAt, &team.CheckedInAt, &team.CheckedInBy,
			&team.DashboardToken, &team.MemberCount, &team.CreatedAt, &team.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team row: %w", err)
		}
		teams = append(teams, team)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating team rows: %w", err)
	}

	// If no teams, return early
	if len(teams) == 0 {
		return teams, nil
	}

	// Load all members in a single query (fix N+1 problem)
	teamIDs := make([]string, len(teams))
	for i, team := range teams {
		teamIDs[i] = fmt.Sprintf("'%s'", team.ID.String())
	}

	membersQuery := fmt.Sprintf(`
		SELECT id, team_id, name, email, phone, role, tshirt_size,
		       individual_qr_token, created_at, updated_at
		FROM team_members 
		WHERE team_id IN (%s)
		ORDER BY team_id, role DESC, name ASC
	`, strings.Join(teamIDs, ","))

	memberRows, err := r.db.Query(membersQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query all team members: %w", err)
	}
	defer memberRows.Close()

	// Group members by team_id
	membersByTeam := make(map[uuid.UUID][]models.TeamMember)
	for memberRows.Next() {
		var member models.TeamMember
		err := memberRows.Scan(
			&member.ID, &member.TeamID, &member.Name, &member.Email,
			&member.Phone, &member.Role, &member.TShirtSize,
			&member.IndividualQRToken, &member.CreatedAt, &member.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}
		membersByTeam[member.TeamID] = append(membersByTeam[member.TeamID], member)
	}

	// Assign members to their teams
	for i := range teams {
		if members, ok := membersByTeam[teams[i].ID]; ok {
			teams[i].Members = members
		} else {
			teams[i].Members = []models.TeamMember{}
		}
	}

	return teams, nil
}

// GetTeamMembers retrieves all members for a specific team
func (r *TeamRepository) GetTeamMembers(ctx context.Context, teamID uuid.UUID) ([]models.TeamMember, error) {
	// Use the same function as GetMembersByTeamID to avoid duplication
	return r.GetMembersByTeamID(ctx, teamID)
}

// CreateTeamWithMembers creates a team and its members in a single transaction
func (r *TeamRepository) CreateTeamWithMembers(ctx context.Context, team models.Team, members []models.TeamMember) error {
	// Start transaction
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Create team - include all fields that might be set
	teamQuery := `
		INSERT INTO teams (id, team_name, city, status, member_count, problem_statement, 
		                   qr_code_token, dashboard_token, rsvp_locked, rsvp_locked_at, 
		                   rsvp2_locked, rsvp2_locked_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err = tx.ExecContext(ctx, teamQuery, 
		team.ID, team.TeamName, team.City, team.Status, team.MemberCount, team.ProblemStatement,
		team.QRCodeToken, team.DashboardToken, team.RSVPLocked, team.RSVPLockedAt,
		team.RSVP2Locked, team.RSVP2LockedAt)
	if err != nil {
		return fmt.Errorf("failed to create team: %w", err)
	}

	// Batch insert members
	if len(members) > 0 {
		memberQuery := `
			INSERT INTO team_members (id, team_id, name, email, phone, role, individual_qr_token)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`
		for _, member := range members {
			_, err = tx.ExecContext(ctx, memberQuery,
				member.ID, member.TeamID, member.Name, member.Email, member.Phone, member.Role, member.IndividualQRToken)
			if err != nil {
				return fmt.Errorf("failed to create member %s: %w", member.Name, err)
			}
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// ClearAllData deletes all teams and members - for testing only
func (r *TeamRepository) ClearAllData(ctx context.Context) error {
	// Start transaction
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete all team members first (foreign key constraint)
	_, err = tx.ExecContext(ctx, "DELETE FROM team_members")
	if err != nil {
		return fmt.Errorf("failed to delete team members: %w", err)
	}

	// Delete all teams
	_, err = tx.ExecContext(ctx, "DELETE FROM teams")
	if err != nil {
		return fmt.Errorf("failed to delete teams: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// CheckPhoneExists checks if a phone number already exists in the database
func (r *TeamRepository) CheckPhoneExists(ctx context.Context, phone string) (bool, string, error) {
	query := `
		SELECT tm.phone, t.team_name 
		FROM team_members tm
		JOIN teams t ON tm.team_id = t.id
		WHERE tm.phone = $1
		LIMIT 1
	`
	var existingPhone, teamName string
	err := r.db.QueryRowContext(ctx, query, phone).Scan(&existingPhone, &teamName)
	if err == sql.ErrNoRows {
		return false, "", nil
	}
	if err != nil {
		return false, "", fmt.Errorf("failed to check phone existence: %w", err)
	}
	return true, teamName, nil
}

// CheckEmailExists checks if an email already exists in the database
func (r *TeamRepository) CheckEmailExists(ctx context.Context, email string) (bool, string, error) {
	query := `
		SELECT tm.email, t.team_name 
		FROM team_members tm
		JOIN teams t ON tm.team_id = t.id
		WHERE LOWER(tm.email) = LOWER($1)
		LIMIT 1
	`
	var existingEmail, teamName string
	err := r.db.QueryRowContext(ctx, query, email).Scan(&existingEmail, &teamName)
	if err == sql.ErrNoRows {
		return false, "", nil
	}
	if err != nil {
		return false, "", fmt.Errorf("failed to check email existence: %w", err)
	}
	return true, teamName, nil
}

// CheckTeamExistsByNameAndLeader checks if a team with the same name and leader email exists
func (r *TeamRepository) CheckTeamExistsByNameAndLeader(ctx context.Context, teamName, leaderEmail string) (*models.Team, error) {
	query := `
		SELECT t.id, t.team_name, t.city, t.status, t.rsvp_locked, t.created_at
		FROM teams t
		JOIN team_members tm ON t.id = tm.team_id
		WHERE LOWER(t.team_name) = LOWER($1) 
		AND LOWER(tm.email) = LOWER($2)
		AND tm.role = 'leader'
		LIMIT 1
	`
	var team models.Team
	err := r.db.QueryRowContext(ctx, query, teamName, leaderEmail).Scan(
		&team.ID, &team.TeamName, &team.City, &team.Status, &team.RSVPLocked, &team.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to check team existence: %w", err)
	}
	return &team, nil
}

// GetSelectedMembersByTeamID retrieves only selected members based on RSVP II selection
func (r *TeamRepository) GetSelectedMembersByTeamID(ctx context.Context, teamID uuid.UUID, selectedMembersJSON []byte) ([]models.TeamMember, error) {
	// Parse selected member IDs from JSON
	var selectedMemberIDs []uuid.UUID
	if err := json.Unmarshal(selectedMembersJSON, &selectedMemberIDs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal selected members: %w", err)
	}

	if len(selectedMemberIDs) == 0 {
		return []models.TeamMember{}, nil
	}

	// Build query with IN clause for selected member IDs
	placeholders := make([]string, len(selectedMemberIDs))
	args := make([]interface{}, len(selectedMemberIDs)+1)
	args[0] = teamID
	
	for i, memberID := range selectedMemberIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		args[i+1] = memberID
	}

	query := fmt.Sprintf(`
		SELECT id, team_id, name, email, phone, role, tshirt_size,
		       individual_qr_token, created_at, updated_at
		FROM team_members 
		WHERE team_id = $1 AND id IN (%s)
		ORDER BY role DESC, name ASC
	`, strings.Join(placeholders, ","))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get selected team members: %w", err)
	}
	defer rows.Close()

	var members []models.TeamMember
	for rows.Next() {
		var member models.TeamMember
		err := rows.Scan(
			&member.ID, &member.TeamID, &member.Name, &member.Email,
			&member.Phone, &member.Role, &member.TShirtSize,
			&member.IndividualQRToken, &member.CreatedAt, &member.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team member: %w", err)
		}
		members = append(members, member)
	}

	return members, nil
}

// UpdateRSVP2 updates team with RSVP II data (selected members)
func (r *TeamRepository) UpdateRSVP2(ctx context.Context, teamID uuid.UUID, selectedMemberIDs []uuid.UUID) error {
	// Convert member IDs to JSON
	selectedMembersJSON, err := json.Marshal(selectedMemberIDs)
	if err != nil {
		return fmt.Errorf("failed to marshal selected members: %w", err)
	}

	now := time.Now()
	query := `
		UPDATE teams 
		SET status = 'rsvp2_done',
		    rsvp2_locked = true,
		    rsvp2_locked_at = $2,
		    rsvp2_selected_members = $3,
		    updated_at = $2
		WHERE id = $1
	`

	_, err = r.db.ExecContext(ctx, query, teamID, now, selectedMembersJSON)
	if err != nil {
		return fmt.Errorf("failed to update RSVP II: %w", err)
	}

	return nil
}

// UpdateTeamStatus updates a team's status field
func (r *TeamRepository) UpdateTeamStatus(ctx context.Context, teamID uuid.UUID, status models.TeamStatus) error {
	query := `UPDATE teams SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, string(status), teamID)
	if err != nil {
		return fmt.Errorf("failed to update team status: %w", err)
	}
	return nil
}
