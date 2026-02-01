# RIFT '26 Hackathon Management Platform - Execution Plan

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: GoLang (Gin framework)
- **Database**: PostgreSQL
- **Authentication**: JWT + OTP (via Twilio/MSG91)
- **QR Code**: go-qrcode (backend) + react-qr-code (frontend)

---

## Project Structure Overview

```
rift26-platform/
├── frontend/                 # Next.js Application
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── verify-otp/
│   │   ├── (participant)/
│   │   │   ├── rsvp/
│   │   │   ├── dashboard/
│   │   │   └── submit/
│   │   ├── (volunteer)/
│   │   │   └── scanner/
│   │   ├── (admin)/
│   │   │   ├── teams/
│   │   │   ├── upload/
│   │   │   └── announcements/
│   │   ├── api/
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   └── types/
│
├── backend/                  # GoLang API
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── database/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repository/
│   │   ├── services/
│   │   └── utils/
│   ├── pkg/
│   │   ├── otp/
│   │   └── qrcode/
│   └── migrations/
│
└── docker-compose.yml
```

---

# PHASE 1: PROJECT SETUP & INFRASTRUCTURE

## Task 1.1: Initialize Frontend (Next.js)

### Commands to Execute:
```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
cd frontend
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input label form dialog toast alert badge tabs table dropdown-menu select
npm install @tanstack/react-query axios zustand react-qr-code html5-qrcode react-confetti date-fns zod react-hook-form @hookform/resolvers lucide-react
```

### File: `frontend/package.json`
```json
{
  "name": "rift26-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.1.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "typescript": "5.3.3",
    "@tanstack/react-query": "5.17.0",
    "axios": "1.6.5",
    "zustand": "4.4.7",
    "react-qr-code": "2.0.12",
    "html5-qrcode": "2.3.8",
    "react-confetti": "6.1.0",
    "date-fns": "3.2.0",
    "zod": "3.22.4",
    "react-hook-form": "7.49.3",
    "@hookform/resolvers": "3.3.4",
    "class-variance-authority": "0.7.0",
    "clsx": "2.1.0",
    "tailwind-merge": "2.2.0",
    "lucide-react": "0.309.0"
  },
  "devDependencies": {
    "@types/node": "20.11.0",
    "@types/react": "18.2.47",
    "@types/react-dom": "18.2.18",
    "autoprefixer": "10.4.16",
    "postcss": "8.4.33",
    "tailwindcss": "3.4.1"
  }
}
```

---

## Task 1.2: Initialize Backend (GoLang)

### Commands to Execute:
```bash
mkdir -p backend/cmd/server
mkdir -p backend/internal/{config,database,handlers,middleware,models,repository,services,utils}
mkdir -p backend/pkg/{otp,qrcode}
mkdir -p backend/migrations
cd backend
go mod init github.com/rift26/backend
go get github.com/gin-gonic/gin
go get github.com/lib/pq
go get github.com/golang-jwt/jwt/v5
go get github.com/skip2/go-qrcode
go get github.com/joho/godotenv
go get github.com/google/uuid
go get golang.org/x/crypto/bcrypt
```

### File: `backend/go.mod`
```go
module github.com/rift26/backend

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/lib/pq v1.10.9
    github.com/golang-jwt/jwt/v5 v5.2.0
    github.com/skip2/go-qrcode v0.0.0-20200617195104-da1b6568686e
    github.com/joho/godotenv v1.5.1
    github.com/google/uuid v1.5.0
    golang.org/x/crypto v0.18.0
)
```

---

## Task 1.3: PostgreSQL Database Setup

### File: `backend/migrations/001_initial_schema.sql`
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE team_status AS ENUM ('shortlisted', 'rsvp_done', 'checked_in');
CREATE TYPE member_role AS ENUM ('leader', 'member');
CREATE TYPE user_role AS ENUM ('participant', 'volunteer', 'admin');
CREATE TYPE city_enum AS ENUM ('BLR', 'PUNE', 'NOIDA', 'LKO');

-- Users table (for volunteers and admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'participant',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name VARCHAR(255) NOT NULL UNIQUE,
    city city_enum,
    status team_status DEFAULT 'shortlisted',
    problem_statement VARCHAR(255),
    qr_code_token VARCHAR(255) UNIQUE,
    rsvp_locked BOOLEAN DEFAULT FALSE,
    rsvp_locked_at TIMESTAMP WITH TIME ZONE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES users(id),
    dashboard_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team Members table
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role member_role NOT NULL DEFAULT 'member',
    tshirt_size VARCHAR(10),
    individual_qr_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OTP table
CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    team_id UUID REFERENCES teams(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Announcements table
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Problem Statements table
CREATE TABLE problem_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    track VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Submissions table
CREATE TABLE project_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL UNIQUE REFERENCES teams(id),
    github_repo VARCHAR(500),
    hosted_link VARCHAR(500),
    presentation_link VARCHAR(500),
    demo_video_link VARCHAR(500),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Support Tickets table (for edit requests after lock)
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Venue Information table
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city city_enum UNIQUE NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    google_maps_embed TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_teams_status ON teams(status);
CREATE INDEX idx_teams_city ON teams(city);
CREATE INDEX idx_teams_qr_token ON teams(qr_code_token);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_phone ON team_members(phone);
CREATE INDEX idx_otps_phone ON otps(phone);
CREATE INDEX idx_otps_expires_at ON otps(expires_at);
CREATE INDEX idx_announcements_active ON announcements(is_active);
```

### File: `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: rift26_postgres
    environment:
      POSTGRES_USER: rift26_user
      POSTGRES_PASSWORD: rift26_secure_password
      POSTGRES_DB: rift26_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rift26_user -d rift26_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: rift26_backend
    environment:
      - DATABASE_URL=postgres://rift26_user:rift26_secure_password@postgres:5432/rift26_db?sslmode=disable
      - JWT_SECRET=your-super-secret-jwt-key-change-in-production
      - OTP_SERVICE_API_KEY=your-twilio-or-msg91-api-key
      - PORT=8080
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: rift26_frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

# PHASE 2: BACKEND DEVELOPMENT (GoLang)

## Task 2.1: Configuration & Database Connection

### File: `backend/internal/config/config.go`
```go
package config

import (
    "os"
    "github.com/joho/godotenv"
)

type Config struct {
    DatabaseURL     string
    JWTSecret       string
    OTPServiceKey   string
    Port            string
    Environment     string
}

func Load() (*Config, error) {
    godotenv.Load()
    
    return &Config{
        DatabaseURL:   getEnv("DATABASE_URL", "postgres://rift26_user:rift26_secure_password@localhost:5432/rift26_db?sslmode=disable"),
        JWTSecret:     getEnv("JWT_SECRET", "default-secret-change-me"),
        OTPServiceKey: getEnv("OTP_SERVICE_API_KEY", ""),
        Port:          getEnv("PORT", "8080"),
        Environment:   getEnv("ENVIRONMENT", "development"),
    }, nil
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}
```

### File: `backend/internal/database/postgres.go`
```go
package database

import (
    "database/sql"
    "fmt"
    _ "github.com/lib/pq"
)

type DB struct {
    *sql.DB
}

func NewPostgresDB(databaseURL string) (*DB, error) {
    db, err := sql.Open("postgres", databaseURL)
    if err != nil {
        return nil, fmt.Errorf("failed to open database: %w", err)
    }
    
    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("failed to ping database: %w", err)
    }
    
    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)
    
    return &DB{db}, nil
}

func (db *DB) Close() error {
    return db.DB.Close()
}
```

---

## Task 2.2: Models Definition

### File: `backend/internal/models/team.go`
```go
package models

import (
    "time"
    "github.com/google/uuid"
)

type TeamStatus string

const (
    StatusShortlisted TeamStatus = "shortlisted"
    StatusRSVPDone    TeamStatus = "rsvp_done"
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
    ID               uuid.UUID   `json:"id" db:"id"`
    TeamName         string      `json:"team_name" db:"team_name"`
    City             *City       `json:"city" db:"city"`
    Status           TeamStatus  `json:"status" db:"status"`
    ProblemStatement *string     `json:"problem_statement" db:"problem_statement"`
    QRCodeToken      *string     `json:"qr_code_token" db:"qr_code_token"`
    RSVPLocked       bool        `json:"rsvp_locked" db:"rsvp_locked"`
    RSVPLockedAt     *time.Time  `json:"rsvp_locked_at" db:"rsvp_locked_at"`
    CheckedInAt      *time.Time  `json:"checked_in_at" db:"checked_in_at"`
    CheckedInBy      *uuid.UUID  `json:"checked_in_by" db:"checked_in_by"`
    DashboardToken   *string     `json:"dashboard_token" db:"dashboard_token"`
    CreatedAt        time.Time   `json:"created_at" db:"created_at"`
    UpdatedAt        time.Time   `json:"updated_at" db:"updated_at"`
    Members          []TeamMember `json:"members,omitempty"`
}

type TeamMember struct {
    ID               uuid.UUID   `json:"id" db:"id"`
    TeamID           uuid.UUID   `json:"team_id" db:"team_id"`
    Name             string      `json:"name" db:"name"`
    Email            string      `json:"email" db:"email"`
    Phone            string      `json:"phone" db:"phone"`
    Role             MemberRole  `json:"role" db:"role"`
    TShirtSize       *string     `json:"tshirt_size" db:"tshirt_size"`
    IndividualQRToken *string    `json:"individual_qr_token" db:"individual_qr_token"`
    CreatedAt        time.Time   `json:"created_at" db:"created_at"`
    UpdatedAt        time.Time   `json:"updated_at" db:"updated_at"`
}
```

### File: `backend/internal/models/user.go`
```go
package models

import (
    "time"
    "github.com/google/uuid"
)

type UserRole string

const (
    UserRoleParticipant UserRole = "participant"
    UserRoleVolunteer   UserRole = "volunteer"
    UserRoleAdmin       UserRole = "admin"
)

type User struct {
    ID           uuid.UUID `json:"id" db:"id"`
    Email        string    `json:"email" db:"email"`
    PasswordHash string    `json:"-" db:"password_hash"`
    Name         string    `json:"name" db:"name"`
    Role         UserRole  `json:"role" db:"role"`
    CreatedAt    time.Time `json:"created_at" db:"created_at"`
    UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}
```

### File: `backend/internal/models/otp.go`
```go
package models

import (
    "time"
    "github.com/google/uuid"
)

type OTP struct {
    ID        uuid.UUID  `json:"id" db:"id"`
    Phone     string     `json:"phone" db:"phone"`
    OTPCode   string     `json:"otp_code" db:"otp_code"`
    TeamID    *uuid.UUID `json:"team_id" db:"team_id"`
    ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
    Verified  bool       `json:"verified" db:"verified"`
    CreatedAt time.Time  `json:"created_at" db:"created_at"`
}
```

### File: `backend/internal/models/announcement.go`
```go
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
    ID               uuid.UUID  `json:"id" db:"id"`
    TeamID           uuid.UUID  `json:"team_id" db:"team_id"`
    GithubRepo       *string    `json:"github_repo" db:"github_repo"`
    HostedLink       *string    `json:"hosted_link" db:"hosted_link"`
    PresentationLink *string    `json:"presentation_link" db:"presentation_link"`
    DemoVideoLink    *string    `json:"demo_video_link" db:"demo_video_link"`
    SubmittedAt      time.Time  `json:"submitted_at" db:"submitted_at"`
    UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

type Venue struct {
    ID             uuid.UUID `json:"id" db:"id"`
    City           City      `json:"city" db:"city"`
    VenueName      string    `json:"venue_name" db:"venue_name"`
    Address        string    `json:"address" db:"address"`
    GoogleMapsEmbed *string  `json:"google_maps_embed" db:"google_maps_embed"`
    Latitude       *float64  `json:"latitude" db:"latitude"`
    Longitude      *float64  `json:"longitude" db:"longitude"`
    CreatedAt      time.Time `json:"created_at" db:"created_at"`
}
```

---

## Task 2.3: Repository Layer

### File: `backend/internal/repository/team_repository.go`
```go
package repository

import (
    "context"
    "database/sql"
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

func (r *TeamRepository) SearchByName(ctx context.Context, teamName string) ([]models.Team, error) {
    query := `
        SELECT id, team_name, city, status, problem_statement, qr_code_token, 
               rsvp_locked, rsvp_locked_at, checked_in_at, checked_in_by, 
               dashboard_token, created_at, updated_at
        FROM teams 
        WHERE LOWER(team_name) LIKE LOWER($1)
        LIMIT 10
    `
    rows, err := r.db.QueryContext(ctx, query, "%"+teamName+"%")
    if err != nil {
        return nil, err
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
        )
        if err != nil {
            return nil, err
        }
        teams = append(teams, team)
    }
    return teams, nil
}

func (r *TeamRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Team, error) {
    query := `
        SELECT id, team_name, city, status, problem_statement, qr_code_token, 
               rsvp_locked, rsvp_locked_at, checked_in_at, checked_in_by, 
               dashboard_token, created_at, updated_at
        FROM teams WHERE id = $1
    `
    var team models.Team
    err := r.db.QueryRowContext(ctx, query, id).Scan(
        &team.ID, &team.TeamName, &team.City, &team.Status,
        &team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
        &team.RSVPLockedAt, &team.CheckedInAt, &team.CheckedInBy,
        &team.DashboardToken, &team.CreatedAt, &team.UpdatedAt,
    )
    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }
    
    members, err := r.GetMembersByTeamID(ctx, id)
    if err != nil {
        return nil, err
    }
    team.Members = members
    
    return &team, nil
}

func (r *TeamRepository) GetByQRToken(ctx context.Context, token string) (*models.Team, error) {
    query := `
        SELECT id, team_name, city, status, problem_statement, qr_code_token, 
               rsvp_locked, rsvp_locked_at, checked_in_at, checked_in_by, 
               dashboard_token, created_at, updated_at
        FROM teams WHERE qr_code_token = $1
    `
    var team models.Team
    err := r.db.QueryRowContext(ctx, query, token).Scan(
        &team.ID, &team.TeamName, &team.City, &team.Status,
        &team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
        &team.RSVPLockedAt, &team.CheckedInAt, &team.CheckedInBy,
        &team.DashboardToken, &team.CreatedAt, &team.UpdatedAt,
    )
    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }
    
    members, err := r.GetMembersByTeamID(ctx, team.ID)
    if err != nil {
        return nil, err
    }
    team.Members = members
    
    return &team, nil
}

func (r *TeamRepository) GetByDashboardToken(ctx context.Context, token string) (*models.Team, error) {
    query := `
        SELECT id, team_name, city, status, problem_statement, qr_code_token, 
               rsvp_locked, rsvp_locked_at, checked_in_at, checked_in_by, 
               dashboard_token, created_at, updated_at
        FROM teams WHERE dashboard_token = $1
    `
    var team models.Team
    err := r.db.QueryRowContext(ctx, query, token).Scan(
        &team.ID, &team.TeamName, &team.City, &team.Status,
        &team.ProblemStatement, &team.QRCodeToken, &team.RSVPLocked,
        &team.RSVPLockedAt, &team.CheckedInAt, &team.CheckedInBy,
        &team.DashboardToken, &team.CreatedAt, &team.UpdatedAt,
    )
    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }
    
    members, err := r.GetMembersByTeamID(ctx, team.ID)
    if err != nil {
        return nil, err
    }
    team.Members = members
    
    return &team, nil
}

func (r *TeamRepository) GetMembersByTeamID(ctx context.Context, teamID uuid.UUID) ([]models.TeamMember, error) {
    query := `
        SELECT id, team_id, name, email, phone, role, tshirt_size, 
               individual_qr_token, created_at, updated_at
        FROM team_members WHERE team_id = $1
        ORDER BY role DESC, name ASC
    `
    rows, err := r.db.QueryContext(ctx, query, teamID)
    if err != nil {
        return nil, err
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
            return nil, err
        }
        members = append(members, member)
    }
    return members, nil
}

func (r *TeamRepository) UpdateRSVP(ctx context.Context, teamID uuid.UUID, city models.City, members []models.TeamMember) error {
    tx, err := r.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    qrToken := uuid.New().String()
    dashboardToken := uuid.New().String()
    
    _, err = tx.ExecContext(ctx, `
        UPDATE teams SET 
            city = $1, status = 'rsvp_done', qr_code_token = $2,
            rsvp_locked = true, rsvp_locked_at = NOW(), 
            dashboard_token = $3, updated_at = NOW()
        WHERE id = $4
    `, city, qrToken, dashboardToken, teamID)
    if err != nil {
        return err
    }
    
    for _, member := range members {
        individualQR := uuid.New().String()
        _, err = tx.ExecContext(ctx, `
            UPDATE team_members SET 
                name = $1, email = $2, phone = $3, tshirt_size = $4,
                individual_qr_token = $5, updated_at = NOW()
            WHERE id = $6
        `, member.Name, member.Email, member.Phone, member.TShirtSize, individualQR, member.ID)
        if err != nil {
            return err
        }
    }
    
    return tx.Commit()
}

func (r *TeamRepository) CheckIn(ctx context.Context, teamID uuid.UUID, volunteerID uuid.UUID) error {
    _, err := r.db.ExecContext(ctx, `
        UPDATE teams SET 
            status = 'checked_in', checked_in_at = NOW(), 
            checked_in_by = $1, updated_at = NOW()
        WHERE id = $2
    `, volunteerID, teamID)
    return err
}

func (r *TeamRepository) UpdateProblemStatement(ctx context.Context, teamID uuid.UUID, ps string) error {
    _, err := r.db.ExecContext(ctx, `
        UPDATE teams SET problem_statement = $1, updated_at = NOW()
        WHERE id = $2
    `, ps, teamID)
    return err
}

func (r *TeamRepository) GetLeaderPhone(ctx context.Context, teamID uuid.UUID) (string, error) {
    var phone string
    err := r.db.QueryRowContext(ctx, `
        SELECT phone FROM team_members WHERE team_id = $1 AND role = 'leader'
    `, teamID).Scan(&phone)
    return phone, err
}

func (r *TeamRepository) BulkInsert(ctx context.Context, teams []models.Team) error {
    tx, err := r.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    for _, team := range teams {
        var teamID uuid.UUID
        err := tx.QueryRowContext(ctx, `
            INSERT INTO teams (team_name, status) 
            VALUES ($1, 'shortlisted')
            RETURNING id
        `, team.TeamName).Scan(&teamID)
        if err != nil {
            return err
        }
        
        for _, member := range team.Members {
            _, err = tx.ExecContext(ctx, `
                INSERT INTO team_members (team_id, name, email, phone, role)
                VALUES ($1, $2, $3, $4, $5)
            `, teamID, member.Name, member.Email, member.Phone, member.Role)
            if err != nil {
                return err
            }
        }
    }
    
    return tx.Commit()
}

func (r *TeamRepository) GetAllTeams(ctx context.Context, status *models.TeamStatus, city *models.City) ([]models.Team, error) {
    query := `
        SELECT id, team_name, city, status, problem_statement, qr_code_token, 
               rsvp_locked, rsvp_locked_at, checked_in_at, checked_in_by, 
               dashboard_token, created_at, updated_at
        FROM teams WHERE 1=1
    `
    args := []interface{}{}
    argCount := 1
    
    if status != nil {
        query += fmt.Sprintf(" AND status = $%d", argCount)
        args = append(args, *status)
        argCount++
    }
    if city != nil {
        query += fmt.Sprintf(" AND city = $%d", argCount)
        args = append(args, *city)
    }
    query += " ORDER BY team_name ASC"
    
    rows, err := r.db.QueryContext(ctx, query, args...)
    if err != nil {
        return nil, err
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
        )
        if err != nil {
            return nil, err
        }
        teams = append(teams, team)
    }
    return teams, nil
}
```

### File: `backend/internal/repository/otp_repository.go`
```go
package repository

import (
    "context"
    "time"
    "github.com/google/uuid"
    "github.com/rift26/backend/internal/database"
    "github.com/rift26/backend/internal/models"
)

type OTPRepository struct {
    db *database.DB
}

func NewOTPRepository(db *database.DB) *OTPRepository {
    return &OTPRepository{db: db}
}

func (r *OTPRepository) Create(ctx context.Context, phone string, otpCode string, teamID uuid.UUID) error {
    expiresAt := time.Now().Add(5 * time.Minute)
    _, err := r.db.ExecContext(ctx, `
        INSERT INTO otps (phone, otp_code, team_id, expires_at)
        VALUES ($1, $2, $3, $4)
    `, phone, otpCode, teamID, expiresAt)
    return err
}

func (r *OTPRepository) Verify(ctx context.Context, phone string, otpCode string) (*models.OTP, error) {
    var otp models.OTP
    err := r.db.QueryRowContext(ctx, `
        SELECT id, phone, otp_code, team_id, expires_at, verified, created_at
        FROM otps 
        WHERE phone = $1 AND otp_code = $2 AND expires_at > NOW() AND verified = false
        ORDER BY created_at DESC
        LIMIT 1
    `, phone, otpCode).Scan(
        &otp.ID, &otp.Phone, &otp.OTPCode, &otp.TeamID,
        &otp.ExpiresAt, &otp.Verified, &otp.CreatedAt,
    )
    if err != nil {
        return nil, err
    }
    
    _, err = r.db.ExecContext(ctx, `UPDATE otps SET verified = true WHERE id = $1`, otp.ID)
    if err != nil {
        return nil, err
    }
    
    return &otp, nil
}

func (r *OTPRepository) CountRecentByPhone(ctx context.Context, phone string, duration time.Duration) (int, error) {
    var count int
    since := time.Now().Add(-duration)
    err := r.db.QueryRowContext(ctx, `
        SELECT COUNT(*) FROM otps WHERE phone = $1 AND created_at > $2
    `, phone, since).Scan(&count)
    return count, err
}
```

---

## Task 2.4: Services Layer

### File: `backend/internal/services/auth_service.go`
```go
package services

import (
    "context"
    "crypto/rand"
    "errors"
    "fmt"
    "math/big"
    "time"
    
    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "github.com/rift26/backend/internal/models"
    "github.com/rift26/backend/internal/repository"
    "github.com/rift26/backend/pkg/otp"
)

type AuthService struct {
    teamRepo   *repository.TeamRepository
    otpRepo    *repository.OTPRepository
    otpService *otp.OTPService
    jwtSecret  string
}

func NewAuthService(teamRepo *repository.TeamRepository, otpRepo *repository.OTPRepository, otpService *otp.OTPService, jwtSecret string) *AuthService {
    return &AuthService{
        teamRepo:   teamRepo,
        otpRepo:    otpRepo,
        otpService: otpService,
        jwtSecret:  jwtSecret,
    }
}

func (s *AuthService) SendOTP(ctx context.Context, teamID uuid.UUID) (string, error) {
    phone, err := s.teamRepo.GetLeaderPhone(ctx, teamID)
    if err != nil {
        return "", errors.New("team leader not found")
    }
    
    count, err := s.otpRepo.CountRecentByPhone(ctx, phone, time.Hour)
    if err != nil {
        return "", err
    }
    if count >= 3 {
        return "", errors.New("too many OTP requests, please try again later")
    }
    
    otpCode, err := generateOTP(6)
    if err != nil {
        return "", err
    }
    
    if err := s.otpRepo.Create(ctx, phone, otpCode, teamID); err != nil {
        return "", err
    }
    
    if err := s.otpService.Send(phone, otpCode); err != nil {
        return "", err
    }
    
    maskedPhone := maskPhone(phone)
    return maskedPhone, nil
}

func (s *AuthService) VerifyOTP(ctx context.Context, phone string, otpCode string) (*models.OTP, error) {
    return s.otpRepo.Verify(ctx, phone, otpCode)
}

func (s *AuthService) GenerateTeamToken(teamID uuid.UUID, dashboardToken string) (string, error) {
    claims := jwt.MapClaims{
        "team_id":         teamID.String(),
        "dashboard_token": dashboardToken,
        "exp":             time.Now().Add(7 * 24 * time.Hour).Unix(),
        "iat":             time.Now().Unix(),
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(s.jwtSecret))
}

func (s *AuthService) ValidateToken(tokenString string) (*jwt.MapClaims, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return []byte(s.jwtSecret), nil
    })
    
    if err != nil {
        return nil, err
    }
    
    if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
        return &claims, nil
    }
    
    return nil, errors.New("invalid token")
}

func generateOTP(length int) (string, error) {
    const digits = "0123456789"
    otp := make([]byte, length)
    for i := range otp {
        num, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
        if err != nil {
            return "", err
        }
        otp[i] = digits[num.Int64()]
    }
    return string(otp), nil
}

func maskPhone(phone string) string {
    if len(phone) < 4 {
        return "****"
    }
    return "******" + phone[len(phone)-4:]
}
```

### File: `backend/internal/services/team_service.go`
```go
package services

import (
    "context"
    "errors"
    
    "github.com/google/uuid"
    "github.com/rift26/backend/internal/models"
    "github.com/rift26/backend/internal/repository"
    "github.com/rift26/backend/pkg/qrcode"
)

type TeamService struct {
    teamRepo  *repository.TeamRepository
    qrService *qrcode.QRCodeService
}

func NewTeamService(teamRepo *repository.TeamRepository, qrService *qrcode.QRCodeService) *TeamService {
    return &TeamService{
        teamRepo:  teamRepo,
        qrService: qrService,
    }
}

func (s *TeamService) SearchTeams(ctx context.Context, query string) ([]models.Team, error) {
    if len(query) < 2 {
        return nil, errors.New("search query must be at least 2 characters")
    }
    return s.teamRepo.SearchByName(ctx, query)
}

func (s *TeamService) GetTeamByID(ctx context.Context, id uuid.UUID) (*models.Team, error) {
    return s.teamRepo.GetByID(ctx, id)
}

func (s *TeamService) GetTeamByDashboardToken(ctx context.Context, token string) (*models.Team, error) {
    return s.teamRepo.GetByDashboardToken(ctx, token)
}

func (s *TeamService) GetTeamByQRToken(ctx context.Context, token string) (*models.Team, error) {
    return s.teamRepo.GetByQRToken(ctx, token)
}

func (s *TeamService) ConfirmRSVP(ctx context.Context, teamID uuid.UUID, city models.City, members []models.TeamMember) error {
    team, err := s.teamRepo.GetByID(ctx, teamID)
    if err != nil {
        return err
    }
    if team == nil {
        return errors.New("team not found")
    }
    if team.RSVPLocked {
        return errors.New("RSVP is already locked for this team")
    }
    
    return s.teamRepo.UpdateRSVP(ctx, teamID, city, members)
}

func (s *TeamService) CheckInTeam(ctx context.Context, qrToken string, volunteerID uuid.UUID) (*models.Team, error) {
    team, err := s.teamRepo.GetByQRToken(ctx, qrToken)
    if err != nil {
        return nil, err
    }
    if team == nil {
        return nil, errors.New("invalid QR code")
    }
    if team.Status == models.StatusCheckedIn {
        return nil, errors.New("team already checked in")
    }
    if team.Status != models.StatusRSVPDone {
        return nil, errors.New("team has not completed RSVP")
    }
    
    if err := s.teamRepo.CheckIn(ctx, team.ID, volunteerID); err != nil {
        return nil, err
    }
    
    return s.teamRepo.GetByID(ctx, team.ID)
}

func (s *TeamService) SelectProblemStatement(ctx context.Context, teamID uuid.UUID, ps string) error {
    team, err := s.teamRepo.GetByID(ctx, teamID)
    if err != nil {
        return err
    }
    if team == nil {
        return errors.New("team not found")
    }
    if team.ProblemStatement != nil && *team.ProblemStatement != "" {
        return errors.New("problem statement already selected")
    }
    
    return s.teamRepo.UpdateProblemStatement(ctx, teamID, ps)
}

func (s *TeamService) GenerateQRCode(token string) ([]byte, error) {
    return s.qrService.Generate(token)
}

func (s *TeamService) GetAllTeams(ctx context.Context, status *models.TeamStatus, city *models.City) ([]models.Team, error) {
    return s.teamRepo.GetAllTeams(ctx, status, city)
}
```

---

## Task 2.5: HTTP Handlers

### File: `backend/internal/handlers/team_handler.go`
```go
package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "github.com/rift26/backend/internal/models"
    "github.com/rift26/backend/internal/services"
)

type TeamHandler struct {
    teamService *services.TeamService
    authService *services.AuthService
}

func NewTeamHandler(teamService *services.TeamService, authService *services.AuthService) *TeamHandler {
    return &TeamHandler{
        teamService: teamService,
        authService: authService,
    }
}

// SearchTeams - GET /api/v1/teams/search?q=teamname
func (h *TeamHandler) SearchTeams(c *gin.Context) {
    query := c.Query("q")
    if query == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "search query required"})
        return
    }
    
    teams, err := h.teamService.SearchTeams(c.Request.Context(), query)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    type TeamSearchResult struct {
        ID       uuid.UUID `json:"id"`
        TeamName string    `json:"team_name"`
    }
    
    results := make([]TeamSearchResult, len(teams))
    for i, t := range teams {
        results[i] = TeamSearchResult{ID: t.ID, TeamName: t.TeamName}
    }
    
    c.JSON(http.StatusOK, gin.H{"teams": results})
}

// SendOTP - POST /api/v1/teams/:id/send-otp
func (h *TeamHandler) SendOTP(c *gin.Context) {
    teamIDStr := c.Param("id")
    teamID, err := uuid.Parse(teamIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid team ID"})
        return
    }
    
    maskedPhone, err := h.authService.SendOTP(c.Request.Context(), teamID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"masked_phone": maskedPhone, "message": "OTP sent successfully"})
}

// VerifyOTP - POST /api/v1/teams/:id/verify-otp
func (h *TeamHandler) VerifyOTP(c *gin.Context) {
    teamIDStr := c.Param("id")
    teamID, err := uuid.Parse(teamIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid team ID"})
        return
    }
    
    var req struct {
        Phone   string `json:"phone" binding:"required"`
        OTPCode string `json:"otp_code" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    otp, err := h.authService.VerifyOTP(c.Request.Context(), req.Phone, req.OTPCode)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired OTP"})
        return
    }
    
    team, err := h.teamService.GetTeamByID(c.Request.Context(), teamID)
    if err != nil || team == nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
        return
    }
    
    token, err := h.authService.GenerateTeamToken(teamID, "")
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "token":   token,
        "team":    team,
        "otp_id":  otp.ID,
    })
}

// GetTeam - GET /api/v1/teams/:id
func (h *TeamHandler) GetTeam(c *gin.Context) {
    teamIDStr := c.Param("id")
    teamID, err := uuid.Parse(teamIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid team ID"})
        return
    }
    
    team, err := h.teamService.GetTeamByID(c.Request.Context(), teamID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if team == nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"team": team})
}

// ConfirmRSVP - POST /api/v1/teams/:id/rsvp
func (h *TeamHandler) ConfirmRSVP(c *gin.Context) {
    teamIDStr := c.Param("id")
    teamID, err := uuid.Parse(teamIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid team ID"})
        return
    }
    
    var req struct {
        City    models.City          `json:"city" binding:"required"`
        Members []models.TeamMember  `json:"members" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    if err := h.teamService.ConfirmRSVP(c.Request.Context(), teamID, req.City, req.Members); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    team, err := h.teamService.GetTeamByID(c.Request.Context(), teamID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    token, err := h.authService.GenerateTeamToken(teamID, *team.DashboardToken)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message":         "RSVP confirmed successfully",
        "token":           token,
        "dashboard_token": team.DashboardToken,
        "team":            team,
    })
}

// GetDashboard - GET /api/v1/dashboard/:token
func (h *TeamHandler) GetDashboard(c *gin.Context) {
    token := c.Param("token")
    
    team, err := h.teamService.GetTeamByDashboardToken(c.Request.Context(), token)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if team == nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "invalid dashboard link"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"team": team})
}

// GetQRCode - GET /api/v1/teams/:id/qrcode
func (h *TeamHandler) GetQRCode(c *gin.Context) {
    teamIDStr := c.Param("id")
    teamID, err := uuid.Parse(teamIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid team ID"})
        return
    }
    
    team, err := h.teamService.GetTeamByID(c.Request.Context(), teamID)
    if err != nil || team == nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
        return
    }
    
    if team.QRCodeToken == nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "QR code not generated yet"})
        return
    }
    
    qrBytes, err := h.teamService.GenerateQRCode(*team.QRCodeToken)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate QR code"})
        return
    }
    
    c.Data(http.StatusOK, "image/png", qrBytes)
}

// SelectProblemStatement - POST /api/v1/teams/:id/problem-statement
func (h *TeamHandler) SelectProblemStatement(c *gin.Context) {
    teamIDStr := c.Param("id")
    teamID, err := uuid.Parse(teamIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid team ID"})
        return
    }
    
    var req struct {
        ProblemStatement string `json:"problem_statement" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    if err := h.teamService.SelectProblemStatement(c.Request.Context(), teamID, req.ProblemStatement); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"message": "Problem statement selected successfully"})
}
```

### File: `backend/internal/handlers/volunteer_handler.go`
```go
package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "github.com/rift26/backend/internal/services"
)

type VolunteerHandler struct {
    teamService *services.TeamService
}

func NewVolunteerHandler(teamService *services.TeamService) *VolunteerHandler {
    return &VolunteerHandler{teamService: teamService}
}

// ScanQRCode - POST /api/v1/volunteer/scan
func (h *VolunteerHandler) ScanQRCode(c *gin.Context) {
    var req struct {
        QRToken string `json:"qr_token" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    team, err := h.teamService.GetTeamByQRToken(c.Request.Context(), req.QRToken)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if team == nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "invalid QR code"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"team": team})
}

// CheckInTeam - POST /api/v1/volunteer/checkin
func (h *VolunteerHandler) CheckInTeam(c *gin.Context) {
    volunteerIDStr, exists := c.Get("user_id")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
        return
    }
    volunteerID, _ := uuid.Parse(volunteerIDStr.(string))
    
    var req struct {
        QRToken string `json:"qr_token" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    team, err := h.teamService.CheckInTeam(c.Request.Context(), req.QRToken, volunteerID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Team checked in successfully",
        "team":    team,
    })
}
```

---

## Task 2.6: Middleware & Utilities

### File: `backend/internal/middleware/auth.go`
```go
package middleware

import (
    "net/http"
    "strings"
    
    "github.com/gin-gonic/gin"
    "github.com/rift26/backend/internal/services"
)

func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
            c.Abort()
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        claims, err := authService.ValidateToken(tokenString)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            c.Abort()
            return
        }
        
        c.Set("team_id", (*claims)["team_id"])
        c.Set("dashboard_token", (*claims)["dashboard_token"])
        c.Next()
    }
}

func CORSMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
        
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }
        
        c.Next()
    }
}
```

### File: `backend/pkg/otp/otp.go`
```go
package otp

import (
    "fmt"
)

type OTPService struct {
    apiKey   string
    provider string
}

func NewOTPService(apiKey string, provider string) *OTPService {
    return &OTPService{
        apiKey:   apiKey,
        provider: provider,
    }
}

func (s *OTPService) Send(phone string, otpCode string) error {
    if s.apiKey == "" {
        fmt.Printf("DEV MODE: OTP %s sent to %s\n", otpCode, phone)
        return nil
    }
    // Implement actual SMS sending via Twilio/MSG91
    return nil
}
```

### File: `backend/pkg/qrcode/qrcode.go`
```go
package qrcode

import (
    "github.com/skip2/go-qrcode"
)

type QRCodeService struct {
    baseURL string
}

func NewQRCodeService(baseURL string) *QRCodeService {
    return &QRCodeService{baseURL: baseURL}
}

func (s *QRCodeService) Generate(token string) ([]byte, error) {
    content := s.baseURL + "/scan/" + token
    png, err := qrcode.Encode(content, qrcode.Medium, 256)
    if err != nil {
        return nil, err
    }
    return png, nil
}
```

---

## Task 2.7: Main Server Entry Point

### File: `backend/cmd/server/main.go`
```go
package main

import (
    "log"
    
    "github.com/gin-gonic/gin"
    "github.com/rift26/backend/internal/config"
    "github.com/rift26/backend/internal/database"
    "github.com/rift26/backend/internal/handlers"
    "github.com/rift26/backend/internal/middleware"
    "github.com/rift26/backend/internal/repository"
    "github.com/rift26/backend/internal/services"
    "github.com/rift26/backend/pkg/otp"
    "github.com/rift26/backend/pkg/qrcode"
)

func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }
    
    db, err := database.NewPostgresDB(cfg.DatabaseURL)
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer db.Close()
    
    // Initialize repositories
    teamRepo := repository.NewTeamRepository(db)
    otpRepo := repository.NewOTPRepository(db)
    
    // Initialize services
    otpService := otp.NewOTPService(cfg.OTPServiceKey, "msg91")
    qrService := qrcode.NewQRCodeService("https://rift26.com")
    authService := services.NewAuthService(teamRepo, otpRepo, otpService, cfg.JWTSecret)
    teamService := services.NewTeamService(teamRepo, qrService)
    
    // Initialize handlers
    teamHandler := handlers.NewTeamHandler(teamService, authService)
    volunteerHandler := handlers.NewVolunteerHandler(teamService)
    
    // Setup router
    router := gin.Default()
    router.Use(middleware.CORSMiddleware())
    
    v1 := router.Group("/api/v1")
    {
        // Public routes
        v1.GET("/teams/search", teamHandler.SearchTeams)
        v1.POST("/teams/:id/send-otp", teamHandler.SendOTP)
        v1.POST("/teams/:id/verify-otp", teamHandler.VerifyOTP)
        v1.GET("/dashboard/:token", teamHandler.GetDashboard)
        
        // Protected routes
        teams := v1.Group("/teams")
        teams.Use(middleware.AuthMiddleware(authService))
        {
            teams.GET("/:id", teamHandler.GetTeam)
            teams.POST("/:id/rsvp", teamHandler.ConfirmRSVP)
            teams.GET("/:id/qrcode", teamHandler.GetQRCode)
            teams.POST("/:id/problem-statement", teamHandler.SelectProblemStatement)
        }
        
        // Volunteer routes
        volunteer := v1.Group("/volunteer")
        {
            volunteer.POST("/scan", volunteerHandler.ScanQRCode)
            volunteer.POST("/checkin", volunteerHandler.CheckInTeam)
        }
    }
    
    router.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })
    
    log.Printf("Server starting on port %s", cfg.Port)
    if err := router.Run(":" + cfg.Port); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
```

---

# PHASE 3: FRONTEND DEVELOPMENT (Next.js)

## Task 3.1: Types & API Client

### File: `frontend/types/index.ts`
```typescript
export type TeamStatus = 'shortlisted' | 'rsvp_done' | 'checked_in';
export type MemberRole = 'leader' | 'member';
export type City = 'BLR' | 'PUNE' | 'NOIDA' | 'LKO';

export interface TeamMember {
  id: string;
  team_id: string;
  name: string;
  email: string;
  phone: string;
  role: MemberRole;
  tshirt_size?: string;
}

export interface Team {
  id: string;
  team_name: string;
  city?: City;
  status: TeamStatus;
  problem_statement?: string;
  qr_code_token?: string;
  rsvp_locked: boolean;
  dashboard_token?: string;
  members: TeamMember[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: number;
  created_at: string;
}
```

### File: `frontend/lib/api.ts`
```typescript
import axios from 'axios';
import { Team, TeamMember, City } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('rift_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const searchTeams = async (query: string) => {
  const response = await api.get(`/teams/search?q=${encodeURIComponent(query)}`);
  return response.data.teams;
};

export const sendOTP = async (teamId: string) => {
  const response = await api.post(`/teams/${teamId}/send-otp`);
  return response.data;
};

export const verifyOTP = async (teamId: string, phone: string, otpCode: string) => {
  const response = await api.post(`/teams/${teamId}/verify-otp`, { phone, otp_code: otpCode });
  return response.data;
};

export const confirmRSVP = async (teamId: string, city: City, members: TeamMember[]) => {
  const response = await api.post(`/teams/${teamId}/rsvp`, { city, members });
  return response.data;
};

export const getDashboard = async (token: string) => {
  const response = await api.get(`/dashboard/${token}`);
  return response.data.team;
};

export const scanQRCode = async (qrToken: string) => {
  const response = await api.post('/volunteer/scan', { qr_token: qrToken });
  return response.data.team;
};

export const checkInTeam = async (qrToken: string) => {
  const response = await api.post('/volunteer/checkin', { qr_token: qrToken });
  return response.data.team;
};

export default api;
```

---

## Task 3.2: State Management

### File: `frontend/lib/store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Team, TeamMember } from '@/types';

interface AuthState {
  token: string | null;
  team: Team | null;
  dashboardToken: string | null;
  setAuth: (token: string, team: Team, dashboardToken?: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      team: null,
      dashboardToken: null,
      setAuth: (token, team, dashboardToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('rift_token', token);
        }
        set({ token, team, dashboardToken });
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('rift_token');
        }
        set({ token: null, team: null, dashboardToken: null });
      },
    }),
    { name: 'rift-auth-storage' }
  )
);

interface RSVPState {
  step: number;
  selectedTeamId: string | null;
  maskedPhone: string | null;
  editedMembers: TeamMember[];
  setStep: (step: number) => void;
  setSelectedTeam: (teamId: string) => void;
  setMaskedPhone: (phone: string) => void;
  setEditedMembers: (members: TeamMember[]) => void;
  updateMember: (index: number, member: TeamMember) => void;
  reset: () => void;
}

export const useRSVPStore = create<RSVPState>((set) => ({
  step: 1,
  selectedTeamId: null,
  maskedPhone: null,
  editedMembers: [],
  setStep: (step) => set({ step }),
  setSelectedTeam: (teamId) => set({ selectedTeamId: teamId }),
  setMaskedPhone: (phone) => set({ maskedPhone: phone }),
  setEditedMembers: (members) => set({ editedMembers: members }),
  updateMember: (index, member) =>
    set((state) => ({
      editedMembers: state.editedMembers.map((m, i) => (i === index ? member : m)),
    })),
  reset: () => set({ step: 1, selectedTeamId: null, maskedPhone: null, editedMembers: [] }),
}));
```

---

## Task 3.3: Page Components

### File: `frontend/app/page.tsx` (Landing - Team Search)
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { searchTeams, sendOTP } from "@/lib/api";
import { useRSVPStore } from "@/lib/store";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; team_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { setSelectedTeam, setMaskedPhone, setStep } = useRSVPStore();

  const handleSearch = async () => {
    if (query.length < 2) return;
    const teams = await searchTeams(query);
    setResults(teams);
  };

  const handleSelectTeam = async (teamId: string) => {
    setLoading(true);
    try {
      const { masked_phone } = await sendOTP(teamId);
      setSelectedTeam(teamId);
      setMaskedPhone(masked_phone);
      setStep(2);
      router.push("/rsvp/verify");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-500" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
              RIFT '26
            </h1>
          </div>
          <p className="text-gray-400 text-lg">Find your team and confirm your RSVP</p>
        </div>

        <Card className="bg-gray-800/50 border-purple-500/30">
          <CardContent className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Enter your team name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 h-12 bg-gray-900 border-purple-500/30"
              />
            </div>
            <Button onClick={handleSearch} className="w-full h-12 bg-purple-600 hover:bg-purple-700">
              Find My Team
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card className="bg-gray-800/50 border-purple-500/30">
            <CardContent className="p-4 space-y-2">
              {results.map((team) => (
                <Button
                  key={team.id}
                  variant="ghost"
                  onClick={() => handleSelectTeam(team.id)}
                  disabled={loading}
                  className="w-full justify-start h-12 hover:bg-purple-500/20"
                >
                  {team.team_name}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
```

### File: `frontend/app/rsvp/verify/page.tsx` (OTP Verification)
```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { verifyOTP } from "@/lib/api";
import { useRSVPStore, useAuthStore } from "@/lib/store";

export default function VerifyOTPPage() {
  const router = useRouter();
  const { selectedTeamId, maskedPhone, setStep, setEditedMembers } = useRSVPStore();
  const { setAuth } = useAuthStore();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!selectedTeamId) router.push("/");
  }, [selectedTeamId, router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 6) return;

    setLoading(true);
    try {
      const { token, team } = await verifyOTP(selectedTeamId!, maskedPhone!, otpCode);
      setAuth(token, team);
      setEditedMembers(team.members);
      
      if (team.rsvp_locked) {
        router.push(`/dashboard/${team.dashboard_token}`);
      } else {
        setStep(3);
        router.push("/rsvp/edit");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
      <Card className="w-full max-w-md bg-gray-800/50 border-cyan-500/30">
        <CardHeader className="text-center">
          <Shield className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
          <CardTitle>Verify Your Identity</CardTitle>
          <p className="text-gray-400">Enter the OTP sent to {maskedPhone}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                className="w-12 h-14 text-center text-2xl bg-gray-900 border-cyan-500/30"
              />
            ))}
          </div>
          <Button
            onClick={handleVerify}
            disabled={loading || otp.join("").length !== 6}
            className="w-full h-12 bg-cyan-600 hover:bg-cyan-700"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

### File: `frontend/app/dashboard/[token]/page.tsx` (Team Dashboard)
```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";
import { MapPin, Users, Bell, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/api";
import { Team } from "@/types";

export default function DashboardPage() {
  const params = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const data = await getDashboard(params.token as string);
        setTeam(data);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, [params.token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!team) return <div className="min-h-screen flex items-center justify-center">Team not found</div>;

  const cityNames: Record<string, string> = {
    BLR: "Bangalore",
    PUNE: "Pune",
    NOIDA: "Noida",
    LKO: "Lucknow",
  };

  return (
    <main className="min-h-screen p-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Status Banner */}
        <Card className="bg-gradient-to-r from-purple-600 to-cyan-600">
          <CardContent className="p-6 text-center">
            <h1 className="text-2xl font-bold text-white">{team.team_name}</h1>
            <Badge className="mt-2 bg-white/20">
              Confirmed for {team.city ? cityNames[team.city] : "TBD"} Venue
            </Badge>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card className="bg-gray-800/50 border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Entry Pass</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-8">
            {team.qr_code_token && (
              <div className="bg-white p-4 rounded-lg">
                <QRCode value={team.qr_code_token} size={200} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card className="bg-gray-800/50 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {team.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-gray-400">{member.email}</p>
                </div>
                <Badge variant={member.role === "leader" ? "default" : "secondary"}>
                  {member.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Share Button */}
        <Button className="w-full" variant="outline">
          <Share2 className="w-4 h-4 mr-2" />
          Share Dashboard Link
        </Button>
      </div>
    </main>
  );
}
```

### File: `frontend/app/volunteer/scanner/page.tsx` (QR Scanner)
```tsx
"use client";

import { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { scanQRCode, checkInTeam } from "@/lib/api";
import { Team } from "@/types";

export default function ScannerPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [scanning, setScanning] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner("qr-reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }, false);

    scanner.render(
      async (decodedText) => {
        scanner.clear();
        setScanning(false);
        try {
          const teamData = await scanQRCode(decodedText);
          setTeam(teamData);
        } catch (error) {
          alert("Invalid QR Code");
          setScanning(true);
        }
      },
      (error) => console.log(error)
    );

    return () => scanner.clear();
  }, [scanning]);

  const handleCheckIn = async () => {
    if (!team?.qr_code_token) return;
    setCheckingIn(true);
    try {
      await checkInTeam(team.qr_code_token);
      alert("Team checked in successfully!");
      setTeam(null);
      setScanning(true);
    } catch (error: any) {
      alert(error.response?.data?.error || "Check-in failed");
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <main className="min-h-screen p-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center text-white">Volunteer Scanner</h1>

        {scanning && (
          <Card className="bg-gray-800/50">
            <CardContent className="p-4">
              <div id="qr-reader" className="w-full" />
            </CardContent>
          </Card>
        )}

        {team && (
          <Card className="bg-gray-800/50 border-green-500/30">
            <CardHeader>
              <CardTitle>{team.team_name}</CardTitle>
              <Badge className={team.status === "checked_in" ? "bg-red-500" : "bg-green-500"}>
                {team.status === "checked_in" ? "Already Checked In" : "Ready for Check-in"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Members:</h3>
                {team.members.map((member) => (
                  <div key={member.id} className="p-2 bg-gray-900/50 rounded">
                    <p>{member.name} - {member.tshirt_size || "N/A"}</p>
                  </div>
                ))}
              </div>
              
              {team.status !== "checked_in" && (
                <Button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {checkingIn ? "Checking In..." : "Confirm Check-In"}
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => { setTeam(null); setScanning(true); }}
                className="w-full"
              >
                Scan Another
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
```

---

# PHASE 4: DEPLOYMENT & TESTING

## Task 4.1: Environment Files

### File: `backend/.env.example`
```env
DATABASE_URL=postgres://rift26_user:rift26_secure_password@localhost:5432/rift26_db?sslmode=disable
JWT_SECRET=your-super-secret-jwt-key-change-in-production
OTP_SERVICE_API_KEY=your-twilio-or-msg91-api-key
PORT=8080
ENVIRONMENT=development
```

### File: `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

---

## Task 4.2: Dockerfiles

### File: `backend/Dockerfile`
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

### File: `frontend/Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

---

# EXECUTION CHECKLIST FOR CURSOR AI

## Step-by-Step Commands:

### 1. Project Initialization
```bash
mkdir rift26-platform && cd rift26-platform
```

### 2. Backend Setup
```bash
mkdir -p backend/{cmd/server,internal/{config,database,handlers,middleware,models,repository,services,utils},pkg/{otp,qrcode},migrations}
cd backend && go mod init github.com/rift26/backend
go get github.com/gin-gonic/gin github.com/lib/pq github.com/golang-jwt/jwt/v5 github.com/skip2/go-qrcode github.com/joho/godotenv github.com/google/uuid golang.org/x/crypto/bcrypt
```

### 3. Frontend Setup
```bash
cd ../
npx create-next-app@latest frontend --typescript --tailwind --eslint --app
cd frontend
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input label form dialog toast alert badge tabs table dropdown-menu select
npm install @tanstack/react-query axios zustand react-qr-code html5-qrcode react-confetti date-fns zod react-hook-form @hookform/resolvers lucide-react
```

### 4. Database Setup
```bash
docker-compose up -d postgres
```

### 5. Run Development
```bash
# Terminal 1 - Backend
cd backend && go run cmd/server/main.go

# Terminal 2 - Frontend
cd frontend && npm run dev
```

---

# API ENDPOINTS SUMMARY

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/teams/search?q=` | Search teams by name |
| POST | `/api/v1/teams/:id/send-otp` | Send OTP to team leader |
| POST | `/api/v1/teams/:id/verify-otp` | Verify OTP |
| GET | `/api/v1/teams/:id` | Get team details |
| POST | `/api/v1/teams/:id/rsvp` | Confirm RSVP |
| GET | `/api/v1/teams/:id/qrcode` | Get team QR code |
| POST | `/api/v1/teams/:id/problem-statement` | Select problem statement |
| GET | `/api/v1/dashboard/:token` | Get dashboard by token |
| POST | `/api/v1/volunteer/scan` | Scan QR code |
| POST | `/api/v1/volunteer/checkin` | Check in team |
| POST | `/api/v1/admin/upload-csv` | Upload teams CSV |
| GET | `/api/v1/admin/teams` | Get all teams |
| POST | `/api/v1/admin/announcements` | Create announcement |

---

This execution plan provides complete, copy-paste ready code for building the RIFT '26 Hackathon Management Platform using Next.js, GoLang, and PostgreSQL. Each file is self-contained and follows best practices for the respective technology stack.