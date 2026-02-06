package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	Port           string
	Environment    string
	AllowedOrigins string
	// Feature Flags
	EnableEmailOTP  bool // Set to false to skip OTP and use email-only auth
	AllowCityChange bool // Set to false to prevent teams from changing their city during RSVP
	RSVPOpen        bool // Set to false to close RSVP window
	// SMTP Email Configuration
	SMTPHost      string
	SMTPPort      string
	SMTPUsername  string
	SMTPPassword  string
	SMTPFromEmail string
	SMTPFromName  string
}

func Load() (*Config, error) {
	// Load .env file if it exists (ignore error in production)
	_ = godotenv.Load()

	return &Config{
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://rift26_user:rift26_secure_password@localhost:5432/rift26_db?sslmode=disable"),
		JWTSecret:      getEnv("JWT_SECRET", "default-secret-change-me"),
		Port:           getEnv("PORT", "8080"),
		Environment:    getEnv("ENVIRONMENT", "development"),
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
		// Feature Flags
		EnableEmailOTP:  getEnv("ENABLE_EMAIL_OTP", "false") == "true",
		AllowCityChange: getEnv("ALLOW_CITY_CHANGE", "false") == "true",
		RSVPOpen:        getEnv("RSVP_OPEN", "false") == "true",
		// SMTP Configuration
		SMTPHost:      getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:      getEnv("SMTP_PORT", "587"),
		SMTPUsername:  getEnv("SMTP_USERNAME", "rift_support@pwioi.com"),
		SMTPPassword:  getEnv("SMTP_PASSWORD", ""),
		SMTPFromEmail: getEnv("SMTP_FROM_EMAIL", "rift_support@pwioi.com"),
		SMTPFromName:  getEnv("SMTP_FROM_NAME", "RIFT '26 Support"),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
