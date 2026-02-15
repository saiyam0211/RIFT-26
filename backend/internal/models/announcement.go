package models

import (
	"time"

	"github.com/google/uuid"
)

type Announcement struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	Title     string     `json:"title" db:"title"`
	Content   string     `json:"content" db:"content"`
	Priority  int        `json:"priority" db:"priority"`
	IsActive  bool       `json:"is_active" db:"is_active"`
	ButtonText *string   `json:"button_text,omitempty" db:"button_text"`
	ButtonURL  *string   `json:"button_url,omitempty" db:"button_url"`
	Filters   []byte     `json:"filters,omitempty" db:"filters"` // JSONB
	CreatedBy *uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
}

type ProblemStatement struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description *string   `json:"description" db:"description"`
	Track       *string   `json:"track" db:"track"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type ProjectSubmission struct {
	ID               uuid.UUID `json:"id" db:"id"`
	TeamID           uuid.UUID `json:"team_id" db:"team_id"`
	GithubRepo       *string   `json:"github_repo" db:"github_repo"`
	HostedLink       *string   `json:"hosted_link" db:"hosted_link"`
	PresentationLink *string   `json:"presentation_link" db:"presentation_link"`
	DemoVideoLink    *string   `json:"demo_video_link" db:"demo_video_link"`
	SubmittedAt      time.Time `json:"submitted_at" db:"submitted_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type Venue struct {
	ID              uuid.UUID `json:"id" db:"id"`
	City            City      `json:"city" db:"city"`
	VenueName       string    `json:"venue_name" db:"venue_name"`
	Address         string    `json:"address" db:"address"`
	GoogleMapsEmbed *string   `json:"google_maps_embed" db:"google_maps_embed"`
	Latitude        *float64  `json:"latitude" db:"latitude"`
	Longitude       *float64  `json:"longitude" db:"longitude"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type SupportTicket struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	TeamID      uuid.UUID  `json:"team_id" db:"team_id"`
	Subject     string     `json:"subject" db:"subject"`
	Description string     `json:"description" db:"description"`
	Status      string     `json:"status" db:"status"`
	ResolvedBy  *uuid.UUID `json:"resolved_by" db:"resolved_by"`
	ResolvedAt  *time.Time `json:"resolved_at" db:"resolved_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// Request DTOs
type CreateAnnouncementRequest struct {
	Title    string              `json:"title" binding:"required"`
	Content  string              `json:"content" binding:"required"`
	Priority int                 `json:"priority" binding:"min=0,max=10"`
	ButtonText *string           `json:"button_text" binding:"omitempty"`
	ButtonURL  *string           `json:"button_url" binding:"omitempty,url"`
	Filters  AnnouncementFilters `json:"filters"`
}

type SubmitProjectRequest struct {
	GithubRepo       string `json:"github_repo" binding:"required,url"`
	HostedLink       string `json:"hosted_link" binding:"omitempty,url"`
	PresentationLink string `json:"presentation_link" binding:"omitempty,url"`
	DemoVideoLink    string `json:"demo_video_link" binding:"omitempty,url"`
}

// Ticket models (using support_tickets table)
type Ticket struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	TeamID          uuid.UUID  `json:"team_id" db:"team_id"`
	Subject         string     `json:"subject" db:"subject"`
	Description     string     `json:"description" db:"description"`
	Message         *string    `json:"message,omitempty" db:"message"`
	Status          string     `json:"status" db:"status"`
	Resolution      *string    `json:"resolution,omitempty" db:"resolution"`
	ResolvedBy      *uuid.UUID `json:"resolved_by,omitempty" db:"resolved_by"`
	ResolvedByEmail *string    `json:"resolved_by_email,omitempty" db:"resolved_by_email"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`

	// Relations
	Team Team `json:"team,omitempty"`
}

type CreateTicketRequest struct {
	TeamID  string `json:"team_id" binding:"required"`
	Subject string `json:"subject" binding:"required,min=5,max=255"`
	Message string `json:"message" binding:"required,min=10"`
}

type ResolveTicketRequest struct {
	Resolution  string `json:"resolution" binding:"required,min=10"`
	SendEmail   bool   `json:"send_email"`
	AllowEdit   bool   `json:"allow_edit"`
	EditMinutes int    `json:"edit_minutes"`
}

// Announcement filters for targeting
type AnnouncementFilters struct {
	TeamSizes     []int    `json:"team_sizes,omitempty"`
	Cities        []string `json:"cities,omitempty"`
	TeamIDs       []string `json:"team_ids,omitempty"`
	OnlyRSVP1Done bool     `json:"only_rsvp1_done,omitempty"` // true = only teams with RSVP I done, RSVP II not done (status = rsvp_done)
}

// Email log model
type EmailLog struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Subject     string     `json:"subject" db:"subject"`
	Recipients  []byte     `json:"recipients" db:"recipients"` // JSONB
	HTMLContent string     `json:"html_content" db:"html_content"`
	Filters     []byte     `json:"filters" db:"filters"` // JSONB
	SentCount   int        `json:"sent_count" db:"sent_count"`
	CreatedBy   *uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

type SendEmailRequest struct {
	Subject     string              `json:"subject" binding:"required,min=1,max=255"`
	HTMLContent string              `json:"html_content" binding:"required"`
	Filters     AnnouncementFilters `json:"filters"`
}
