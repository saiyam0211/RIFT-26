# RIFT '26 Hackathon Management Platform

A comprehensive web application for managing the end-to-end lifecycle of hackathon participants, from RSVP to event-day check-in and project submission.

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: GoLang (Gin framework)
- **Database**: PostgreSQL 16
- **Authentication**: JWT + OTP (Twilio/MSG91)
- **QR Code**: go-qrcode (backend) + react-qr-code (frontend)

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Go 1.21+ (for local backend development)
- PostgreSQL 16 (if running without Docker)

## 🛠️ Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd RIFT
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your configuration (database, JWT secret, OTP service keys)
```

### 3. Start with Docker Compose

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port `5432`
- Backend API on port `8080`
- Frontend on port `3000`

### 4. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Documentation**: http://localhost:8080/api/docs (Swagger)

## 📁 Project Structure

```
RIFT/
├── backend/                 # GoLang API
│   ├── cmd/server/         # Application entry point
│   ├── internal/           # Private application code
│   │   ├── config/        # Configuration management
│   │   ├── database/      # Database connection
│   │   ├── handlers/      # HTTP handlers
│   │   ├── middleware/    # Middleware (auth, CORS, etc.)
│   │   ├── models/        # Data models
│   │   ├── repository/    # Database layer
│   │   ├── services/      # Business logic
│   │   └── utils/         # Helpers
│   ├── pkg/               # Public packages
│   │   ├── otp/          # OTP service
│   │   └── qrcode/       # QR code generation
│   └── migrations/        # Database migrations
│
├── frontend/               # Next.js Application
│   ├── app/
│   │   ├── (auth)/        # Auth routes
│   │   ├── (participant)/ # Participant routes
│   │   ├── (volunteer)/   # Volunteer scanner
│   │   └── (admin)/       # Admin panel
│   ├── components/        # React components
│   ├── lib/              # Utilities
│   └── types/            # TypeScript definitions
│
└── docker-compose.yml     # Docker orchestration
```

## 🔧 Development Setup

### Backend Development

```bash
cd backend
go mod download
go run cmd/server/main.go
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## 📊 Database Setup

The database schema is automatically initialized when using Docker Compose. For manual setup:

```bash
psql -U rift26_user -d rift26_db -f backend/migrations/001_initial_schema.sql
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
go test -v ./...
go test -cover ./internal/services/...
```

### Frontend Tests

```bash
cd frontend
npm run test
npm run test:e2e
```

## 📦 Build for Production

### Backend

```bash
cd backend
docker build -t rift26-backend .
```

### Frontend

```bash
cd frontend
npm run build
docker build -t rift26-frontend .
```

## 🔐 Security Considerations

- Change `JWT_SECRET` in production to a cryptographically secure random string
- Use environment-specific OTP service credentials
- Enable HTTPS in production
- Configure CORS to allow only trusted origins
- Implement rate limiting on sensitive endpoints

## 📖 API Documentation

Key endpoints:

- `GET /api/v1/teams/search` - Search teams by name
- `POST /api/v1/auth/send-otp` - Send OTP for verification
- `POST /api/v1/auth/verify-otp` - Verify OTP and get JWT
- `PUT /api/v1/teams/{id}/rsvp` - Submit RSVP
- `GET /api/v1/dashboard/{token}` - Access team dashboard
- `POST /api/v1/checkin/scan` - Scan QR code (volunteer)

## 📅 Development Timeline

- **Phase 1**: Project Setup & Infrastructure (2 days)
- **Phase 2**: Backend Development (4 days)
- **Phase 3**: Frontend Development (3 days)
- **Phase 4**: Event-Day Features (2 days)
- **Phase 5**: Testing & QA (2 days)
- **Phase 6**: Deployment (1 day)

**Total**: 14 days

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## 📄 License

MIT License

## 👥 Team

RIFT '26 Development Team

## 📞 Support

For issues or questions, contact: [support@rift26.example.com]

---

**Version**: 1.0  
**Last Updated**: January 31, 2026
