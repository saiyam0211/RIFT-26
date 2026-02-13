package models

import (
	"time"

	"github.com/google/uuid"
)

// ParticipantCheckIn represents an individual participant check-in
type ParticipantCheckIn struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	TeamID          uuid.UUID  `json:"team_id" db:"team_id"`
	TeamMemberID    *uuid.UUID `json:"team_member_id,omitempty" db:"team_member_id"`
	VolunteerID     uuid.UUID  `json:"volunteer_id" db:"volunteer_id"`
	TableID         *uuid.UUID `json:"table_id,omitempty" db:"table_id"`
	ParticipantName string     `json:"participant_name" db:"participant_name"`
	ParticipantRole string     `json:"participant_role" db:"participant_role"` // 'leader' or 'member'
	CheckedInAt     time.Time  `json:"checked_in_at" db:"checked_in_at"`
}

// TableConfirmation represents when a table volunteer marks a team as done
type TableConfirmation struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	TeamID      uuid.UUID  `json:"team_id" db:"team_id"`
	VolunteerID uuid.UUID  `json:"volunteer_id" db:"volunteer_id"`
	TableID     *uuid.UUID `json:"table_id,omitempty" db:"table_id"`
	ConfirmedAt time.Time  `json:"confirmed_at" db:"confirmed_at"`
}

// CheckInRequest represents the request to check in a team with selected participants
type CheckInRequest struct {
	TeamID       uuid.UUID `json:"team_id" binding:"required"`
	Participants []struct {
		MemberID *uuid.UUID `json:"member_id,omitempty"` // nil for leader
		Name     string     `json:"name" binding:"required"`
		Role     string     `json:"role" binding:"required"` // 'leader' or 'member'
	} `json:"participants" binding:"required,min=1"`
}

// CheckInResponse represents the response after check-in
type CheckInResponse struct {
	Team                  *Team                `json:"team"`
	ParticipantsCheckedIn []ParticipantCheckIn `json:"participants_checked_in"`
	AlreadyCheckedIn      bool                 `json:"already_checked_in"`
	Message               string               `json:"message"`
}

// CheckInHistoryResponse represents the check-in history for a volunteer
type CheckInHistoryResponse struct {
	CheckIns []struct {
		TeamID            uuid.UUID            `json:"team_id"`
		TeamName          string               `json:"team_name"`
		CheckedInAt       time.Time            `json:"checked_in_at"`
		ParticipantsCount int                  `json:"participants_count"`
		Participants      []ParticipantCheckIn `json:"participants"`
		TableConfirmed    bool                 `json:"table_confirmed"`
		TableConfirmedAt  *time.Time           `json:"table_confirmed_at,omitempty"`
	} `json:"check_ins"`
}
