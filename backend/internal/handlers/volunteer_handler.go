package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/middleware"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/services"
)

type VolunteerHandler struct {
	checkinService         *services.CheckinService
	participantCheckinRepo *repository.ParticipantCheckInRepository
	teamRepo               *repository.TeamRepository
	volunteerRepo          *repository.VolunteerRepository
	seatAllocationService  *services.SeatAllocationService
}

func NewVolunteerHandler(
	checkinService *services.CheckinService,
	participantCheckinRepo *repository.ParticipantCheckInRepository,
	teamRepo *repository.TeamRepository,
	volunteerRepo *repository.VolunteerRepository,
	seatAllocationService *services.SeatAllocationService,
) *VolunteerHandler {
	return &VolunteerHandler{
		checkinService:         checkinService,
		participantCheckinRepo: participantCheckinRepo,
		teamRepo:               teamRepo,
		volunteerRepo:          volunteerRepo,
		seatAllocationService:  seatAllocationService,
	}
}

// ScanQR scans and decodes QR code (returns team with members)
// POST /api/v1/checkin/scan
func (h *VolunteerHandler) ScanQR(c *gin.Context) {
	var req struct {
		QRData string `json:"qr_data" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team, isCheckedIn, checkedInAt, err := h.checkinService.ScanQRCode(c.Request.Context(), req.QRData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Enforce that team has completed Final Confirmation (RSVP2) before scanning is allowed
	if !team.RSVP2Locked || team.Status != models.StatusRSVP2Done {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "This team has not completed Final Confirmation (RSVP2). They are not eligible for check-in.",
		})
		return
	}

	// Get participants already checked in (if any)
	var participantsCheckedIn []models.ParticipantCheckIn
	if isCheckedIn {
		participantsCheckedIn, _ = h.participantCheckinRepo.GetByTeamID(team.ID)
	}

	response := gin.H{
		"team":                    team,
		"already_checked_in":      isCheckedIn,
		"participants_checked_in": participantsCheckedIn,
	}

	if isCheckedIn && checkedInAt != nil {
		response["checked_in_at"] = checkedInAt
	}

	c.JSON(http.StatusOK, response)
}

// CheckInParticipants checks in selected participants for a team
// POST /api/v1/checkin/participants
func (h *VolunteerHandler) CheckInParticipants(c *gin.Context) {
	var req models.CheckInRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get volunteer info from JWT
	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer ID not found"})
		return
	}

	// Get volunteer city from JWT for location validation
	volunteerCity, _ := c.Get("city")
	cityStr, _ := volunteerCity.(string)

	// Get team details early to validate location (city) and eligibility
	team, err := h.teamRepo.GetByID(c.Request.Context(), req.TeamID)
	if err != nil || team == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get team"})
		return
	}

	// Ensure team city matches volunteer city (e.g. BLR/PUNE/etc.)
	if cityStr != "" && team.City != nil && string(*team.City) != cityStr {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team location does not match your location"})
		return
	}

	// Enforce Final Confirmation completed (RSVP2) for any check-in
	if !team.RSVP2Locked || team.Status != models.StatusRSVP2Done {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "This team has not completed Final Confirmation (RSVP2). You cannot check in this team.",
		})
		return
	}

	// At least 2 participants must be selected for check-in
	if len(req.Participants) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least 2 participants must be selected to check in a team.",
		})
		return
	}

	// Create participant check-ins without table_id (table concept removed)
	checkIns := make([]models.ParticipantCheckIn, len(req.Participants))
	now := time.Now()

	for i, participant := range req.Participants {
		checkIns[i] = models.ParticipantCheckIn{
			ID:              uuid.New(),
			TeamID:          req.TeamID,
			TeamMemberID:    participant.MemberID,
			VolunteerID:     volunteerID,
			TableID:         nil, // No table_id - table concept removed
			ParticipantName: participant.Name,
			ParticipantRole: participant.Role,
			CheckedInAt:     now,
		}
	}

	// Save to database
	err = h.participantCheckinRepo.CreateBatch(checkIns)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.CheckInResponse{
		Team:                  team,
		ParticipantsCheckedIn: checkIns,
		AlreadyCheckedIn:      false,
		Message:               "Participants checked in successfully",
	})
}

// GetCheckInHistory gets check-in history for the volunteer
// GET /api/v1/checkin/history
func (h *VolunteerHandler) GetCheckInHistory(c *gin.Context) {
	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer ID not found"})
		return
	}

	// Get limit from query (default 50)
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit > 200 {
		limit = 50
	}

	// Get check-ins
	checkIns, err := h.participantCheckinRepo.GetByVolunteerID(volunteerID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Group by team
	teamMap := make(map[uuid.UUID][]models.ParticipantCheckIn)
	for _, checkIn := range checkIns {
		teamMap[checkIn.TeamID] = append(teamMap[checkIn.TeamID], checkIn)
	}

	// Build response
	history := make([]gin.H, 0, len(teamMap))
	for teamID, participants := range teamMap {
		team, _ := h.teamRepo.GetByID(c.Request.Context(), teamID)
		isConfirmed, confirmedAt, _ := h.participantCheckinRepo.IsTeamConfirmed(teamID)

		teamName := "Unknown"
		if team != nil {
			teamName = team.TeamName
		}

		entry := gin.H{
			"team_id":            teamID,
			"team_name":          teamName,
			"checked_in_at":      participants[0].CheckedInAt,
			"participants_count": len(participants),
			"participants":       participants,
			"table_confirmed":    isConfirmed,
		}

		if confirmedAt != nil {
			entry["table_confirmed_at"] = confirmedAt
		}

		history = append(history, entry)
	}

	c.JSON(http.StatusOK, gin.H{"check_ins": history})
}

// UndoCheckIn undoes a team check-in (removes all participant check-ins)
// DELETE /api/v1/checkin/:team_id
func (h *VolunteerHandler) UndoCheckIn(c *gin.Context) {
	teamIDStr := c.Param("team_id")
	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer ID not found"})
		return
	}

	err = h.participantCheckinRepo.DeleteByTeamID(teamID, volunteerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Check-in undone successfully"})
}

// ConfirmTable marks a team as confirmed by volunteer (mark as done)
// POST /api/v1/table/confirm
func (h *VolunteerHandler) ConfirmTable(c *gin.Context) {
	var req struct {
		TeamID uuid.UUID `json:"team_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer ID not found"})
		return
	}

	// Update team status to checked_in
	err := h.teamRepo.UpdateTeamStatus(c.Request.Context(), req.TeamID, models.StatusCheckedIn)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update team status: " + err.Error()})
		return
	}

	// Create confirmation record (no table_id - table concept removed)
	confirmation := &models.TableConfirmation{
		TeamID:      req.TeamID,
		VolunteerID: volunteerID,
		TableID:     nil, // No table_id - table concept removed
	}

	err = h.participantCheckinRepo.CreateTableConfirmation(confirmation)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team confirmed successfully"})
}

// AllocateSeat allocates a Bengaluru seat to a team (table volunteer).
// POST /api/v1/table/allocate-seat
// Body: team_id (required), block_name (optional) — e.g. "A (17th Floor)" or "B (12th Floor)". If block is full, allocates in another block.
func (h *VolunteerHandler) AllocateSeat(c *gin.Context) {
	var req struct {
		TeamID    uuid.UUID `json:"team_id" binding:"required"`
		BlockName string    `json:"block_name"` // optional: volunteer's preferred block
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer ID not found"})
		return
	}

	// Verify team is from Bengaluru (seat allocation only available for BLR)
	team, err := h.teamRepo.GetByID(c.Request.Context(), req.TeamID)
	if err != nil || team == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team not found"})
		return
	}
	if team.City == nil || string(*team.City) != "BLR" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Seat allocation only available for Bengaluru teams"})
		return
	}

	if h.seatAllocationService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Seat allocation not configured"})
		return
	}

	// Use volunteer's chosen block if provided; otherwise no preference (any block)
	var preferredBlockName *string
	if strings.TrimSpace(req.BlockName) != "" {
		block := strings.TrimSpace(req.BlockName)
		preferredBlockName = &block
	}

	// Check if seat already allocated - return existing allocation instead of error
	existingAllocation, err := h.seatAllocationService.GetTeamAllocation(req.TeamID)
	if err == nil && existingAllocation != nil {
		c.JSON(http.StatusOK, gin.H{
			"message":    "Seat already allocated",
			"block_name": existingAllocation.BlockName,
			"room_name":  existingAllocation.RoomName,
			"seat_label": existingAllocation.SeatLabel,
			"team_size":  existingAllocation.TeamSize,
		})
		return
	}

	allocation, err := h.seatAllocationService.AllocateSeat(req.TeamID, volunteerID, preferredBlockName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Seat allocated successfully",
		"block_name": allocation.BlockName,
		"room_name":  allocation.RoomName,
		"seat_label": allocation.SeatLabel,
		"team_size":  allocation.TeamSize,
	})
}

// GetVolunteerLogs gets logs for a specific volunteer (admin only)
// GET /api/v1/admin/volunteers/:id/logs
func (h *VolunteerHandler) GetVolunteerLogs(c *gin.Context) {
	idStr := c.Param("id")
	volunteerID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid volunteer ID"})
		return
	}

	// Fetch check-ins (Scanner activity)
	checkIns, err := h.participantCheckinRepo.GetByVolunteerID(volunteerID, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch check-ins"})
		return
	}

	// Fetch confirmations (Table Viewer activity)
	confirmations, err := h.participantCheckinRepo.GetConfirmationsByVolunteerID(volunteerID, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch confirmations"})
		return
	}

	// Combine into logs
	type LogEntry struct {
		Type      string      `json:"type"` // "check_in" or "confirmation"
		Timestamp time.Time   `json:"timestamp"`
		TeamID    uuid.UUID   `json:"team_id"`
		TeamName  string      `json:"team_name"`
		Details   interface{} `json:"details"`
	}

	logs := make([]LogEntry, 0)

	// Process Check-ins (Group by TeamID to avoid duplicate log entries for same team)
	checkInMap := make(map[uuid.UUID][]models.ParticipantCheckIn)
	for _, ci := range checkIns {
		checkInMap[ci.TeamID] = append(checkInMap[ci.TeamID], ci)
	}

	for teamID, participants := range checkInMap {
		team, _ := h.teamRepo.GetByID(c.Request.Context(), teamID)
		teamName := "Unknown"
		if team != nil {
			teamName = team.TeamName
		}

		logs = append(logs, LogEntry{
			Type:      "check_in",
			Timestamp: participants[0].CheckedInAt,
			TeamID:    teamID,
			TeamName:  teamName,
			Details: gin.H{
				"participants_count": len(participants),
				"participants":       participants,
			},
		})
	}

	// Process Confirmations
	for _, conf := range confirmations {
		team, _ := h.teamRepo.GetByID(c.Request.Context(), conf.TeamID)
		teamName := "Unknown"
		if team != nil {
			teamName = team.TeamName
		}

		logs = append(logs, LogEntry{
			Type:      "confirmation",
			Timestamp: conf.ConfirmedAt,
			TeamID:    conf.TeamID,
			TeamName:  teamName,
			Details:   gin.H{},
		})
	}

	// Sort logs by timestamp desc
	// simple bubble sort for now (arrays are small) or just leave unsorted (client can sort)
	// Let's rely on client logic or unsorted merge since lists are pre-sorted individually.
	// Actually, let's just return them.

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

// GetPendingTeams gets teams checked in by this volunteer but not yet confirmed
// GET /api/v1/table/pending
func (h *VolunteerHandler) GetPendingTeams(c *gin.Context) {
	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer ID not found"})
		return
	}

	// Get volunteer city from JWT (set during login) - more reliable than DB lookup
	volunteerCityValue, cityExists := c.Get("city")
	volunteerCity := ""
	if cityExists {
		volunteerCity, _ = volunteerCityValue.(string)
	}

	// If city not in JWT, try to get from DB (fallback)
	if volunteerCity == "" {
		volunteer, err := h.volunteerRepo.GetByID(volunteerID)
		if err == nil && volunteer != nil {
			volunteerCity = volunteer.City
		}
	}

	// Query check-ins by volunteer_id (no table concept - each volunteer sees their own check-ins)
	since := time.Now().Add(-24 * time.Hour) // Last 24 hours
	checkIns, err := h.participantCheckinRepo.GetByVolunteerID(volunteerID, 200)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch check-ins: " + err.Error()})
		return
	}

	// Filter by time window
	filteredCheckIns := make([]models.ParticipantCheckIn, 0)
	for _, checkIn := range checkIns {
		if checkIn.CheckedInAt.After(since) {
			filteredCheckIns = append(filteredCheckIns, checkIn)
		}
	}

	fmt.Printf("[GetPendingTeams] Found %d check-ins for volunteer %v (after time filter: %d)\n", len(checkIns), volunteerID, len(filteredCheckIns))

	// Group by team (all check-ins are for this volunteer)
	teamMap := make(map[uuid.UUID][]models.ParticipantCheckIn)
	for _, checkIn := range filteredCheckIns {
		teamMap[checkIn.TeamID] = append(teamMap[checkIn.TeamID], checkIn)
	}

	fmt.Printf("[GetPendingTeams] Grouped into %d unique teams\n", len(teamMap))

	// Build pending teams list (exclude confirmed ones)
	pendingTeams := make([]gin.H, 0)
	for teamID, participants := range teamMap {
		isConfirmed, _, err := h.participantCheckinRepo.IsTeamConfirmed(teamID)
		if err != nil {
			// Log error but continue processing other teams
			fmt.Printf("[GetPendingTeams] Error checking confirmation for team %v: %v\n", teamID, err)
		}
		if isConfirmed {
			fmt.Printf("[GetPendingTeams] Team %v already confirmed, skipping\n", teamID)
			continue // Skip confirmed teams
		}

		team, err := h.teamRepo.GetByID(c.Request.Context(), teamID)
		if err != nil {
			fmt.Printf("[GetPendingTeams] Error fetching team %v: %v\n", teamID, err)
			continue // Skip if team not found
		}
		if team == nil {
			fmt.Printf("[GetPendingTeams] Team %v is nil, skipping\n", teamID)
			continue // Skip if team is nil
		}

		// Normalize city comparison (handle case differences and "Bangalore" vs "BLR")
		teamCityStr := ""
		if team.City != nil {
			teamCityStr = string(*team.City)
		}

		// Normalize both cities for comparison (case-insensitive)
		normalizeCity := func(city string) string {
			cityLower := strings.ToLower(strings.TrimSpace(city))
			if cityLower == "bangalore" || cityLower == "bengaluru" || cityLower == "blr" {
				return "BLR"
			}
			// Return uppercase for other cities (PUNE, NOIDA, LKO)
			return strings.ToUpper(cityLower)
		}

		teamCityNormalized := normalizeCity(teamCityStr)
		volunteerCityNormalized := normalizeCity(volunteerCity)

		// Ensure team location matches volunteer city (if volunteer has city set)
		if volunteerCity != "" && teamCityStr != "" && teamCityNormalized != volunteerCityNormalized {
			fmt.Printf("[GetPendingTeams] Team %v city mismatch: team=%s (normalized=%s), volunteer=%s (normalized=%s), skipping\n",
				teamID, teamCityStr, teamCityNormalized, volunteerCity, volunteerCityNormalized)
			continue // Skip teams from different cities
		}

		fmt.Printf("[GetPendingTeams] Adding team %v (%s) to pending list\n", teamID, team.TeamName)

		teamData := gin.H{
			"team":               team,
			"participants":       participants,
			"checked_in_at":      participants[0].CheckedInAt,
			"participants_count": len(participants),
		}

		// Check if team already has a seat allocated (for BLR teams)
		if teamCityNormalized == "BLR" && h.seatAllocationService != nil {
			allocation, err := h.seatAllocationService.GetTeamAllocation(teamID)
			if err == nil && allocation != nil {
				teamData["seat_allocation"] = gin.H{
					"block_name": allocation.BlockName,
					"room_name":  allocation.RoomName,
					"seat_label": allocation.SeatLabel,
					"team_size":  allocation.TeamSize,
				}
			}
		}

		pendingTeams = append(pendingTeams, teamData)
	}

	fmt.Printf("[GetPendingTeams] Returning %d pending teams\n", len(pendingTeams))
	c.JSON(http.StatusOK, gin.H{"pending_teams": pendingTeams})
}
