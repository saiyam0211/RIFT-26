package repository

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
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

// CreateOTP generates and stores a new OTP
func (r *OTPRepository) CreateOTP(ctx context.Context, phone string, teamID uuid.UUID) (*models.OTP, error) {
	// Generate 6-digit OTP
	otpCode := fmt.Sprintf("%06d", rand.Intn(1000000))

	// OTP expires in 5 minutes
	expiresAt := time.Now().Add(5 * time.Minute)

	query := `
		INSERT INTO otps (phone, otp_code, team_id, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id, phone, otp_code, team_id, expires_at, verified, created_at
	`

	var otp models.OTP
	err := r.db.QueryRowContext(ctx, query, phone, otpCode, teamID, expiresAt).Scan(
		&otp.ID, &otp.Phone, &otp.OTPCode, &otp.TeamID,
		&otp.ExpiresAt, &otp.Verified, &otp.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTP: %w", err)
	}

	return &otp, nil
}

// VerifyOTP validates an OTP code
func (r *OTPRepository) VerifyOTP(ctx context.Context, phone, otpCode string, teamID uuid.UUID) (bool, error) {
	query := `
		SELECT id, expires_at, verified
		FROM otps
		WHERE phone = $1 AND otp_code = $2 AND team_id = $3
		ORDER BY created_at DESC
		LIMIT 1
	`

	var id uuid.UUID
	var expiresAt time.Time
	var verified bool

	err := r.db.QueryRowContext(ctx, query, phone, otpCode, teamID).Scan(&id, &expiresAt, &verified)
	if err == sql.ErrNoRows {
		return false, nil // OTP not found
	}
	if err != nil {
		return false, fmt.Errorf("failed to verify OTP: %w", err)
	}

	// Check if already verified
	if verified {
		return false, fmt.Errorf("OTP already used")
	}

	// Check if expired
	if time.Now().After(expiresAt) {
		return false, fmt.Errorf("OTP expired")
	}

	// Mark OTP as verified
	_, err = r.db.ExecContext(ctx, `UPDATE otps SET verified = true WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("failed to mark OTP as verified: %w", err)
	}

	return true, nil
}

// IsRateLimited checks if a phone number has exceeded OTP request limits
func (r *OTPRepository) IsRateLimited(ctx context.Context, phone string) (bool, error) {
	// Allow max 3 OTP requests per hour
	oneHourAgo := time.Now().Add(-1 * time.Hour)

	query := `
		SELECT COUNT(*) FROM otps
		WHERE phone = $1 AND created_at > $2
	`

	var count int
	err := r.db.QueryRowContext(ctx, query, phone, oneHourAgo).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check rate limit: %w", err)
	}

	return count >= 3, nil
}

// CleanupExpiredOTPs removes old OTP records (should be run periodically)
func (r *OTPRepository) CleanupExpiredOTPs(ctx context.Context) error {
	query := `DELETE FROM otps WHERE expires_at < NOW() - INTERVAL '24 hours'`
	_, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired OTPs: %w", err)
	}
	return nil
}
