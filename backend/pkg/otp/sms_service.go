package otp

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// SMSService interface for sending SMS
type SMSService interface {
	SendOTP(phone, otpCode string) error
}

// TwilioService implements SMSService for Twilio
type TwilioService struct {
	AccountSID string
	AuthToken  string
	FromNumber string
}

func NewTwilioService(accountSID, authToken, fromNumber string) *TwilioService {
	return &TwilioService{
		AccountSID: accountSID,
		AuthToken:  authToken,
		FromNumber: fromNumber,
	}
}

func (s *TwilioService) SendOTP(phone, otpCode string) error {
	// Prepare message
	message := fmt.Sprintf("Your RIFT '26 verification code is: %s. Valid for 5 minutes.", otpCode)

	// Twilio API endpoint
	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", s.AccountSID)

	// Prepare form data
	data := url.Values{}
	data.Set("To", "+91"+phone) // Add India country code
	data.Set("From", s.FromNumber)
	data.Set("Body", message)

	// Create HTTP request
	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(s.AccountSID, s.AuthToken)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send SMS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("twilio API error: status %d", resp.StatusCode)
	}

	return nil
}

// MSG91Service implements SMSService for MSG91
type MSG91Service struct {
	APIKey     string
	SenderID   string
	TemplateID string
}

func NewMSG91Service(apiKey, senderID, templateID string) *MSG91Service {
	return &MSG91Service{
		APIKey:     apiKey,
		SenderID:   senderID,
		TemplateID: templateID,
	}
}

func (s *MSG91Service) SendOTP(phone, otpCode string) error {
	// MSG91 OTP API endpoint
	apiURL := "https://control.msg91.com/api/v5/otp"

	// Prepare JSON payload
	payload := fmt.Sprintf(`{
		"template_id": "%s",
		"mobile": "91%s",
		"otp": "%s"
	}`, s.TemplateID, phone, otpCode)

	// Create HTTP request
	req, err := http.NewRequest("POST", apiURL, strings.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Add("authkey", s.APIKey)
	req.Header.Add("Content-Type", "application/json")

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send SMS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("MSG91 API error: status %d", resp.StatusCode)
	}

	return nil
}

// MockSMSService for development/testing
type MockSMSService struct{}

func NewMockSMSService() *MockSMSService {
	return &MockSMSService{}
}

func (s *MockSMSService) SendOTP(phone, otpCode string) error {
	// Just log in development
	fmt.Printf("[MOCK SMS] OTP for %s: %s\n", phone, otpCode)
	return nil
}
