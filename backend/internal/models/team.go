package models

import (
	"time"

	"github.com/google/uuid"
)

type TeamStatus string

const (
	StatusShortlisted TeamStatus = "shortlisted"
	StatusRSVPDone    TeamStatus = "rsvp_done"
	StatusRSVP2Done   TeamStatus = "rsvp2_done"
	StatusCheckedIn   TeamStatus = "checked_in"
)

type MemberRole string

const (
	RoleLeader MemberRole = "leader"
	RoleMember MemberRole = "member"
)

type City string

const (
	CityBLR   City = "BLR"
	CityPUNE  City = "PUNE"
	CityNOIDA City = "NOIDA"
	CityLKO   City = "LKO"
)

type Team struct {
	ID               uuid.UUID    `json:"id" db:"id"`
	TeamName         string       `json:"team_name" db:"team_name"`
	City             *City        `json:"city" db:"city"`
	Status           TeamStatus   `json:"status" db:"status"`
	ProblemStatement *string      `json:"problem_statement" db:"problem_statement"`
	QRCodeToken      *string      `json:"qr_code_token" db:"qr_code_token"`
	RSVPLocked          bool         `json:"rsvp_locked" db:"rsvp_locked"`
	RSVPLockedAt        *time.Time   `json:"rsvp_locked_at" db:"rsvp_locked_at"`
	RSVP2Locked         bool         `json:"rsvp2_locked" db:"rsvp2_locked"`
	RSVP2LockedAt       *time.Time   `json:"rsvp2_locked_at" db:"rsvp2_locked_at"`
	RSVP2SelectedMembers []byte      `json:"rsvp2_selected_members" db:"rsvp2_selected_members"`
	CheckedInAt         *time.Time   `json:"checked_in_at" db:"checked_in_at"`
	CheckedInBy         *uuid.UUID   `json:"checked_in_by" db:"checked_in_by"`
	DashboardToken      *string      `json:"dashboard_token" db:"dashboard_token"`
	MemberCount         int          `json:"member_count" db:"member_count"`
	EditAllowedUntil    *time.Time   `json:"edit_allowed_until,omitempty" db:"edit_allowed_until"`
	RegistrationDeskID   *uuid.UUID  `json:"registration_desk_id,omitempty" db:"registration_desk_id"`
	CreatedAt        time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at" db:"updated_at"`
	Members          []TeamMember `json:"members,omitempty"`

	// Populated when loading dashboard (join with event_tables)
	RegistrationDeskTableName   *string `json:"registration_desk_table_name,omitempty" db:"-"`
	RegistrationDeskTableNumber *string `json:"registration_desk_table_number,omitempty" db:"-"`
}

// CheckedIn returns true if the team has been checked in
func (t *Team) CheckedIn() bool {
	return t.CheckedInAt != nil
}

type TeamMember struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	TeamID            uuid.UUID  `json:"team_id" db:"team_id"`
	Name              string     `json:"name" db:"name"`
	Email             string     `json:"email" db:"email"`
	Phone             string     `json:"phone" db:"phone"`
	Role              MemberRole `json:"role" db:"role"`
	TShirtSize        *string    `json:"tshirt_size" db:"tshirt_size"`
	IndividualQRToken *string    `json:"individual_qr_token" db:"individual_qr_token"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`
}

// Request/Response DTOs
type TeamSearchRequest struct {
	Query string `form:"query" binding:"required,min=2"`
}

type TeamSearchResponse struct {
	ID          uuid.UUID  `json:"id"`
	TeamName    string     `json:"team_name"`
	LeaderName  string     `json:"leader_name"`
	MaskedEmail string     `json:"masked_email"`
	City        *City      `json:"city"`
	Status      TeamStatus `json:"status"`
	MemberCount int        `json:"member_count"`
	RSVPLocked  bool       `json:"rsvp_locked"`
}

type RSVPRequest struct {
	City    City               `json:"city" binding:"required"`
	Members []TeamMemberUpdate `json:"members" binding:"required,min=1,max=6"`
}

type TeamMemberUpdate struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name" binding:"required"`
	Email      string    `json:"email" binding:"required,email"`
	Phone      string    `json:"phone" binding:"required,len=10"`
	TShirtSize *string   `json:"tshirt_size"`
}

type RSVP2SubmissionRequest struct {
	SelectedMemberIDs []uuid.UUID `json:"selected_member_ids" binding:"required,min=2"`
}
