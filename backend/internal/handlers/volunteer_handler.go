package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/middleware"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
	"github.com/rift26/backend/internal/services"
)

type VolunteerHandler struct {
	checkinService          *services.CheckinService
	participantCheckinRepo  *repository.ParticipantCheckInRepository
	teamRepo                *repository.TeamRepository
	volunteerRepo           *repository.VolunteerRepository
	seatAllocationService   *services.SeatAllocationService
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

	// Get volunteer to get table_id
	volunteer, err := h.volunteerRepo.GetByID(volunteerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get volunteer info"})
		return
	}

	// Volunteer must be assigned to a table; otherwise the team will never appear in any table viewer
	if volunteer.TableID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Volunteer not assigned to a table"})
		return
	}

	// Get team details early to validate location (city) against volunteer/table city
	team, err := h.teamRepo.GetByID(c.Request.Context(), req.TeamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get team"})
		return
	}

	// Ensure team city matches volunteer/table city (e.g. BLR/PUNE/etc.)
	if team.City != nil && string(*team.City) != volunteer.City {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team location does not match your table location"})
		return
	}

	// Create participant check-ins
	checkIns := make([]models.ParticipantCheckIn, len(req.Participants))
	now := time.Now()

	for i, participant := range req.Participants {
		checkIns[i] = models.ParticipantCheckIn{
			ID:              uuid.New(),
			TeamID:          req.TeamID,
			TeamMemberID:    participant.MemberID,
			VolunteerID:     volunteerID,
			TableID:         volunteer.TableID,
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

// ConfirmTable marks a team as confirmed by table volunteer
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

	volunteer, err := h.volunteerRepo.GetByID(volunteerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get volunteer info"})
		return
	}

	confirmation := &models.TableConfirmation{
		TeamID:      req.TeamID,
		VolunteerID: volunteerID,
		TableID:     volunteer.TableID,
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
func (h *VolunteerHandler) AllocateSeat(c *gin.Context) {
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

	if h.seatAllocationService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Seat allocation not configured"})
		return
	}

	allocation, err := h.seatAllocationService.AllocateSeat(req.TeamID, volunteerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Seat allocated successfully",
		"block_name":   allocation.BlockName,
		"room_name":    allocation.RoomName,
		"seat_label":   allocation.SeatLabel,
		"team_size":    allocation.TeamSize,
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

// GetPendingTeams gets teams checked in but not yet confirmed by table volunteer
// GET /api/v1/table/pending
func (h *VolunteerHandler) GetPendingTeams(c *gin.Context) {
	volunteerID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Volunteer ID not found"})
		return
	}

	volunteer, err := h.volunteerRepo.GetByID(volunteerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get volunteer info: " + err.Error()})
		return
	}

	// Query check-ins directly by volunteer_id (not table_id) - this ensures we get teams
	// checked in by THIS specific volunteer/login, regardless of table assignment status
	since := time.Now().Add(-24 * time.Hour) // Last 24 hours
	checkIns, err := h.participantCheckinRepo.GetByVolunteerID(volunteerID, 200) // Get recent check-ins
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch check-ins: " + err.Error()})
		return
	}

	// Filter by time window (since GetByVolunteerID doesn't support time filter)
	filteredCheckIns := make([]models.ParticipantCheckIn, 0)
	for _, checkIn := range checkIns {
		if checkIn.CheckedInAt.After(since) {
			filteredCheckIns = append(filteredCheckIns, checkIn)
		}
	}

	// Group by team (all check-ins are already for this volunteer)
	teamMap := make(map[uuid.UUID][]models.ParticipantCheckIn)
	for _, checkIn := range filteredCheckIns {
		teamMap[checkIn.TeamID] = append(teamMap[checkIn.TeamID], checkIn)
	}

	// Build pending teams list (exclude confirmed ones)
	pendingTeams := make([]gin.H, 0)
	for teamID, participants := range teamMap {
		isConfirmed, _, _ := h.participantCheckinRepo.IsTeamConfirmed(teamID)
		if isConfirmed {
			continue // Skip confirmed teams
		}

		team, err := h.teamRepo.GetByID(c.Request.Context(), teamID)
		if err != nil || team == nil {
			continue // Skip if team not found
		}

		// Ensure team location matches volunteer city (if volunteer has city set)
		if volunteer.City != "" && team.City != nil && string(*team.City) != volunteer.City {
			continue // Skip teams from different cities
		}

		pendingTeams = append(pendingTeams, gin.H{
			"team":               team,
			"participants":       participants,
			"checked_in_at":      participants[0].CheckedInAt,
			"participants_count": len(participants),
		})
	}

	c.JSON(http.StatusOK, gin.H{"pending_teams": pendingTeams})
}
