package handlers

import (
	"database/sql"
	"fmt"
	"html"
	"image"
	"image/color"
	"image/jpeg"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
)

// certificateEmailSender matches the email service interface
type certificateEmailSender interface {
	SendCertificateEmail(toEmail, participantName, teamName, certType, certID, issuedAt, verifyURL string) error
}

// CertificateHandler handles certificate generation and sending
type CertificateHandler struct {
	db           *sql.DB
	emailService certificateEmailSender
	apiPublicURL string
	frontendURL  string
}

func NewCertificateHandler(db *sql.DB, emailService certificateEmailSender, apiPublicURL, frontendURL string) *CertificateHandler {
	return &CertificateHandler{
		db:           db,
		emailService: emailService,
		apiPublicURL: strings.TrimRight(apiPublicURL, "/"),
		frontendURL:  strings.TrimRight(frontendURL, "/"),
	}
}

// ── POST /api/v1/admin/certificates/send ────────────────────────────────────
// Bulk send for teams (participant / semi_finalist / winner)
func (h *CertificateHandler) SendCertificates(c *gin.Context) {
	var req models.SendCertificatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if req.CertType == "winner" && strings.TrimSpace(req.Position) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Position is required for winner certificates"})
		return
	}

	var teamUUIDs []uuid.UUID
	for _, tidStr := range req.TeamIDs {
		tid, err := uuid.Parse(strings.TrimSpace(tidStr))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid team ID: %s", tidStr)})
			return
		}
		teamUUIDs = append(teamUUIDs, tid)
	}

	placeholders := ""
	args := make([]interface{}, len(teamUUIDs))
	for i, tid := range teamUUIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += fmt.Sprintf("$%d", i+1)
		args[i] = tid
	}

	type memberRow struct {
		MemberID, Name, Email, TeamID, TeamName string
	}

	query := fmt.Sprintf(`
		SELECT tm.id, tm.name, tm.email, t.id, t.team_name
		FROM team_members tm
		JOIN teams t ON t.id = tm.team_id
		WHERE tm.team_id IN (%s)
		ORDER BY t.team_name, tm.role
	`, placeholders)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch team members: " + err.Error()})
		return
	}
	defer rows.Close()

	var members []memberRow
	for rows.Next() {
		var m memberRow
		if err := rows.Scan(&m.MemberID, &m.Name, &m.Email, &m.TeamID, &m.TeamName); err != nil {
			continue
		}
		if m.Email == "" || !strings.Contains(m.Email, "@") {
			continue
		}
		members = append(members, m)
	}
	rows.Close()

	if len(members) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No valid members found", "sent_count": 0})
		return
	}

	issuedAt := time.Now()
	issuedAtStr := issuedAt.Format("02 Jan 2006")

	var position *string
	if req.CertType == "winner" {
		p := strings.TrimSpace(req.Position)
		position = &p
	}

	var sentCount, skippedCount int
	var errorList []string

	for _, m := range members {
		var certID string
		err := h.db.QueryRow(`
			INSERT INTO certificates (id, participant_name, participant_email, team_id, team_name, cert_type, position, issued_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (participant_email, cert_type)
			DO UPDATE SET participant_name = EXCLUDED.participant_name,
			              team_id = EXCLUDED.team_id,
			              team_name = EXCLUDED.team_name,
			              position = EXCLUDED.position,
			              issued_at = EXCLUDED.issued_at
			RETURNING id
		`, m.Name, m.Email, m.TeamID, m.TeamName, req.CertType, position, issuedAt).Scan(&certID)
		if err != nil {
			errorList = append(errorList, fmt.Sprintf("%s (%s): DB error – %v", m.Name, m.Email, err))
			continue
		}

		verifyURL := fmt.Sprintf("%s/verify/%s", h.frontendURL, certID)

		if err := h.emailService.SendCertificateEmail(
			m.Email, m.Name, m.TeamName, req.CertType, certID, issuedAtStr, verifyURL,
		); err != nil {
			errorList = append(errorList, fmt.Sprintf("%s (%s): email error – %v", m.Name, m.Email, err))
			skippedCount++
		} else {
			sentCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Certificates processed",
		"sent_count":    sentCount,
		"skipped_count": skippedCount,
		"total":         len(members),
		"errors":        errorList,
	})
}

// ── POST /api/v1/admin/certificates/send-manual ─────────────────────────────
// Send a single certificate manually (for volunteers, HODs, custom, or individual team members)
func (h *CertificateHandler) SendManualCertificate(c *gin.Context) {
	var req models.ManualCertificateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Validate team name for team-based types
	needsTeam := req.CertType == "participant" || req.CertType == "semi_finalist" || req.CertType == "winner"
	if needsTeam && (req.TeamName == nil || strings.TrimSpace(*req.TeamName) == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team name is required for " + req.CertType + " certificates"})
		return
	}

	// Validate position for types that need it
	needsPosition := req.CertType == "winner" || req.CertType == "custom"
	if needsPosition && (req.Position == nil || strings.TrimSpace(*req.Position) == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Position/title is required for " + req.CertType + " certificates"})
		return
	}

	issuedAt := time.Now()
	issuedAtStr := issuedAt.Format("02 Jan 2006")

	var certID string
	err := h.db.QueryRow(`
		INSERT INTO certificates (id, participant_name, participant_email, team_name, cert_type, position, issued_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		ON CONFLICT (participant_email, cert_type)
		DO UPDATE SET participant_name = EXCLUDED.participant_name,
		              team_name = EXCLUDED.team_name,
		              position = EXCLUDED.position,
		              issued_at = EXCLUDED.issued_at
		RETURNING id
	`, req.Name, req.Email, req.TeamName, req.CertType, req.Position, issuedAt).Scan(&certID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create certificate: " + err.Error()})
		return
	}

	verifyURL := fmt.Sprintf("%s/verify/%s", h.frontendURL, certID)
	teamName := ""
	if req.TeamName != nil {
		teamName = *req.TeamName
	}

	if err := h.emailService.SendCertificateEmail(
		req.Email, req.Name, teamName, req.CertType, certID, issuedAtStr, verifyURL,
	); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": "Certificate created but email failed",
			"cert_id": certID,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Certificate sent successfully",
		"cert_id": certID,
	})
}

// ── GET /api/v1/certificates/verify/:cert_id ────────────────────────────────
func (h *CertificateHandler) VerifyCertificate(c *gin.Context) {
	certIDStr := c.Param("cert_id")
	if _, err := uuid.Parse(certIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid certificate ID"})
		return
	}

	var cert models.Certificate
	var issuedAt time.Time
	err := h.db.QueryRow(`
		SELECT id, participant_name, participant_email, team_id, team_name, cert_type, position, issued_at
		FROM certificates WHERE id = $1
	`, certIDStr).Scan(
		&cert.ID, &cert.ParticipantName, &cert.ParticipantEmail,
		&cert.TeamID, &cert.TeamName, &cert.CertType, &cert.Position, &issuedAt,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"valid": false, "error": "Certificate not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify certificate"})
		return
	}

	cert.IssuedAt = issuedAt

	c.JSON(http.StatusOK, gin.H{
		"valid":       true,
		"certificate": cert,
		"label":       certTypeFullLabel(cert.CertType, cert.Position),
		"issued_at":   issuedAt.Format("02 January 2006"),
		"image_url":   fmt.Sprintf("%s/api/v1/certificates/%s/image.jpg", h.apiPublicURL, cert.ID),
		"verify_url":  fmt.Sprintf("%s/verify/%s", h.frontendURL, cert.ID),
	})
}

// ── GET /api/v1/certificates/:cert_id/image.svg ─────────────────────────────
func (h *CertificateHandler) GetCertificateImageSVG(c *gin.Context) {
	certIDStr := c.Param("cert_id")
	if _, err := uuid.Parse(certIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid certificate ID"})
		return
	}

	var cert models.Certificate
	var issuedAt time.Time
	err := h.db.QueryRow(`SELECT id, participant_name, team_name, cert_type, position, issued_at FROM certificates WHERE id = $1`, certIDStr).
		Scan(&cert.ID, &cert.ParticipantName, &cert.TeamName, &cert.CertType, &cert.Position, &issuedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Certificate not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load certificate"})
		return
	}

	teamName := ""
	if cert.TeamName != nil {
		teamName = *cert.TeamName
	}

	svg := generateCertificateSVG(cert.ParticipantName, teamName, cert.CertType,
		issuedAt.Format("02 January 2006"), cert.ID, cert.Position, h.apiPublicURL)

	c.Header("Content-Type", "image/svg+xml")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Access-Control-Allow-Origin", "*")
	c.String(http.StatusOK, svg)
}

// ── GET /api/v1/certificates/:cert_id/image.jpg ─────────────────────────────

func (h *CertificateHandler) GetCertificateImageJPEG(c *gin.Context) {
	certIDStr := c.Param("cert_id")
	if _, err := uuid.Parse(certIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid certificate ID"})
		return
	}

	var cert models.Certificate
	var issuedAt time.Time
	err := h.db.QueryRow(`SELECT id, participant_name, team_name, cert_type, position, issued_at FROM certificates WHERE id = $1`, certIDStr).
		Scan(&cert.ID, &cert.ParticipantName, &cert.TeamName, &cert.CertType, &cert.Position, &issuedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Certificate not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load certificate"})
		return
	}

	teamName := ""
	if cert.TeamName != nil {
		teamName = *cert.TeamName
	}

	img := generateCertificateJPEG(cert.ParticipantName, teamName, cert.CertType,
		issuedAt.Format("02 January 2006"), cert.ID, cert.Position)

	c.Header("Content-Type", "image/jpeg")
	c.Header("Cache-Control", "public, max-age=86400")
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="RIFT26-Certificate-%s.jpg"`,
		strings.ReplaceAll(cert.ParticipantName, " ", "-")))

	if err := jpeg.Encode(c.Writer, img, &jpeg.Options{Quality: 92}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encode image"})
	}
}

// ── Label helpers ────────────────────────────────────────────────────────────

func certTypeFullLabel(certType string, position *string) string {
	switch certType {
	case "winner":
		if position != nil && *position != "" {
			return fmt.Sprintf("Winner (%s) – RIFT '26 Hackathon", *position)
		}
		return "Winner – RIFT '26 Hackathon"
	case "semi_finalist":
		return "Semi-Finalist – RIFT '26 Hackathon"
	case "volunteer":
		return "Volunteer – RIFT '26 Hackathon"
	case "hod":
		if position != nil && *position != "" {
			return fmt.Sprintf("Head of Department (%s) – RIFT '26", *position)
		}
		return "Head of Department – RIFT '26"
	case "custom":
		if position != nil && *position != "" {
			return fmt.Sprintf("%s – RIFT '26", *position)
		}
		return "Certificate – RIFT '26"
	default:
		return "Participant – RIFT '26 Hackathon"
	}
}

func certTypeSubtitle(certType string) string {
	switch certType {
	case "winner":
		return "of Excellence"
	case "semi_finalist":
		return "of Excellence"
	case "volunteer":
		return "of Appreciation"
	case "hod":
		return "of Leadership"
	case "custom":
		return "of Recognition"
	default:
		return "of Appreciation"
	}
}

func certTypePurpose(certType string, position *string) string {
	switch certType {
	case "winner":
		if position != nil && *position != "" {
			return fmt.Sprintf("for winning (%s) at", html.EscapeString(*position))
		}
		return "for winning"
	case "semi_finalist":
		return "for reaching the Semi-Finals of"
	case "volunteer":
		return "for volunteering at"
	case "hod":
		if position != nil && *position != "" {
			return fmt.Sprintf("for leading as %s at", html.EscapeString(*position))
		}
		return "for leading at"
	case "custom":
		if position != nil && *position != "" {
			return fmt.Sprintf("for contribution as %s at", html.EscapeString(*position))
		}
		return "for contributing to"
	default:
		return "for actively participating in"
	}
}

func certTypeBadge(certType string, position *string) string {
	switch certType {
	case "winner":
		if position != nil && *position != "" {
			return strings.ToUpper(*position)
		}
		return "WINNER"
	case "semi_finalist":
		return "SEMI-FINALIST"
	case "volunteer":
		return "VOLUNTEER"
	case "hod":
		return "HEAD OF DEPT"
	case "custom":
		if position != nil && *position != "" {
			return strings.ToUpper(*position)
		}
		return "CERTIFICATE"
	default:
		return "PARTICIPANT"
	}
}

// ── SVG generation ──────────────────────────────────────────────────────────

func generateCertificateSVG(participantName, teamName, certType, issuedDate, certID string, position *string, apiPublicURL string) string {
	safeName := html.EscapeString(participantName)
	safeTeam := html.EscapeString(teamName)

	safeID := html.EscapeString(certID)
	subtitle := html.EscapeString(certTypeSubtitle(certType))
	badge := html.EscapeString(certTypeBadge(certType, position))
	purpose := certTypePurpose(certType, position)

	// Team line (hidden for non-team certs)
	teamLine := ""
	if teamName != "" {
		teamLine = fmt.Sprintf(
			`<text x="600" y="510" font-family="Arial,sans-serif" font-size="15" fill="#777777" text-anchor="middle">Team: %s · We appreciate your enthusiasm, dedication, and contribution.</text>`,
			safeTeam,
		)
	} else {
		teamLine = `<text x="600" y="510" font-family="Arial,sans-serif" font-size="15" fill="#777777" text-anchor="middle">We appreciate your enthusiasm, dedication, and valuable contribution.</text>`
	}

	// Badge pill width adapts to text length
	badgeW := len(badge)*10 + 40
	if badgeW < 160 {
		badgeW = 160
	}
	badgeX := 600 - badgeW/2

	// Font URLs & Images — embedded as base64 data URIs (required: browsers block external resources in SVGs loaded via <img>)
	brittanyDataURI := "data:font/truetype;base64," + brittanyFontBase64
	tanBusterDataURI := "data:font/truetype;base64," + tanBusterFontBase64
	pwioiLogoDataURI := "data:image/webp;base64," + pwioiLogoBase64

	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 848" width="1200" height="848">
  <defs>
    <style>
      @font-face { font-family: 'Brittany'; src: url('%s') format('truetype'); }
      @font-face { font-family: 'TanBuster'; src: url('%s') format('truetype'); font-weight: bold; }
    </style>

    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%%" stop-color="#1c1c1c"/>
      <stop offset="60%%" stop-color="#111111"/>
      <stop offset="100%%" stop-color="#0d0d0d"/>
    </linearGradient>
    <linearGradient id="nameBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%%" stop-color="#c0211f"/>
      <stop offset="100%%" stop-color="#8b0000"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow" x="-5%%" y="-5%%" width="110%%" height="110%%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="848" fill="url(#bg)"/>

  <!-- Left geometric diamonds -->
  <polygon points="-20,80 200,230 -20,580 -240,230" fill="#222222" stroke="#2e2e2e" stroke-width="1.2"/>
  <polygon points="30,150 210,280 30,520 -150,280" fill="none" stroke="#292929" stroke-width="1"/>
  <polygon points="120,280 260,370 120,530 -20,370" fill="#1e1e1e" stroke="#333333" stroke-width="1"/>

  <!-- Right shapes -->
  <polygon points="1200,0 1200,260 1090,140" fill="#181818" stroke="#272727" stroke-width="1"/>
  <polygon points="1200,588 1200,848 1040,720" fill="#181818" stroke="#252525" stroke-width="1"/>

  <!-- PW IOI logo -->
  <image href="%s" x="40" y="22" width="162" height="58" preserveAspectRatio="xMinYMid meet" />

  <!-- Top red accent -->
  <rect x="300" y="44" width="600" height="3" fill="#c0211f" rx="2"/>

  <!-- RIFT logo box -->
  <rect x="1010" y="28" width="162" height="50" rx="5" fill="#c0211f" filter="url(#shadow)"/>
  <text x="1091" y="68" font-family="TanBuster,Arial Black,sans-serif" font-size="30" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="3">RIFT</text>

  <!-- "Certificate" heading -->
  <text x="600" y="190" font-family="Georgia,'Times New Roman',serif" font-size="102" font-weight="900" fill="white" text-anchor="middle" letter-spacing="-2" filter="url(#shadow)">Certificate</text>

  <!-- Sub-label -->
  <text x="600" y="248" font-family="Georgia,'Times New Roman',serif" font-size="40" font-weight="400" fill="white" text-anchor="middle">%s</text>

  <!-- Presented to -->
  <text x="600" y="308" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#888888" text-anchor="middle" letter-spacing="5">THIS CERTIFICATE IS PROUDLY PRESENTED TO</text>

  <!-- Participant name (Brittany font) -->
  <text x="600" y="410" font-family="Georgia,Palatino,serif" font-size="82" fill="#c0211f" text-anchor="middle" filter="url(#glow)">%s</text>


  <!-- Purpose + date -->
  <text x="600" y="478" font-family="Arial,sans-serif" font-size="17" fill="#aaaaaa" text-anchor="middle">%s RIFT '26 Hackathon held on 19th-20th February 2026.</text>

  <!-- Team name line -->
  %s

  <!-- Badge pill -->
  <rect x="%d" y="534" width="%d" height="34" rx="17" fill="#c0211f" filter="url(#shadow)"/>
  <text x="600" y="556" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="white" text-anchor="middle" letter-spacing="2.5">%s</text>

  <!-- Signature left — Brittany font -->
  <text x="292" y="650" font-family="Brittany,Georgia,Palatino,serif" font-size="36" fill="#cccccc" text-anchor="middle">Gopal Sharma</text>
  <rect x="152" y="662" width="280" height="1.5" fill="#3a3a3a"/>
  <text x="292" y="682" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#666666" text-anchor="middle" letter-spacing="2">COO – PHYSICS WALLAH</text>

  <!-- Signature right — Brittany font -->
  <text x="908" y="650" font-family="Brittany,Georgia,Palatino,serif" font-size="36" fill="#cccccc" text-anchor="middle">Janishar Ali</text>
  <rect x="768" y="662" width="280" height="1.5" fill="#3a3a3a"/>
  <text x="908" y="682" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#666666" text-anchor="middle" letter-spacing="2">VP – PHYSICS WALLAH</text>

  <!-- Watermark (Tan Buster) -->
  <text x="600" y="702" font-family="TanBuster,Arial Black,sans-serif" font-size="80" font-weight="bold" fill="#c0211f" opacity="0.05" text-anchor="middle" letter-spacing="6">RIFT '26</text>

  <!-- Seal -->
  <circle cx="600" cy="664" r="48" fill="none" stroke="#c0211f" stroke-width="1.2" opacity="0.25"/>
  <circle cx="600" cy="664" r="40" fill="none" stroke="#c0211f" stroke-width="0.6" opacity="0.15"/>
  <text x="600" y="661" font-family="TanBuster,Arial,sans-serif" font-size="9" font-weight="bold" fill="#c0211f" opacity="0.4" text-anchor="middle" letter-spacing="1.5">RIFT '26</text>
  <text x="600" y="673" font-family="Arial,sans-serif" font-size="7" fill="#c0211f" opacity="0.4" text-anchor="middle" letter-spacing="1">HACKATHON</text>

  <!-- Bottom bar -->
  <rect x="0" y="788" width="1200" height="60" fill="#080808"/>
  <rect x="300" y="788" width="600" height="2" fill="#c0211f" rx="1"/>
  <text x="600" y="814" font-family="Arial,sans-serif" font-size="11" fill="#444444" text-anchor="middle" letter-spacing="2">CERTIFICATE ID</text>
  <text x="600" y="836" font-family="'Courier New',monospace" font-size="12" fill="#555555" text-anchor="middle">%s</text>
</svg>`,
		brittanyDataURI, tanBusterDataURI, pwioiLogoDataURI,
		subtitle, safeName,
		purpose,
		teamLine,
		badgeX, badgeW, badge,
		safeID,
	)
}

// ── JPEG generation (pure stdlib) ───────────────────────────────────────────

func generateCertificateJPEG(participantName, teamName, certType, issuedDate, certID string, position *string) image.Image {
	const W, H = 1200, 848
	img := image.NewRGBA(image.Rect(0, 0, W, H))

	bg := rgba(17, 17, 17, 255)
	red := rgba(192, 33, 31, 255)
	darkRed := rgba(100, 10, 10, 255)
	white := rgba(255, 255, 255, 255)
	darkGray := rgba(35, 35, 35, 255)

	fillRect(img, 0, 0, W, H, bg)
	drawDiamond(img, -20, 80, 200, 230, -20, 580, -240, 230, darkGray)
	drawDiamond(img, 120, 280, 260, 370, 120, 530, -20, 370, rgba(30, 30, 30, 255))
	drawTriangle(img, W, 0, W, 260, W-150, 140, rgba(24, 24, 24, 255))
	drawTriangle(img, W, 588, W, H, W-160, 720, rgba(24, 24, 24, 255))

	fillRect(img, 300, 44, 600, 3, red)
	fillRect(img, 1010, 28, 162, 58, red)
	fillRect(img, 1025, 45, 130, 6, white)
	fillRect(img, 1025, 56, 130, 6, white)
	fillRect(img, 1025, 67, 130, 6, white)

	fillRect(img, 200, 120, 800, 60, white)
	fillRect(img, 350, 195, 500, 36, rgba(220, 220, 220, 255))
	fillRect(img, 320, 300, 560, 8, rgba(80, 80, 80, 255))
	fillRect(img, 240, 345, 720, 52, red)
	fillRect(img, 238, 343, 724, 56, rgba(192, 33, 31, 30))
	gradientRect(img, 240, 415, 720, 3, red, darkRed)
	fillRect(img, 280, 440, 640, 10, rgba(100, 100, 100, 255))
	fillRect(img, 320, 470, 560, 8, rgba(70, 70, 70, 255))

	fillRoundedRect(img, 512, 500, 176, 34, 17, red)
	fillRect(img, 540, 514, 120, 7, white)

	fillRect(img, 152, 630, 280, 8, rgba(100, 100, 100, 255))
	fillRect(img, 152, 648, 280, 2, rgba(55, 55, 55, 255))
	fillRect(img, 152, 664, 280, 6, rgba(70, 70, 70, 255))
	fillRect(img, 768, 630, 280, 8, rgba(100, 100, 100, 255))
	fillRect(img, 768, 648, 280, 2, rgba(55, 55, 55, 255))
	fillRect(img, 768, 664, 280, 6, rgba(70, 70, 70, 255))

	drawCircleOutline(img, 600, 590, 48, rgba(192, 33, 31, 20))
	drawCircleOutline(img, 600, 590, 40, rgba(192, 33, 31, 12))

	fillRect(img, 0, 788, W, 60, rgba(8, 8, 8, 255))
	fillRect(img, 300, 788, 600, 2, red)
	fillRect(img, 280, 808, 640, 7, rgba(50, 50, 50, 255))
	fillRect(img, 320, 824, 560, 6, rgba(60, 60, 60, 255))

	_ = participantName
	_ = teamName
	_ = certType
	_ = issuedDate
	_ = certID
	_ = position

	return img
}

// ── Drawing primitives ──────────────────────────────────────────────────────

func rgba(r, g, b, a uint8) color.RGBA { return color.RGBA{R: r, G: g, B: b, A: a} }

func fillRect(img *image.RGBA, x, y, w, h int, c color.RGBA) {
	bounds := img.Bounds()
	for dy := 0; dy < h; dy++ {
		py := y + dy
		if py < bounds.Min.Y || py >= bounds.Max.Y {
			continue
		}
		for dx := 0; dx < w; dx++ {
			px := x + dx
			if px < bounds.Min.X || px >= bounds.Max.X {
				continue
			}
			img.SetRGBA(px, py, c)
		}
	}
}

func gradientRect(img *image.RGBA, x, y, w, h int, from, to color.RGBA) {
	for dx := 0; dx < w; dx++ {
		t := float64(dx) / float64(w)
		c := color.RGBA{
			R: uint8(float64(from.R)*(1-t) + float64(to.R)*t),
			G: uint8(float64(from.G)*(1-t) + float64(to.G)*t),
			B: uint8(float64(from.B)*(1-t) + float64(to.B)*t),
			A: 255,
		}
		for dy := 0; dy < h; dy++ {
			img.SetRGBA(x+dx, y+dy, c)
		}
	}
}

func fillRoundedRect(img *image.RGBA, x, y, w, h, r int, c color.RGBA) {
	fillRect(img, x+r, y, w-2*r, h, c)
	fillRect(img, x, y+r, r, h-2*r, c)
	fillRect(img, x+w-r, y+r, r, h-2*r, c)
	for dy := 0; dy < r; dy++ {
		for dx := 0; dx < r; dx++ {
			if dx*dx+dy*dy <= r*r {
				img.SetRGBA(x+r-1-dx, y+r-1-dy, c)
				img.SetRGBA(x+w-r+dx, y+r-1-dy, c)
				img.SetRGBA(x+r-1-dx, y+h-r+dy, c)
				img.SetRGBA(x+w-r+dx, y+h-r+dy, c)
			}
		}
	}
}

func drawCircleOutline(img *image.RGBA, cx, cy, r int, c color.RGBA) {
	bounds := img.Bounds()
	for angle := 0.0; angle < 360.0; angle += 0.3 {
		rad := angle * math.Pi / 180.0
		px := cx + int(float64(r)*math.Cos(rad))
		py := cy + int(float64(r)*math.Sin(rad))
		if px >= bounds.Min.X && px < bounds.Max.X && py >= bounds.Min.Y && py < bounds.Max.Y {
			img.SetRGBA(px, py, c)
		}
	}
}

func drawDiamond(img *image.RGBA, x1, y1, x2, y2, x3, y3, x4, y4 int, c color.RGBA) {
	minY := min4(y1, y2, y3, y4)
	maxY := max4(y1, y2, y3, y4)
	bounds := img.Bounds()
	for y := minY; y <= maxY; y++ {
		if y < bounds.Min.Y || y >= bounds.Max.Y {
			continue
		}
		var xs []int
		edges := [][4]int{{x1, y1, x2, y2}, {x2, y2, x3, y3}, {x3, y3, x4, y4}, {x4, y4, x1, y1}}
		for _, e := range edges {
			ax, ay, bx, by := e[0], e[1], e[2], e[3]
			if (ay <= y && by > y) || (by <= y && ay > y) {
				t := float64(y-ay) / float64(by-ay)
				x := ax + int(t*float64(bx-ax))
				xs = append(xs, x)
			}
		}
		if len(xs) >= 2 {
			lx, rx := xs[0], xs[1]
			if lx > rx {
				lx, rx = rx, lx
			}
			for x := lx; x <= rx; x++ {
				if x >= bounds.Min.X && x < bounds.Max.X {
					img.SetRGBA(x, y, c)
				}
			}
		}
	}
}

func drawTriangle(img *image.RGBA, x1, y1, x2, y2, x3, y3 int, c color.RGBA) {
	drawDiamond(img, x1, y1, x2, y2, x3, y3, x3, y3, c)
}

func min4(a, b, c, d int) int {
	m := a
	if b < m {
		m = b
	}
	if c < m {
		m = c
	}
	if d < m {
		m = d
	}
	return m
}

func max4(a, b, c, d int) int {
	m := a
	if b > m {
		m = b
	}
	if c > m {
		m = c
	}
	if d > m {
		m = d
	}
	return m
}
