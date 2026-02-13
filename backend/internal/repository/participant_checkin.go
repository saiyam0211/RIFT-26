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
