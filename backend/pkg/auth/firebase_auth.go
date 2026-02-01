package auth

import (
	"context"
	"fmt"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

// FirebaseAuthService handles Firebase Authentication
type FirebaseAuthService struct {
	client *auth.Client
}

// NewFirebaseAuthService initializes Firebase Auth client
func NewFirebaseAuthService(credentialsPath string) (*FirebaseAuthService, error) {
	ctx := context.Background()

	// Initialize Firebase app
	opt := option.WithCredentialsFile(credentialsPath)
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Firebase app: %w", err)
	}

	// Get Auth client
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get Auth client: %w", err)
	}

	return &FirebaseAuthService{client: client}, nil
}

// VerifyIDToken verifies a Firebase ID token and returns the UID
func (s *FirebaseAuthService) VerifyIDToken(ctx context.Context, idToken string) (string, string, error) {
	token, err := s.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return "", "", fmt.Errorf("failed to verify ID token: %w", err)
	}

	// Extract phone number from token claims
	phoneNumber := ""
	if phone, ok := token.Claims["phone_number"].(string); ok {
		phoneNumber = phone
	}

	return token.UID, phoneNumber, nil
}

// GetUserByPhone retrieves a Firebase user by phone number
func (s *FirebaseAuthService) GetUserByPhone(ctx context.Context, phoneNumber string) (*auth.UserRecord, error) {
	user, err := s.client.GetUserByPhoneNumber(ctx, phoneNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by phone: %w", err)
	}

	return user, nil
}

// CreateCustomToken creates a custom token for a user (optional, for additional claims)
func (s *FirebaseAuthService) CreateCustomToken(ctx context.Context, uid string, claims map[string]interface{}) (string, error) {
	token, err := s.client.CustomTokenWithClaims(ctx, uid, claims)
	if err != nil {
		return "", fmt.Errorf("failed to create custom token: %w", err)
	}

	return token, nil
}
