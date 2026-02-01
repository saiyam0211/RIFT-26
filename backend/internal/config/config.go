package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL         string
	JWTSecret           string
	FirebaseCredentials string
	Port                string
	Environment         string
	AllowedOrigins      string
}

func Load() (*Config, error) {
	// Load .env file if it exists (ignore error in production)
	_ = godotenv.Load()

	return &Config{
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://rift26_user:rift26_secure_password@localhost:5432/rift26_db?sslmode=disable"),
		JWTSecret:           getEnv("JWT_SECRET", "default-secret-change-me"),
		FirebaseCredentials: getEnv("FIREBASE_CREDENTIALS_PATH", "./firebase-credentials.json"),
		Port:                getEnv("PORT", "8080"),
		Environment:         getEnv("ENVIRONMENT", "development"),
		AllowedOrigins:      getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
