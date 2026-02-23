package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rift26/backend/internal/config"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/handlers"
	"github.com/rift26/backend/internal/middleware"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/services"
	"github.com/rift26/backend/pkg/email"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Connect to PostgreSQL
	db, err := database.NewPostgresDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("✅ Connected to PostgreSQL")

	// Initialize Email Service
	emailService := email.NewEmailService(
		cfg.SMTPHost,
		cfg.SMTPPort,
		cfg.SMTPUsername,
		cfg.SMTPPassword,
		cfg.SMTPFromEmail,
		cfg.SMTPFromName,
	)
	log.Println("✅ Email service initialized")

	// Initialize repositories
	teamRepo := repository.NewTeamRepository(db)
	announcementRepo := repository.NewAnnouncementRepository(db)
	otpRepo := repository.NewOTPRepository(db)
	userRepo := repository.NewUserRepository(db)
	volunteerRepo := repository.NewVolunteerRepository(db)
	eventTableRepo := repository.NewEventTableRepository(db.DB)
	problemStatementRepo := repository.NewProblemStatementRepository(db)
	settingsRepo := repository.NewSettingsRepository(db)
	psSelectionRepo := repository.NewPSSelectionRepository(db)
	psSubmissionRepo := repository.NewPSSubmissionRepository(db)

	// Upload dir for problem statement PDFs
	uploadDir := filepath.Join(".", "uploads", "problem_statements")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("Warning: could not create upload dir %s: %v", uploadDir, err)
	}

	// Initialize services
	teamService := services.NewTeamService(teamRepo, announcementRepo)
	checkinService := services.NewCheckinService(teamRepo)
	emailOTPService := services.NewEmailOTPService(otpRepo, teamRepo, emailService, cfg.JWTSecret, cfg.EnableEmailOTP)
	ticketService := services.NewTicketService(db.DB, emailService)
	announcementService := services.NewAnnouncementService(db.DB)
	volunteerService := services.NewVolunteerService(volunteerRepo)
	eventTableService := services.NewEventTableService(eventTableRepo)
	registrationDeskAllocService := services.NewRegistrationDeskAllocationService(teamRepo, eventTableRepo)
	problemStatementService := services.NewProblemStatementService(problemStatementRepo, settingsRepo, cfg.APIPublicURL, uploadDir)
	psSelectionService := services.NewPSSelectionService(psSelectionRepo, teamRepo, problemStatementRepo, settingsRepo)
	psSubmissionService := services.NewPSSubmissionService(psSubmissionRepo, psSelectionRepo, teamRepo, problemStatementRepo, settingsRepo)

	// Initialize participant check-in repository
	participantCheckinRepo := repository.NewParticipantCheckInRepository(db.DB)
	volunteerAdminRepo := repository.NewVolunteerAdminRepository(db)
	// GORM for seat allocation (Bengaluru blocks/rooms/seats)
	gormDB, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect GORM for seat allocation: %v", err)
	}
	seatAllocationService := services.NewSeatAllocationService(gormDB)
	volunteerAdminService := services.NewVolunteerAdminService(volunteerAdminRepo)

	// Initialize handlers
	teamHandler := handlers.NewTeamHandler(teamService, cfg.JWTSecret, cfg.AllowCityChange, seatAllocationService, psSelectionService, problemStatementService)
	emailOTPHandler := handlers.NewEmailOTPHandler(emailOTPService, cfg.EnableEmailOTP)
	scannerHandler := handlers.NewVolunteerHandler(checkinService, participantCheckinRepo, teamRepo, volunteerRepo, seatAllocationService)
	seatAllocatorHandler := handlers.NewSeatAllocatorHandler(gormDB)
	volunteerAuthHandler := handlers.NewVolunteerAuthHandler(volunteerService)
	volunteerAdminHandler := handlers.NewVolunteerAdminHandler(volunteerAdminService, volunteerRepo, participantCheckinRepo, seatAllocationService, eventTableService, teamRepo, gormDB)
	adminHandler := handlers.NewAdminHandler(teamRepo, announcementRepo, teamService, userRepo, cfg.JWTSecret, registrationDeskAllocService, participantCheckinRepo)
	rsvpPinHandler := handlers.NewRSVPPinHandler(cfg.RSVPPinSecret, cfg.RSVPOpen)
	ticketHandler := handlers.NewTicketHandler(ticketService)
	announcementHandler := handlers.NewAnnouncementHandler(announcementService)
	bulkEmailHandler := handlers.NewBulkEmailHandler(db.DB, emailService, announcementService)
	eventTableHandler := handlers.NewEventTableHandler(eventTableService)
	problemStatementHandler := handlers.NewProblemStatementHandler(problemStatementService)
	checkPSHandler := handlers.NewCheckPSHandler(psSelectionService)
	psSubmissionHandler := handlers.NewPSSubmissionHandler(psSubmissionService)
	judgingHandler := handlers.NewJudgingHandler(psSubmissionRepo)

	// Setup Gin router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.Default()

	// Increase max multipart memory for file uploads (32MB)
	router.MaxMultipartMemory = 32 << 20

	// Global middleware
	router.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "healthy",
			"service": "RIFT '26 API",
			"version": "1.0.0",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Public routes
		v1.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "pong"})
		})

		// Feature flags endpoint
		v1.GET("/config", func(c *gin.Context) {
			rsvpOpen := cfg.RSVPOpen
			if rsvpOpen != "true" && rsvpOpen != "pin" {
				rsvpOpen = "false"
			}
			finalOpen := cfg.FinalOpen
			if finalOpen != "true" && finalOpen != "pin" {
				finalOpen = "false"
			}
			c.JSON(200, gin.H{
				"otp_enabled":         cfg.EnableEmailOTP,
				"city_change_enabled": cfg.AllowCityChange,
				"rsvp_open":           rsvpOpen,
				"final_open":          finalOpen,
			})
		})

		// Team routes (public search, public dashboard)
		teams := v1.Group("/teams")
		{
			teams.GET("/search", teamHandler.SearchTeams)
			teams.GET("/:id", middleware.AuthMiddleware(cfg.JWTSecret), teamHandler.GetTeam)
			teams.PUT("/:id/rsvp", middleware.AuthMiddleware(cfg.JWTSecret), teamHandler.SubmitRSVP)
			teams.PUT("/:id/rsvp2", middleware.AuthMiddleware(cfg.JWTSecret), teamHandler.SubmitRSVP2)
			// Lock PS is triggered from the public dashboard (no JWT), so do NOT wrap with AuthMiddleware.
			teams.POST("/:id/lock-ps", teamHandler.LockPS)
			// Final project submission portal (public from dashboard, backend enforces checked_in + locked PS)
			teams.GET("/:id/submission", psSubmissionHandler.GetTeamForm)
			teams.POST("/:id/submission", psSubmissionHandler.Submit)
			// Team announcements (filtered by team) - must come after specific routes
			teams.GET("/:id/announcements", announcementHandler.GetTeamAnnouncements)
		}

		// Dashboard route (public via token)
		v1.GET("/dashboard/:token", teamHandler.GetDashboard)

		// Problem statements (public; returns list only if released)
		v1.GET("/problem-statements", problemStatementHandler.GetPublic)
		// Serve uploaded PS PDFs (no auth; filename is UUID-based)
		v1.GET("/uploads/problem-statements/:filename", problemStatementHandler.ServePDF)
		// Check PS selections (public; shows checked_in teams and their PS choices)
		v1.GET("/checkps", checkPSHandler.GetPSSelections)
		// Judging: list all submissions with filters (city, problem_statement_id)
		v1.GET("/judging/submissions", judgingHandler.GetSubmissions)

		// Public room view (seating layout + allocations by city and room name) — no auth
		publicRoutes := v1.Group("/public")
		{
			publicRoutes.GET("/viewroom/:city/:roomname", seatAllocatorHandler.GetPublicRoomView)
		}

		// Ticket creation (public, but requires team info)
		v1.POST("/tickets", ticketHandler.CreateTicket)

		// Auth routes (email OTP + RSVP PIN)
		authRoutes := v1.Group("/auth")
		{
			authRoutes.POST("/send-email-otp", middleware.RateLimitMiddleware(5, 1*time.Minute), emailOTPHandler.SendEmailOTP)
			authRoutes.POST("/verify-email-otp", middleware.RateLimitMiddleware(5, 1*time.Minute), emailOTPHandler.VerifyEmailOTP)
			authRoutes.POST("/validate-rsvp-pin", middleware.RateLimitMiddleware(10, 1*time.Minute), rsvpPinHandler.ValidatePIN)
		}

		// Volunteer routes (public login + table list)
		v1.POST("/volunteer/login", volunteerAuthHandler.Login)
		// Volunteer Admin (city-scoped) — public login
		v1.POST("/volunteer-admin/login", volunteerAdminHandler.Login)
		v1.GET("/volunteer/tables", func(c *gin.Context) {
			// Public endpoint to get active tables for volunteer login selection
			isActive := true
			tables, err := eventTableRepo.GetAll(nil, &isActive)
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to fetch tables"})
				return
			}
			c.JSON(200, gin.H{"tables": tables})
		})

		// Volunteer routes (protected by volunteer auth)
		volunteerRoutes := v1.Group("/volunteer")
		volunteerRoutes.Use(middleware.VolunteerAuthMiddleware(volunteerService))
		{
			volunteerRoutes.GET("/verify", volunteerAuthHandler.VerifyToken)
		}

		// Check-in routes (protected - enhanced with participant selection)
		checkinRoutes := v1.Group("/checkin")
		checkinRoutes.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		checkinRoutes.Use(middleware.RoleMiddleware("volunteer", "admin"))
		{
			checkinRoutes.POST("/scan", scannerHandler.ScanQR)                      // Scan QR and get team details
			checkinRoutes.POST("/participants", scannerHandler.CheckInParticipants) // Check in selected participants
			checkinRoutes.GET("/history", scannerHandler.GetCheckInHistory)         // Get check-in history
			checkinRoutes.DELETE("/:team_id", scannerHandler.UndoCheckIn)           // Undo a check-in
		}

		// Table routes (protected) - renamed but kept for backward compatibility
		// These are now used by scanner page for pending teams and actions
		tableRoutes := v1.Group("/table")
		tableRoutes.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		tableRoutes.Use(middleware.RoleMiddleware("volunteer", "admin"))
		{
			tableRoutes.POST("/confirm", scannerHandler.ConfirmTable)       // Mark team as done
			tableRoutes.POST("/allocate-seat", scannerHandler.AllocateSeat) // Allocate Bengaluru seat for team
			tableRoutes.GET("/pending", scannerHandler.GetPendingTeams)     // Get pending teams checked in by volunteer
		}

		// Volunteer Admin dashboard (protected — role volunteer_admin, city from JWT)
		volunteerAdminRoutes := v1.Group("/volunteer-admin")
		volunteerAdminRoutes.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		volunteerAdminRoutes.Use(middleware.RoleMiddleware(models.UserRoleVolunteerAdmin))
		{
			volunteerAdminRoutes.GET("/volunteers", volunteerAdminHandler.GetVolunteers)
			volunteerAdminRoutes.GET("/check-ins", volunteerAdminHandler.GetCheckIns)
			volunteerAdminRoutes.GET("/check-in-teams", volunteerAdminHandler.GetCheckInTeams)
			volunteerAdminRoutes.GET("/tables", volunteerAdminHandler.GetTables)
			volunteerAdminRoutes.GET("/teams/:team_id", volunteerAdminHandler.GetTeamDetails)
			volunteerAdminRoutes.GET("/seat-summary", volunteerAdminHandler.GetSeatSummary)
		}

		// Admin login (public)
		v1.POST("/admin/login", adminHandler.AdminLogin)

		// Admin routes (protected)
		adminRoutes := v1.Group("/admin")
		adminRoutes.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		adminRoutes.Use(middleware.RoleMiddleware("admin"))
		{
			// Teams
			adminRoutes.POST("/teams/create", adminHandler.CreateTeamManually)
			adminRoutes.POST("/teams/bulk-upload", adminHandler.BulkUploadTeams)
			adminRoutes.GET("/teams", adminHandler.GetAllTeams)
			adminRoutes.DELETE("/data/clear", adminHandler.ClearAllData)

			// Tickets Management
			adminRoutes.GET("/tickets", ticketHandler.GetAllTickets)
			adminRoutes.GET("/tickets/:id", ticketHandler.GetTicket)
			adminRoutes.POST("/tickets/:id/resolve", ticketHandler.ResolveTicket)
			adminRoutes.PATCH("/tickets/:id/status", ticketHandler.UpdateTicketStatus)

			// Announcements Management
			adminRoutes.POST("/announcements", announcementHandler.CreateAnnouncement)
			adminRoutes.GET("/announcements", announcementHandler.GetAllAnnouncements)
			adminRoutes.DELETE("/announcements/:id", announcementHandler.DeleteAnnouncement)

			// Bulk Email
			adminRoutes.POST("/send-bulk-email", bulkEmailHandler.SendBulkEmail)
			adminRoutes.GET("/email-logs", bulkEmailHandler.GetEmailLogs)

			// Stats
			adminRoutes.GET("/stats/checkin", adminHandler.GetCheckInStats)
			adminRoutes.DELETE("/checkin/:team_id", adminHandler.UndoCheckIn)
			adminRoutes.DELETE("/checkin/:team_id/member/:member_id", adminHandler.UndoCheckInMember)

			// Semi-finalists (PS selections)
			adminRoutes.GET("/semi-finalists", checkPSHandler.GetSemiFinalists)
			adminRoutes.POST("/semi-finalists/:team_id", checkPSHandler.MarkSemiFinalist)
			adminRoutes.DELETE("/semi-finalists/:team_id", checkPSHandler.UnmarkSemiFinalist)
			adminRoutes.POST("/semi-finalists/:team_id/awards", checkPSHandler.SetAwards)

			// RSVP PIN (when RSVP_OPEN=pin)
			adminRoutes.GET("/rsvp-pin", rsvpPinHandler.GetRSVPPin)

			// Volunteer Management
			adminRoutes.POST("/volunteers", volunteerAuthHandler.CreateVolunteer)
			adminRoutes.GET("/volunteers", volunteerAuthHandler.GetAllVolunteers)
			adminRoutes.GET("/volunteers/:id", volunteerAuthHandler.GetVolunteerByID)
			adminRoutes.GET("/volunteers/:id/logs", scannerHandler.GetVolunteerLogs)
			adminRoutes.PUT("/volunteers/:id", volunteerAuthHandler.UpdateVolunteer)
			adminRoutes.DELETE("/volunteers/:id", volunteerAuthHandler.DeleteVolunteer)

			// Event Table Management
			adminRoutes.POST("/registration-desks/allocate", adminHandler.AllocateRegistrationDesks)
			adminRoutes.POST("/registration-desks/clear", adminHandler.ClearAllRegistrationDesks)
			adminRoutes.GET("/problem-statements", problemStatementHandler.ListAdmin)
			adminRoutes.POST("/problem-statements", problemStatementHandler.CreateAdmin)
			adminRoutes.DELETE("/problem-statements/:id", problemStatementHandler.DeleteAdmin)
			adminRoutes.POST("/problem-statements/release-early", problemStatementHandler.ReleaseEarly)
			adminRoutes.POST("/problem-statements/reset-release", problemStatementHandler.ResetRelease)
			adminRoutes.GET("/problem-statements/submission-status", problemStatementHandler.GetSubmissionStatus)
			adminRoutes.POST("/problem-statements/toggle-submission", problemStatementHandler.ToggleSubmissionWindow)
			adminRoutes.GET("/problem-statements/final-submission-status", problemStatementHandler.GetFinalSubmissionStatus)
			adminRoutes.POST("/problem-statements/toggle-final-submission", problemStatementHandler.ToggleFinalSubmissionPortal)
			adminRoutes.POST("/tables", eventTableHandler.CreateEventTable)
			adminRoutes.GET("/tables", eventTableHandler.GetAllEventTables)
			adminRoutes.GET("/tables/:id", eventTableHandler.GetEventTable)
			adminRoutes.PUT("/tables/:id", eventTableHandler.UpdateEventTable)
			adminRoutes.DELETE("/tables/:id", eventTableHandler.DeleteEventTable)

			// Seat Allocation (Bengaluru) - blocks, rooms, seats
			adminRoutes.GET("/seat-allocation/blocks", seatAllocatorHandler.GetAllBlocks)
			adminRoutes.POST("/seat-allocation/blocks", seatAllocatorHandler.CreateBlock)
			adminRoutes.PUT("/seat-allocation/blocks/:id", seatAllocatorHandler.UpdateBlock)
			adminRoutes.DELETE("/seat-allocation/blocks/:id", seatAllocatorHandler.DeleteBlock)
			adminRoutes.GET("/seat-allocation/rooms", seatAllocatorHandler.GetRoomsByBlock)
			adminRoutes.POST("/seat-allocation/rooms", seatAllocatorHandler.CreateRoom)
			adminRoutes.POST("/seat-allocation/seats/grid", seatAllocatorHandler.CreateSeatsGrid)
			adminRoutes.POST("/seat-allocation/seats/layout", seatAllocatorHandler.CreateSeatsLayout)
			adminRoutes.GET("/seat-allocation/rooms/:room_id/layout", seatAllocatorHandler.GetRoomLayout)
			adminRoutes.GET("/seat-allocation/rooms/:room_id/room-view", seatAllocatorHandler.GetRoomView)
			adminRoutes.GET("/seat-allocation/rooms/:room_id/seats", seatAllocatorHandler.GetSeatsByRoom)
			adminRoutes.PUT("/seat-allocation/seats/mark-team-size", seatAllocatorHandler.MarkSeatsForTeamSize)
			adminRoutes.GET("/seat-allocation/allocations", seatAllocatorHandler.GetAllAllocations)
			adminRoutes.GET("/seat-allocation/stats", seatAllocatorHandler.GetAllocationStats)

			// Volunteer Admins (create/list/delete city-scoped volunteer admins)
			adminRoutes.POST("/volunteer-admins", volunteerAdminHandler.CreateVolunteerAdmin)
			adminRoutes.GET("/volunteer-admins", volunteerAdminHandler.GetAllVolunteerAdmins)
			adminRoutes.DELETE("/volunteer-admins/:id", volunteerAdminHandler.DeleteVolunteerAdmin)
		}
	}

	// Start server
	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 Server starting on %s", serverAddr)
	log.Printf("📋 Environment: %s", cfg.Environment)
	log.Printf("🔐 CORS allowed origins: %s", cfg.AllowedOrigins)
	log.Println("📡 API Endpoints:")
	log.Println("   GET  /health")
	log.Println("   GET  /api/v1/teams/search")
	log.Println("   GET  /api/v1/teams/:id (auth)")
	log.Println("   PUT  /api/v1/teams/:id/rsvp (auth)")
	log.Println("   GET  /api/v1/teams/:id/announcements")
	log.Println("   GET  /api/v1/dashboard/:token")
	log.Println("   POST /api/v1/tickets")
	log.Println("   POST /api/v1/auth/send-email-otp")
	log.Println("   POST /api/v1/auth/verify-email-otp")
	log.Println("   POST /api/v1/checkin/scan (volunteer)")
	log.Println("   POST /api/v1/checkin/confirm (volunteer)")
	log.Println("   POST /api/v1/admin/teams/bulk-upload (admin)")
	log.Println("   GET  /api/v1/admin/teams (admin)")
	log.Println("   GET  /api/v1/admin/tickets (admin)")
	log.Println("   POST /api/v1/admin/tickets/:id/resolve (admin)")
	log.Println("   POST /api/v1/admin/announcements (admin)")
	log.Println("   GET  /api/v1/admin/announcements (admin)")
	log.Println("   DELETE /api/v1/admin/announcements/:id (admin)")
	log.Println("   POST /api/v1/admin/send-bulk-email (admin)")
	log.Println("   GET  /api/v1/admin/email-logs (admin)")
	log.Println("   GET  /api/v1/admin/stats/checkin (admin)")

	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
