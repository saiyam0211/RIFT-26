package main

import (
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rift26/backend/internal/config"
	"github.com/rift26/backend/internal/database"
	"github.com/rift26/backend/internal/handlers"
	"github.com/rift26/backend/internal/middleware"
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

	// Initialize services
	teamService := services.NewTeamService(teamRepo, announcementRepo)
	checkinService := services.NewCheckinService(teamRepo)
	emailOTPService := services.NewEmailOTPService(otpRepo, teamRepo, emailService, cfg.JWTSecret, cfg.EnableEmailOTP)
	ticketService := services.NewTicketService(db.DB, emailService)
	announcementService := services.NewAnnouncementService(db.DB)
	volunteerService := services.NewVolunteerService(volunteerRepo)
	eventTableService := services.NewEventTableService(eventTableRepo)

	// Initialize participant check-in repository
	participantCheckinRepo := repository.NewParticipantCheckInRepository(db.DB)

	// GORM for seat allocation (Bengaluru blocks/rooms/seats)
	gormDB, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect GORM for seat allocation: %v", err)
	}
	seatAllocationService := services.NewSeatAllocationService(gormDB)

	// Initialize handlers
	teamHandler := handlers.NewTeamHandler(teamService, cfg.JWTSecret, cfg.AllowCityChange, seatAllocationService)
	emailOTPHandler := handlers.NewEmailOTPHandler(emailOTPService, cfg.EnableEmailOTP)
	scannerHandler := handlers.NewVolunteerHandler(checkinService, participantCheckinRepo, teamRepo, volunteerRepo, seatAllocationService)
	seatAllocatorHandler := handlers.NewSeatAllocatorHandler(gormDB)
	volunteerAuthHandler := handlers.NewVolunteerAuthHandler(volunteerService)                                      // Volunteer auth handler
	adminHandler := handlers.NewAdminHandler(teamRepo, announcementRepo, teamService, userRepo, cfg.JWTSecret)
	rsvpPinHandler := handlers.NewRSVPPinHandler(cfg.RSVPPinSecret, cfg.RSVPOpen)
	ticketHandler := handlers.NewTicketHandler(ticketService)
	announcementHandler := handlers.NewAnnouncementHandler(announcementService)
	bulkEmailHandler := handlers.NewBulkEmailHandler(db.DB, emailService, announcementService)
	eventTableHandler := handlers.NewEventTableHandler(eventTableService)

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
			c.JSON(200, gin.H{
				"otp_enabled":         cfg.EnableEmailOTP,
				"city_change_enabled": cfg.AllowCityChange,
				"rsvp_open":           rsvpOpen,
			})
		})

		// Team routes (public search, public dashboard)
		teams := v1.Group("/teams")
		{
			teams.GET("/search", teamHandler.SearchTeams)
			teams.GET("/:id", middleware.AuthMiddleware(cfg.JWTSecret), teamHandler.GetTeam)
			teams.PUT("/:id/rsvp", middleware.AuthMiddleware(cfg.JWTSecret), teamHandler.SubmitRSVP)
			teams.PUT("/:id/rsvp2", middleware.AuthMiddleware(cfg.JWTSecret), teamHandler.SubmitRSVP2)
			// Team announcements (filtered by team) - must come after specific routes
			teams.GET("/:id/announcements", announcementHandler.GetTeamAnnouncements)
		}

		// Dashboard route (public via token)
		v1.GET("/dashboard/:token", teamHandler.GetDashboard)

		// Ticket creation (public, but requires team info)
		v1.POST("/tickets", ticketHandler.CreateTicket)

		// Auth routes (email OTP + RSVP PIN)
		authRoutes := v1.Group("/auth")
		{
			authRoutes.POST("/send-email-otp", middleware.RateLimitMiddleware(5, 1*time.Minute), emailOTPHandler.SendEmailOTP)
			authRoutes.POST("/verify-email-otp", middleware.RateLimitMiddleware(5, 1*time.Minute), emailOTPHandler.VerifyEmailOTP)
			authRoutes.POST("/validate-rsvp-pin", middleware.RateLimitMiddleware(10, 1*time.Minute), rsvpPinHandler.ValidatePIN)
		}

		// Volunteer login (public)
		v1.POST("/volunteer/login", volunteerAuthHandler.Login)

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

		// Table viewer routes (protected)
		tableRoutes := v1.Group("/table")
		tableRoutes.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		tableRoutes.Use(middleware.RoleMiddleware("volunteer", "admin"))
		{
			tableRoutes.POST("/confirm", scannerHandler.ConfirmTable)       // Mark team as done
			tableRoutes.POST("/allocate-seat", scannerHandler.AllocateSeat) // Allocate Bengaluru seat for team
			tableRoutes.GET("/pending", scannerHandler.GetPendingTeams)     // Get pending teams
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
