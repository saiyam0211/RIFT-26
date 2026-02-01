package qrcode

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/skip2/go-qrcode"
)

// QRData represents the data encoded in a QR code
type QRData struct {
	TeamID   uuid.UUID  `json:"team_id"`
	MemberID *uuid.UUID `json:"member_id,omitempty"`
	Token    string     `json:"token"`
	Type     string     `json:"type"` // "team" or "individual"
}

// GenerateTeamQR generates a QR code for team check-in
func GenerateTeamQR(teamID uuid.UUID, token string) (string, error) {
	data := QRData{
		TeamID: teamID,
		Token:  token,
		Type:   "team",
	}

	return generateQR(data)
}

// GenerateIndividualQR generates a QR code for individual member
func GenerateIndividualQR(teamID, memberID uuid.UUID, token string) (string, error) {
	data := QRData{
		TeamID:   teamID,
		MemberID: &memberID,
		Token:    token,
		Type:     "individual",
	}

	return generateQR(data)
}

// generateQR creates a QR code and returns it as a Base64-encoded PNG
func generateQR(data QRData) (string, error) {
	// Convert data to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal QR data: %w", err)
	}

	// Generate QR code as PNG (256x256 pixels, medium recovery level)
	pngBytes, err := qrcode.Encode(string(jsonData), qrcode.Medium, 256)
	if err != nil {
		return "", fmt.Errorf("failed to generate QR code: %w", err)
	}

	// Encode to Base64 for easy embedding in HTML/JSON
	base64String := base64.StdEncoding.EncodeToString(pngBytes)

	return fmt.Sprintf("data:image/png;base64,%s", base64String), nil
}

// DecodeQR decodes QR data from JSON string
func DecodeQR(qrDataString string) (*QRData, error) {
	var data QRData
	err := json.Unmarshal([]byte(qrDataString), &data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode QR data: %w", err)
	}

	return &data, nil
}
