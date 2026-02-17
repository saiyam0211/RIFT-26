package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	Port           string
	Environment    string
	AllowedOrigins string
	// Feature Flags
	EnableEmailOTP  bool   // Set to false to skip OTP and use email-only auth
	AllowCityChange bool   // Set to false to prevent teams from changing their city during RSVP
	RSVPOpen        string // "true" = open, "false" = closed, "pin" = PIN-protected
	RSVPPinSecret   string // Secret for generating 6-digit PIN (rotates every 3 hours)
	FinalOpen       string // "true" = open, "false" = closed, "pin" = PIN-protected (for final confirmation form)
	FinalPinSecret  string // Secret for generating 6-digit PIN for final confirmation (rotates every 3 hours)
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
		// Feature Flags (RSVP_OPEN and FINAL_OPEN from env only: "true" | "false" | "pin")
		EnableEmailOTP:  getEnv("ENABLE_EMAIL_OTP", "false") == "true",
		AllowCityChange: getEnv("ALLOW_CITY_CHANGE", "false") == "true",
		RSVPOpen:        normalizeRSVPOpen(getEnv("RSVP_OPEN", "false")),
		RSVPPinSecret:   getEnv("RSVP_PIN_SECRET", ""),
		FinalOpen:       normalizeRSVPOpen(getEnv("FINAL_OPEN", "false")),
		FinalPinSecret:  getEnv("FINAL_PIN_SECRET", ""),
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
		return strings.TrimSpace(value)
	}
	return defaultValue
}

// normalizeRSVPOpen returns "true", "pin", or "false" from env value. No hardcoding.
func normalizeRSVPOpen(v string) string {
	v = strings.TrimSpace(strings.ToLower(v))
	if v == "true" || v == "pin" {
		return v
	}
	return "false"
}
