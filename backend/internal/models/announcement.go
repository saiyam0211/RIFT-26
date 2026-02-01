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
	Title    string `json:"title" binding:"required"`
	Content  string `json:"content" binding:"required"`
	Priority int    `json:"priority" binding:"min=0,max=10"`
}

type SubmitProjectRequest struct {
	GithubRepo       string `json:"github_repo" binding:"required,url"`
	HostedLink       string `json:"hosted_link" binding:"omitempty,url"`
	PresentationLink string `json:"presentation_link" binding:"omitempty,url"`
	DemoVideoLink    string `json:"demo_video_link" binding:"omitempty,url"`
}
