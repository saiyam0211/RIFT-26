package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
)

type ParticipantCheckInRepository struct {
	db *sql.DB
}

func NewParticipantCheckInRepository(db *sql.DB) *ParticipantCheckInRepository {
	return &ParticipantCheckInRepository{db: db}
}

// CreateBatch creates multiple participant check-ins in a transaction
func (r *ParticipantCheckInRepository) CreateBatch(checkIns []models.ParticipantCheckIn) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO participant_check_ins 
		(id, team_id, team_member_id, volunteer_id, table_id, participant_name, participant_role, checked_in_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	for _, checkIn := range checkIns {
		_, err := tx.Exec(
			query,
			checkIn.ID,
			checkIn.TeamID,
			checkIn.TeamMemberID,
			checkIn.VolunteerID,
			checkIn.TableID,
			checkIn.ParticipantName,
			checkIn.ParticipantRole,
			checkIn.CheckedInAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert participant check-in: %w", err)
		}
	}

	// Update team's checked_in_at and volunteer_table_id
	if len(checkIns) > 0 {
		updateQuery := `
			UPDATE teams 
			SET checked_in_at = $1, volunteer_table_id = $2
			WHERE id = $3 AND checked_in_at IS NULL
		`
		_, err = tx.Exec(updateQuery, checkIns[0].CheckedInAt, checkIns[0].TableID, checkIns[0].TeamID)
		if err != nil {
			return fmt.Errorf("failed to update team check-in: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetByTeamID retrieves all participant check-ins for a team
func (r *ParticipantCheckInRepository) GetByTeamID(teamID uuid.UUID) ([]models.ParticipantCheckIn, error) {
	query := `
		SELECT id, team_id, team_member_id, volunteer_id, table_id, 
		       participant_name, participant_role, checked_in_at
		FROM participant_check_ins
		WHERE team_id = $1
		ORDER BY checked_in_at DESC
	`

	rows, err := r.db.Query(query, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to query participant check-ins: %w", err)
	}
	defer rows.Close()

	var checkIns []models.ParticipantCheckIn
	for rows.Next() {
		var checkIn models.ParticipantCheckIn
		err := rows.Scan(
			&checkIn.ID,
			&checkIn.TeamID,
			&checkIn.TeamMemberID,
			&checkIn.VolunteerID,
			&checkIn.TableID,
			&checkIn.ParticipantName,
			&checkIn.ParticipantRole,
			&checkIn.CheckedInAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan participant check-in: %w", err)
		}
		checkIns = append(checkIns, checkIn)
	}

	return checkIns, nil
}

// GetByVolunteerID retrieves check-in history for a volunteer
func (r *ParticipantCheckInRepository) GetByVolunteerID(volunteerID uuid.UUID, limit int) ([]models.ParticipantCheckIn, error) {
	query := `
		SELECT id, team_id, team_member_id, volunteer_id, table_id, 
		       participant_name, participant_role, checked_in_at
		FROM participant_check_ins
		WHERE volunteer_id = $1
		ORDER BY checked_in_at DESC
		LIMIT $2
	`

	rows, err := r.db.Query(query, volunteerID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query volunteer check-ins: %w", err)
	}
	defer rows.Close()

	var checkIns []models.ParticipantCheckIn
	for rows.Next() {
		var checkIn models.ParticipantCheckIn
		err := rows.Scan(
			&checkIn.ID,
			&checkIn.TeamID,
			&checkIn.TeamMemberID,
			&checkIn.VolunteerID,
			&checkIn.TableID,
			&checkIn.ParticipantName,
			&checkIn.ParticipantRole,
			&checkIn.CheckedInAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan participant check-in: %w", err)
		}
		checkIns = append(checkIns, checkIn)
	}

	return checkIns, nil
}

// GetByTableID retrieves all check-ins for a specific table
func (r *ParticipantCheckInRepository) GetByTableID(tableID uuid.UUID, since *time.Time) ([]models.ParticipantCheckIn, error) {
	query := `
		SELECT id, team_id, team_member_id, volunteer_id, table_id, 
		       participant_name, participant_role, checked_in_at
		FROM participant_check_ins
		WHERE table_id = $1
	`

	args := []interface{}{tableID}

	if since != nil {
		query += " AND checked_in_at > $2"
		args = append(args, since)
	}

	query += " ORDER BY checked_in_at DESC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query table check-ins: %w", err)
	}
	defer rows.Close()

	var checkIns []models.ParticipantCheckIn
	for rows.Next() {
		var checkIn models.ParticipantCheckIn
		err := rows.Scan(
			&checkIn.ID,
			&checkIn.TeamID,
			&checkIn.TeamMemberID,
			&checkIn.VolunteerID,
			&checkIn.TableID,
			&checkIn.ParticipantName,
			&checkIn.ParticipantRole,
			&checkIn.CheckedInAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan participant check-in: %w", err)
		}
		checkIns = append(checkIns, checkIn)
	}

	return checkIns, nil
}

// Delete removes participant check-ins for a team (for undo functionality)
func (r *ParticipantCheckInRepository) DeleteByTeamID(teamID uuid.UUID, volunteerID uuid.UUID) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete participant check-ins
	deleteQuery := `
		DELETE FROM participant_check_ins 
		WHERE team_id = $1 AND volunteer_id = $2
	`
	_, err = tx.Exec(deleteQuery, teamID, volunteerID)
	if err != nil {
		return fmt.Errorf("failed to delete participant check-ins: %w", err)
	}

	// Reset team's checked_in_at
	updateQuery := `
		UPDATE teams 
		SET checked_in_at = NULL, volunteer_table_id = NULL
		WHERE id = $1
	`
	_, err = tx.Exec(updateQuery, teamID)
	if err != nil {
		return fmt.Errorf("failed to reset team check-in: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// CreateTableConfirmation marks a team as confirmed by table volunteer
func (r *ParticipantCheckInRepository) CreateTableConfirmation(confirmation *models.TableConfirmation) error {
	confirmation.ID = uuid.New()
	confirmation.ConfirmedAt = time.Now()

	query := `
		INSERT INTO table_confirmations (id, team_id, volunteer_id, table_id, confirmed_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err := r.db.Exec(
		query,
		confirmation.ID,
		confirmation.TeamID,
		confirmation.VolunteerID,
		confirmation.TableID,
		confirmation.ConfirmedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create table confirmation: %w", err)
	}

	return nil
}

// allowedCities is the whitelist for GetRecentByCity to avoid SQL injection when inlining (avoids pq statement cache bug).
var allowedCities = map[string]bool{"BLR": true, "PUNE": true, "NOIDA": true, "LKO": true}

// GetRecentByCity returns recent check-ins for volunteers in the given city (for volunteer-admin dashboard).
// city must be one of BLR, PUNE, NOIDA, LKO. No bound params to avoid pq prepared-statement cache issues.
func (r *ParticipantCheckInRepository) GetRecentByCity(city string, limit int) ([]models.CheckInWithDetails, error) {
	if !allowedCities[city] {
		return nil, fmt.Errorf("invalid city for check-ins: %s", city)
	}
	query := fmt.Sprintf(`
		SELECT p.id, p.team_id, p.volunteer_id, p.participant_name, p.participant_role, p.checked_in_at,
		       v.email AS volunteer_email, t.team_name
		FROM participant_check_ins p
		JOIN volunteers v ON p.volunteer_id = v.id
		JOIN teams t ON p.team_id = t.id
		WHERE v.city = '%s'
		ORDER BY p.checked_in_at DESC
		LIMIT %d
	`, city, limit)
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query check-ins by city: %w", err)
	}
	defer rows.Close()
	var list []models.CheckInWithDetails
	for rows.Next() {
		var c models.CheckInWithDetails
		err := rows.Scan(
			&c.ID, &c.TeamID, &c.VolunteerID, &c.ParticipantName, &c.ParticipantRole, &c.CheckedInAt,
			&c.VolunteerEmail, &c.TeamName,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

// CheckedInTeamFilters optional filters for GetCheckedInTeamsByCity.
type CheckedInTeamFilters struct {
	TeamNameSearch  string    // ILIKE %teamNameSearch%
	TableID         *uuid.UUID // filter by event table ID (volunteers assigned to this table)
}

// GetCheckedInTeamsByCity returns one row per checked-in team (team name, size, room allocated) for the city.
func (r *ParticipantCheckInRepository) GetCheckedInTeamsByCity(city string, limit int, f CheckedInTeamFilters) ([]models.CheckedInTeam, error) {
	if !allowedCities[city] {
		return nil, fmt.Errorf("invalid city: %s", city)
	}
	// Base: distinct teams from participant_check_ins (via volunteers in city). Table = volunteer's assigned table (volunteers are table-specific).
	query := `
		SELECT t.id AS team_id, t.team_name,
		       (SELECT tm.name FROM team_members tm WHERE tm.team_id = t.id AND tm.role = 'leader' LIMIT 1) AS team_leader_name,
		       COUNT(p.id)::int AS team_size,
		       MAX(p.checked_in_at) AS latest_checkin_at,
		       (SELECT COALESCE(et.table_name, et.table_number) FROM participant_check_ins p2 JOIN volunteers v2 ON p2.volunteer_id = v2.id LEFT JOIN event_tables et ON et.id = v2.table_id WHERE p2.team_id = t.id ORDER BY p2.checked_in_at DESC LIMIT 1) AS table_name,
		       (SELECT v2.email FROM participant_check_ins p2 JOIN volunteers v2 ON p2.volunteer_id = v2.id WHERE p2.team_id = t.id ORDER BY p2.checked_in_at DESC LIMIT 1) AS volunteer_email
		FROM teams t
		JOIN participant_check_ins p ON p.team_id = t.id
		JOIN volunteers v ON p.volunteer_id = v.id
		WHERE LOWER(TRIM(v.city)) = LOWER(TRIM($1))`
	args := []interface{}{city}
	n := 2

	if f.TeamNameSearch != "" {
		query += fmt.Sprintf(" AND t.team_name ILIKE $%d", n)
		args = append(args, "%"+f.TeamNameSearch+"%")
		n++
	}
	if f.TableID != nil {
		query += fmt.Sprintf(" AND v.table_id = $%d", n)
		args = append(args, *f.TableID)
		n++
	}

	query += fmt.Sprintf(" GROUP BY t.id, t.team_name ORDER BY latest_checkin_at DESC LIMIT $%d", n)
	args = append(args, limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query checked-in teams: %w", err)
	}
	defer rows.Close()
	var list []models.CheckedInTeam
	for rows.Next() {
		var row models.CheckedInTeam
		var leaderName, tableName sql.NullString
		var volunteerEmail sql.NullString
		err := rows.Scan(&row.TeamID, &row.TeamName, &leaderName, &row.TeamSize, &row.LatestCheckInAt, &tableName, &volunteerEmail)
		if err != nil {
			return nil, err
		}
		if leaderName.Valid {
			row.TeamLeaderName = leaderName.String
		}
		if tableName.Valid {
			row.TableName = &tableName.String
		}
		if volunteerEmail.Valid {
			row.VolunteerEmail = volunteerEmail.String
		}
		list = append(list, row)
	}
	return list, nil
}

// IsTeamConfirmed checks if a team has been confirmed by table volunteer
func (r *ParticipantCheckInRepository) IsTeamConfirmed(teamID uuid.UUID) (bool, *time.Time, error) {
	query := `
		SELECT confirmed_at
		FROM table_confirmations
		WHERE team_id = $1
		ORDER BY confirmed_at DESC
		LIMIT 1
	`

	var confirmedAt time.Time
	err := r.db.QueryRow(query, teamID).Scan(&confirmedAt)
	if err == sql.ErrNoRows {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, fmt.Errorf("failed to check team confirmation: %w", err)
	}

	return true, &confirmedAt, nil
}

// GetConfirmationsByVolunteerID retrieves table confirmations for a volunteer
func (r *ParticipantCheckInRepository) GetConfirmationsByVolunteerID(volunteerID uuid.UUID, limit int) ([]models.TableConfirmation, error) {
	query := `
		SELECT id, team_id, volunteer_id, table_id, confirmed_at
		FROM table_confirmations
		WHERE volunteer_id = $1
		ORDER BY confirmed_at DESC
		LIMIT $2
	`

	rows, err := r.db.Query(query, volunteerID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query volunteer confirmations: %w", err)
	}
	defer rows.Close()

	var confirmations []models.TableConfirmation
	for rows.Next() {
		var conf models.TableConfirmation
		err := rows.Scan(
			&conf.ID,
			&conf.TeamID,
			&conf.VolunteerID,
			&conf.TableID,
			&conf.ConfirmedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan table confirmation: %w", err)
		}
		confirmations = append(confirmations, conf)
	}

	return confirmations, nil
}
