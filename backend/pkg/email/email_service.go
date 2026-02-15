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

// SendTicketCreatedEmail sends notification when a ticket is created
func (s *EmailService) SendTicketCreatedEmail(to, teamName, subject, ticketID string) error {
	emailSubject := "Ticket Submitted - RIFT '26"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060010; color: #fff; padding: 0; margin: 0; }
		.container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a0420 0%%, #060010 100%%); border: 1px solid #c0211f30; border-radius: 12px; overflow: hidden; }
		.header { background: linear-gradient(90deg, #c0211f 0%%, #8a1816 100%%); padding: 30px; text-align: center; }
		.header h1 { margin: 0; font-size: 28px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
		.content { padding: 30px; }
		.ticket-box { background: rgba(192, 33, 31, 0.1); border-left: 4px solid #c0211f; padding: 20px; margin: 20px 0; border-radius: 8px; }
		.ticket-box strong { color: #c0211f; }
		.footer { padding: 20px 30px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #888; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🎫 RIFT '26 Support Ticket</h1>
		</div>
		<div class="content">
			<p>Hi <strong>%s</strong>,</p>
			<p>Your support ticket has been successfully submitted to the RIFT '26 team.</p>
			
			<div class="ticket-box">
				<strong>Ticket ID:</strong> %s<br>
				<strong>Subject:</strong> %s
			</div>
			
			<p>Our team will review your request and respond as soon as possible. You'll receive an email notification when there's an update.</p>
			
			<p style="margin-top: 30px; color: #aaa; font-size: 14px;">Thank you for your patience!</p>
		</div>
		<div class="footer">
			<strong>RIFT '26 Hackathon Team</strong><br>
			This is an automated email. Please monitor your inbox for updates.
		</div>
	</div>
</body>
</html>
	`, teamName, ticketID, subject)

	return s.sendEmail(to, emailSubject, body)
}

// SendTicketResolvedEmail sends notification when a ticket is resolved
func (s *EmailService) SendTicketResolvedEmail(to, teamName, subject, resolution string, editAllowed bool, editMinutes int) error {
	emailSubject := "Ticket Resolved - RIFT '26"

	editInfo := ""
	if editAllowed {
		editInfo = fmt.Sprintf(`
			<div style="background: rgba(192, 33, 31, 0.15); border-left: 4px solid #c0211f; padding: 20px; margin: 20px 0; border-radius: 8px;">
				<h3 style="margin-top: 0; color: #c0211f;">⚠️ Team Editing Enabled</h3>
				<p>You can now edit your team details for the next <strong>%d minutes</strong>.</p>
				<p style="font-size: 14px; color: #aaa;">Visit your dashboard to make changes before the time expires.</p>
			</div>
		`, editMinutes)
	}

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060010; color: #fff; padding: 0; margin: 0; }
		.container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a0420 0%%, #060010 100%%); border: 1px solid #20c02030; border-radius: 12px; overflow: hidden; }
		.header { background: linear-gradient(90deg, #20c020 0%%, #168a16 100%%); padding: 30px; text-align: center; }
		.header h1 { margin: 0; font-size: 28px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
		.content { padding: 30px; }
		.resolution-box { background: rgba(255,255,255,0.05); padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
		.footer { padding: 20px 30px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #888; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>✅ Ticket Resolved</h1>
		</div>
		<div class="content">
			<p>Hi <strong>%s</strong>,</p>
			<p>Great news! Your support ticket has been resolved by our team.</p>
			
			<p><strong>Subject:</strong> %s</p>
			
			<div class="resolution-box">
				<strong style="color: #20c020;">Resolution:</strong><br>
				<p style="margin: 10px 0; line-height: 1.6;">%s</p>
			</div>
			
			%s
			
			<p style="margin-top: 30px; color: #aaa; font-size: 14px;">
				If you have any further questions, please feel free to raise a new ticket from your dashboard.
			</p>
		</div>
		<div class="footer">
			<strong>RIFT '26 Hackathon Team</strong>
		</div>
	</div>
</body>
</html>
	`, teamName, subject, resolution, editInfo)

	return s.sendEmail(to, emailSubject, body)
}

// stripCRLF removes any CR/LF from a string (for use in headers so one line per header).
func stripCRLF(s string) string {
	s = strings.ReplaceAll(s, "\r", " ")
	return strings.ReplaceAll(s, "\n", " ")
}

// normalizeSMTPBody ensures every line ends with \r\n and no line contains bare CR/LF.
// SMTP (RFC 5321) requires CRLF line endings and forbids bare CR or LF within a line.
func normalizeSMTPBody(body string) string {
	body = strings.ReplaceAll(body, "\r\n", "\n")
	body = strings.ReplaceAll(body, "\r", "\n")
	lines := strings.Split(body, "\n")
	out := strings.Join(lines, "\r\n")
	if out != "" && !strings.HasSuffix(out, "\r\n") {
		out += "\r\n"
	}
	return out
}

// sendEmailBCC sends a single email with all recipients in BCC (one SMTP transaction).
// Uses "To: undisclosed-recipients:;" so recipients do not see each other's addresses.
func (s *EmailService) sendEmailBCC(recipients []string, subject, htmlBody string) error {
	if len(recipients) == 0 {
		return nil
	}
	// All header values must be single line (no CR/LF)
	subject = stripCRLF(subject)
	fromName := stripCRLF(s.fromName)
	fromEmail := stripCRLF(strings.TrimSpace(s.fromEmail))

	from := fmt.Sprintf("%s <%s>", fromName, fromEmail)
	headers := make(map[string]string)
	headers["From"] = from
	headers["To"] = "undisclosed-recipients:;"
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, stripCRLF(v))
	}
	message += "\r\n" + normalizeSMTPBody(htmlBody)

	// Recipient addresses must not contain CR/LF
	cleanRecipients := make([]string, 0, len(recipients))
	for _, r := range recipients {
		addr := strings.TrimSpace(stripCRLF(r))
		if addr != "" {
			cleanRecipients = append(cleanRecipients, addr)
		}
	}
	if len(cleanRecipients) == 0 {
		return nil
	}

	auth := smtp.PlainAuth("", s.smtpUsername, s.smtpPassword, s.smtpHost)
	addr := fmt.Sprintf("%s:%s", s.smtpHost, s.smtpPort)
	err := smtp.SendMail(addr, auth, fromEmail, cleanRecipients, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send BCC email: %w", err)
	}
	return nil
}

// SendBulkCustomEmail sends one email per batch with all recipients in BCC (one SMTP transaction per batch).
// Recipients see only "undisclosed-recipients" and do not see each other. Many SMTP servers limit
// recipients per message (e.g. 100), so we batch to stay under typical limits.
func (s *EmailService) SendBulkCustomEmail(recipients []string, subject, htmlContent string) error {
	const bccBatchSize = 100 // Many SMTP servers allow ~100–500 recipients per message

	for i := 0; i < len(recipients); i += bccBatchSize {
		end := i + bccBatchSize
		if end > len(recipients) {
			end = len(recipients)
		}
		batch := recipients[i:end]
		if err := s.sendEmailBCC(batch, subject, htmlContent); err != nil {
			return fmt.Errorf("failed to send BCC batch (recipients %d-%d): %w", i+1, end, err)
		}
	}
	return nil
}

// SendMail is a public wrapper for sending emails (for compatibility)
func (s *EmailService) SendMail(recipients []string, subject, htmlBody string) error {
	for _, recipient := range recipients {
		if err := s.sendEmail(recipient, subject, htmlBody); err != nil {
			return err
		}
	}
	return nil
}
