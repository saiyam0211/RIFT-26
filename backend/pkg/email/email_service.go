package email

import (
	"fmt"
	"net/smtp"
	"strings"
)

// EmailService handles sending emails via SMTP
type EmailService struct {
	smtpHost     string
	smtpPort     string
	smtpUsername string
	smtpPassword string
	fromEmail    string
	fromName     string
}

// NewEmailService creates a new email service instance
func NewEmailService(host, port, username, password, fromEmail, fromName string) *EmailService {
	return &EmailService{
		smtpHost:     host,
		smtpPort:     port,
		smtpUsername: username,
		smtpPassword: password,
		fromEmail:    fromEmail,
		fromName:     fromName,
	}
}

// SendOTP sends an OTP email to the specified recipient
func (s *EmailService) SendOTP(toEmail, otpCode, teamName string) error {
	subject := "Your RIFT '26 OTP Code"
	body := s.generateOTPEmailBody(otpCode, teamName)

	return s.sendEmail(toEmail, subject, body)
}

// generateOTPEmailBody creates the HTML email body for OTP
func (s *EmailService) generateOTPEmailBody(otpCode, teamName string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RIFT '26 OTP</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #c0211f 0%%, #8b0000 100%%); padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 2px;">RIFT '26</h1>
                            <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Hackathon Registration</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Your OTP Code</h2>
                            <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">
                                Hi there! You've requested to authenticate for team <strong>%s</strong>.
                            </p>
                            
                            <!-- OTP Box -->
                            <table width="100%%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <div style="background-color: #f8f8f8; border: 2px dashed #c0211f; border-radius: 8px; padding: 20px; display: inline-block;">
                                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">Your OTP Code:</p>
                                            <h1 style="margin: 0; color: #c0211f; font-size: 48px; font-weight: bold; letter-spacing: 8px;">%s</h1>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 30px 0 0 0;">
                                <strong>Important:</strong> This OTP will expire in <strong>5 minutes</strong>. Do not share this code with anyone.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 20px 30px; border-top: 1px solid #eeeeee;">
                            <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
                                If you didn't request this OTP, please ignore this email.
                            </p>
                            <p style="color: #999999; font-size: 12px; margin: 10px 0 0 0; text-align: center;">
                                © 2026 RIFT Hackathon. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`, teamName, otpCode)
}

// sendEmail sends an email using SMTP
func (s *EmailService) sendEmail(to, subject, htmlBody string) error {
	// Prepare email headers and body
	from := fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail)

	// Build email message
	headers := make(map[string]string)
	headers["From"] = from
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	// Setup authentication
	auth := smtp.PlainAuth("", s.smtpUsername, s.smtpPassword, s.smtpHost)

	// Connect to SMTP server
	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)

	// Send email
	err := smtp.SendMail(addr, auth, s.fromEmail, []string{to}, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// ValidateEmail performs basic email validation
func ValidateEmail(email string) bool {
	if email == "" {
		return false
	}

	// Basic validation: contains @ and .
	if !strings.Contains(email, "@") {
		return false
	}

	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return false
	}

	if parts[0] == "" || parts[1] == "" {
		return false
	}

	if !strings.Contains(parts[1], ".") {
		return false
	}

	return true
}

// MaskEmail masks an email address for privacy
// Example: john.doe@example.com -> jo***@example.com
func MaskEmail(email string) string {
	if email == "" {
		return ""
	}

	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return email // Return as-is if invalid format
	}

	localPart := parts[0]
	domain := parts[1]

	// Show first 2 characters of local part
	visibleChars := 2
	if len(localPart) <= visibleChars {
		return email // Too short to mask effectively
	}

	maskedLocal := localPart[:visibleChars] + "***"
	return maskedLocal + "@" + domain
}
