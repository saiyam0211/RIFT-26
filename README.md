# RIFT '26 Hackathon Management Platform

A comprehensive web application for managing the end-to-end lifecycle of hackathon participants, from RSVP to event-day check-in and project submission.

## Overview

RIFT '26 is a full-stack hackathon management platform that handles:
- Team search and RSVP management
- Email OTP authentication
- Dynamic team member editing
- Multi-city event support (Bangalore, Pune, Noida, Lucknow)
- Team dashboard with QR codes
- Admin panel for team management
- Volunteer QR scanner for check-ins

## Tech Stack

### Frontend
- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Custom components with Tailwind
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **QR Codes**: react-qr-code

### Backend
- **Language**: Go 1.21+
- **Framework**: Gin
- **Database**: PostgreSQL 16
- **ORM**: GORM
- **Authentication**: JWT tokens
- **Email Service**: SMTP (Gmail)
- **QR Code**: go-qrcode

### Infrastructure
- **Database**: PostgreSQL 16 with migrations
- **Deployment**: AWS (RDS, EC2, S3, CloudFront, Route 53)
- **Process Management**: PM2 (frontend), systemd (backend)
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)

## Prerequisites

- Node.js 20.9.0 or higher
- Go 1.21 or higher
- PostgreSQL 16
- pnpm package manager
- AWS account (for deployment)
- Domain name (optional)

## Project Structure

```
RIFT/
├── backend/                    # Go backend API
│   ├── cmd/
│   │   ├── api/               # Main API server
│   │   └── migrate/           # Database migrations
│   ├── internal/
│   │   ├── config/            # Configuration management
│   │   ├── database/          # Database connection
│   │   ├── handlers/          # HTTP request handlers
│   │   ├── middleware/        # Middleware (CORS, auth)
│   │   ├── models/            # Database models
│   │   ├── repository/        # Data access layer
│   │   └── services/          # Business logic
│   ├── pkg/
│   │   └── email/             # Email service
│   ├── migrations/            # SQL migration files
│   └── .env.example           # Environment variables template
│
├── frontend/                   # Next.js frontend
│   ├── app/
│   │   ├── page.tsx           # Homepage (team search)
│   │   ├── rsvp/[id]/        # RSVP flow
│   │   ├── dashboard/[token]/ # Team dashboard
│   │   ├── admin/             # Admin panel
│   │   └── volunteer/         # QR scanner
│   ├── components/            # React components
│   │   ├── RIFTBackground.tsx # WebGL background
│   │   └── CustomLoader.tsx   # Loading animation
│   ├── src/
│   │   ├── components/        # Additional components
│   │   └── types/             # TypeScript interfaces
│   ├── store/                 # Zustand stores
│   ├── types/                 # Type definitions
│   ├── public/                # Static assets
│   └── next.config.ts         # Next.js configuration
│
├── landing/                    # Static landing page
│   ├── index.html             # Homepage
│   ├── agenda/                # Event agenda
│   ├── contact/               # Contact page
│   ├── speakers/              # Speakers page
│   └── images/                # Image assets
│
├── AWS_DEPLOYMENT_GUIDE.md    # Complete AWS deployment guide
└── README.md                  # This file
```

## Local Development

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=rift_hackathon
DB_SSLMODE=disable

PORT=8080
GIN_MODE=debug

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

JWT_SECRET=your-secret-key-here
```

3. Install dependencies:
```bash
go mod download
```

4. Run migrations:
```bash
go run cmd/migrate/main.go
```

5. Start development server:
```bash
go run cmd/api/main.go
```

Backend will run on `http://localhost:8080`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

3. Install dependencies:
```bash
pnpm install
```

4. Start development server:
```bash
pnpm dev
```

Frontend will run on `http://localhost:3000/hackathon`

Note: The frontend uses `/hackathon` as the base path for deployment structure.

## Database Schema

### Tables

**teams**
- `id` (UUID, Primary Key)
- `team_name` (String, Unique)
- `city` (Enum: BLR, PUNE, NOIDA, LKO)
- `status` (Enum: shortlisted, rsvp_done, checked_in)
- `rsvp_locked` (Boolean)
- `dashboard_token` (UUID)
- `created_at`, `updated_at` (Timestamps)

**team_members**
- `id` (UUID, Primary Key)
- `team_id` (UUID, Foreign Key)
- `name` (String)
- `email` (String, Unique)
- `phone` (String, Unique)
- `role` (Enum: leader, member)
- `tshirt_size` (Enum: XS, S, M, L, XL, XXL, Optional)
- `individual_qr_token` (UUID)
- `created_at`, `updated_at` (Timestamps)

## API Documentation

### Authentication Endpoints

**POST** `/api/v1/auth/send-otp`
- Send OTP to team leader's email
- Request: `{ "team_id": "uuid", "email": "string" }`
- Response: `{ "message": "OTP sent successfully" }`

**POST** `/api/v1/auth/verify-otp`
- Verify OTP and get authentication token
- Request: `{ "team_id": "uuid", "email": "string", "otp": "string" }`
- Response: `{ "token": "jwt-token", "team": {...} }`

### Team Endpoints

**GET** `/api/v1/teams/search?query=string`
- Search teams by name
- Response: `{ "teams": [...] }`

**GET** `/api/v1/teams/:id`
- Get team details
- Requires authentication
- Response: `{ "team": {...}, "members": [...] }`

**PUT** `/api/v1/teams/:id/rsvp`
- Submit RSVP with city and members
- Requires authentication
- Request: `{ "city": "BLR", "members": [...] }`

### Dashboard Endpoints

**GET** `/api/v1/dashboard/:token`
- Get team dashboard data
- Response: `{ "team": {...}, "members": [...] }`

## User Flow

### RSVP Process

1. **Team Search**: Search for team by name on homepage
2. **Authentication**: Enter email and verify OTP
3. **Edit Question**: Choose to edit members or keep existing
4. **Edit Members** (if yes): Add/remove/edit team members
5. **City Selection**: Choose event city
6. **Review**: Review all information
7. **Submit**: Lock RSVP and receive dashboard link

### Dashboard Access

1. Click unique dashboard link from email
2. View team information
3. See QR codes for check-in
4. View team members

## Features

### Team Management
- Search teams by name with autocomplete
- View team details and member count
- RSVP lock mechanism to prevent changes after submission

### Member Management
- Dynamic member addition/removal
- Email and phone validation
- Leader designation (automatically set for first member)
- Optional t-shirt size collection

### Multi-City Support
- Bangalore (BLR)
- Pune (PUNE)
- Noida (NOIDA)
- Lucknow (LKO)

### Security
- Email OTP authentication
- JWT token-based API authentication
- RSVP lock to prevent modifications
- Unique dashboard tokens

### UI/UX
- Responsive design (mobile and desktop)
- WebGL animated background
- Custom loading animations
- Step-based RSVP flow
- Real-time form validation

## Deployment

See `AWS_DEPLOYMENT_GUIDE.md` for complete AWS deployment instructions including:

- RDS PostgreSQL database setup
- EC2 instances for backend and frontend
- S3 + CloudFront for landing page
- Route 53 DNS configuration
- SSL/HTTPS setup with Certificate Manager
- Monitoring and logging
- Deployment automation scripts

### Quick Deployment Summary

**Architecture:**
```
CloudFront → S3 (Landing Page)
Route 53 → Load Balancer → EC2 (Frontend) → EC2 (Backend) → RDS (Database)
```

**Estimated Cost:** $60-70/month with t3.small instances

## Configuration

### Frontend Base Path

The frontend is configured with `basePath: '/hackathon'` in `next.config.ts` to allow:
- Landing page at root `/`
- Hackathon app at `/hackathon`

This enables serving both static landing pages and the Next.js app from the same domain.

### Environment Variables

**Backend (.env)**
- Database connection settings
- SMTP configuration
- JWT secret
- Server configuration

**Frontend (.env.local)**
- API URL
- Public environment variables

## Build and Production

### Build Frontend
```bash
cd frontend
pnpm build
```

Produces optimized production build in `.next` folder.

### Build Backend
```bash
cd backend
go build -o rift-server cmd/api/main.go
```

Produces compiled binary `rift-server`.

### Run Production

**Frontend:**
```bash
pnpm start
```

**Backend:**
```bash
./rift-server
```

## Monitoring and Maintenance

### Check Application Status

**Frontend (PM2):**
```bash
pm2 status
pm2 logs rift-frontend
```

**Backend (systemd):**
```bash
sudo systemctl status rift-backend
journalctl -u rift-backend -f
```

### Database Backups

RDS automated backups are enabled with 7-day retention.
Manual backup:
```bash
pg_dump -h <rds-endpoint> -U riftadmin rift_hackathon > backup.sql
```

## Troubleshooting

### Font Loading Issues
- Font files are located in `frontend/app/fonts/`
- Referenced in `globals.css` with relative path
- Works with basePath configuration

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS settings in backend
- Ensure backend is running and accessible

### Database Connection Issues
- Verify database credentials in `.env`
- Check security group rules (AWS)
- Test connection with `psql` command

### Build Errors
- Node.js version must be 20.9.0 or higher
- Run `pnpm install` to ensure dependencies are current
- Clear `.next` folder and rebuild

## Performance Optimization

- WebGL background is optimized for smooth animations
- Next.js image optimization enabled
- Static assets cached via CloudFront CDN
- Database queries optimized with proper indexing
- GZIP compression enabled on Nginx

## Security Best Practices

- All passwords stored as hashed values
- JWT tokens expire after configured period
- HTTPS enforced in production
- CORS configured to allow only trusted origins
- Input validation on frontend and backend
- SQL injection prevention via parameterized queries
- Rate limiting on authentication endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions:
- Create an issue in the repository
- Contact: support@rift26.com

## License

MIT License

## Version History

**v1.0.0** (February 2026)
- Initial release
- Complete RSVP flow
- Dashboard functionality
- Multi-city support
- AWS deployment ready

---

**Built for RIFT '26**  
**Last Updated**: February 3, 2026
