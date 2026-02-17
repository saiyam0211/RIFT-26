package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/services"
	"gorm.io/gorm"
)

type SeatAllocatorHandler struct {
	db *gorm.DB
}

func NewSeatAllocatorHandler(db *gorm.DB) *SeatAllocatorHandler {
	return &SeatAllocatorHandler{db: db}
}

// Blocks

func (h *SeatAllocatorHandler) CreateBlock(c *gin.Context) {
	var block models.Block
	if err := c.ShouldBindJSON(&block); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	block.City = "bengaluru" // Enforce Bengaluru for now as per requirements

	// Get max display order
	var maxOrder int
	h.db.Model(&models.Block{}).Select("COALESCE(MAX(display_order), 0)").Scan(&maxOrder)
	block.DisplayOrder = maxOrder + 1

	if err := h.db.Create(&block).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create block", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, block)
}

func (h *SeatAllocatorHandler) GetAllBlocks(c *gin.Context) {
	var blocks []models.Block
	if err := h.db.Where("is_active = ?", true).Order("display_order ASC").Find(&blocks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch blocks"})
		return
	}
	c.JSON(http.StatusOK, blocks)
}

func (h *SeatAllocatorHandler) UpdateBlock(c *gin.Context) {
	id := c.Param("id")
	var block models.Block
	if err := h.db.First(&block, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Block not found"})
		return
	}

	var updateData struct {
		Name         string `json:"name"`
		DisplayOrder int    `json:"display_order"`
		IsActive     *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if updateData.Name != "" {
		block.Name = updateData.Name
	}
	if updateData.DisplayOrder != 0 {
		block.DisplayOrder = updateData.DisplayOrder
	}
	if updateData.IsActive != nil {
		block.IsActive = *updateData.IsActive
	}

	if err := h.db.Save(&block).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update block"})
		return
	}

	c.JSON(http.StatusOK, block)
}

func (h *SeatAllocatorHandler) DeleteBlock(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Model(&models.Block{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete block"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Block deleted successfully"})
}

// Rooms

func (h *SeatAllocatorHandler) CreateRoom(c *gin.Context) {
	var room models.Room
	if err := c.ShouldBindJSON(&room); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get max display order for this block
	var maxOrder int
	h.db.Model(&models.Room{}).Where("block_id = ?", room.BlockID).
		Select("COALESCE(MAX(display_order), 0)").Scan(&maxOrder)
	room.DisplayOrder = maxOrder + 1

	if err := h.db.Create(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusCreated, room)
}

func (h *SeatAllocatorHandler) GetRoomsByBlock(c *gin.Context) {
	blockID := c.Query("block_id")
	if blockID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "block_id query parameter is required"})
		return
	}

	var rooms []models.Room
	if err := h.db.Where("block_id = ? AND is_active = ?", blockID, true).
		Order("display_order ASC").Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

// Seats

// CreateSeatsGrid creates a grid of seats (rows x columns)
func (h *SeatAllocatorHandler) CreateSeatsGrid(c *gin.Context) {
	var req struct {
		RoomID uuid.UUID `json:"room_id" binding:"required"`
		Rows   int       `json:"rows" binding:"required,min=1"`
		Cols   int       `json:"cols" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify room exists
	var room models.Room
	if err := h.db.First(&room, "id = ?", req.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// Update room capacity
	newCapacity := req.Rows * req.Cols
	if err := h.db.Model(&room).Update("capacity", newCapacity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room capacity"})
		return
	}

	// Delete existing seats for this room (clean slate)
	// In production, we might want to check for allocations first
	if err := h.db.Unscoped().Where("room_id = ?", req.RoomID).Delete(&models.Seat{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear existing seats"})
		return
	}

	// Generate seats
	var seats []models.Seat
	rows := []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"} // Extend if needed

	for i := 0; i < req.Rows; i++ {
		rowLabel := "Row" + strconv.Itoa(i+1)
		if i < len(rows) {
			rowLabel = rows[i]
		}

		for j := 0; j < req.Cols; j++ {
			seatLabel := fmt.Sprintf("%s%d", rowLabel, j+1)
			seats = append(seats, models.Seat{
				RoomID:       req.RoomID,
				RowNumber:    i + 1,
				ColumnNumber: j + 1,
				SeatLabel:    seatLabel,
				IsAvailable:  true,
				IsActive:     true,
			})
		}
	}

	// Batch insert
	if err := h.db.CreateInBatches(seats, 100).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create seats"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": fmt.Sprintf("Created %d seats for room %s", len(seats), room.Name),
		"count":   len(seats),
	})
}

// CreateSeatsLayout creates seats from a visual layout and optionally saves full layout JSON (cells, walls, pillars, screens).
func (h *SeatAllocatorHandler) CreateSeatsLayout(c *gin.Context) {
	var req struct {
		RoomID uuid.UUID `json:"room_id" binding:"required"`
		Seats  []struct {
			RowNumber    int `json:"row_number" binding:"required,min=1"`
			ColumnNumber int `json:"column_number" binding:"required,min=1"`
		} `json:"seats"`
		Groups []struct {
			TeamSize  int `json:"team_size" binding:"required,oneof=2 3 4"`
			Positions []struct {
				RowNumber    int `json:"row_number" binding:"required,min=1"`
				ColumnNumber int `json:"column_number" binding:"required,min=1"`
			} `json:"positions" binding:"required,dive"`
		} `json:"groups"`
		Layout *struct {
			Rows   int               `json:"rows"`
			Cols   int               `json:"cols"`
			Cells  map[string]string `json:"cells"`  // "r,c" -> "seat"|"space"|"entrance"|"wall"|"pillar"|"screen"
			Groups []struct {
				ID        string   `json:"id"`
				Positions []string `json:"positions"` // "r,c"
				TeamSize  int      `json:"team_size"`
			} `json:"groups"`
		} `json:"layout"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate group sizes match positions
	for _, g := range req.Groups {
		if len(g.Positions) != g.TeamSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("group team_size %d must have exactly %d positions", g.TeamSize, g.TeamSize)})
			return
		}
	}

	var room models.Room
	if err := h.db.First(&room, "id = ?", req.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	if err := h.db.Unscoped().Where("room_id = ?", req.RoomID).Delete(&models.Seat{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear existing seats"})
		return
	}

	rowLabels := []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"}
	labelFor := func(row int) string {
		if row >= 1 && row <= len(rowLabels) {
			return rowLabels[row-1]
		}
		return "Row" + strconv.Itoa(row)
	}

	seen := make(map[string]bool)
	type pos struct{ RowNumber, ColumnNumber int }
	var singleSeats []pos
	for _, s := range req.Seats {
		key := fmt.Sprintf("%d,%d", s.RowNumber, s.ColumnNumber)
		if seen[key] {
			continue
		}
		seen[key] = true
		singleSeats = append(singleSeats, pos{s.RowNumber, s.ColumnNumber})
	}

	// Mark positions used by groups so we don't double-create
	for _, g := range req.Groups {
		for _, p := range g.Positions {
			seen[fmt.Sprintf("%d,%d", p.RowNumber, p.ColumnNumber)] = true
		}
	}

	var seats []models.Seat

	for _, pos := range singleSeats {
		seatLabel := fmt.Sprintf("%s%d", labelFor(pos.RowNumber), pos.ColumnNumber)
		seats = append(seats, models.Seat{
			RoomID:       req.RoomID,
			RowNumber:    pos.RowNumber,
			ColumnNumber: pos.ColumnNumber,
			SeatLabel:    seatLabel,
			IsAvailable:  true,
			IsActive:     true,
		})
	}

	for _, g := range req.Groups {
		groupID := uuid.New()
		teamSize := g.TeamSize
		for _, p := range g.Positions {
			seatLabel := fmt.Sprintf("%s%d", labelFor(p.RowNumber), p.ColumnNumber)
			seats = append(seats, models.Seat{
				RoomID:             req.RoomID,
				RowNumber:          p.RowNumber,
				ColumnNumber:       p.ColumnNumber,
				SeatLabel:          seatLabel,
				TeamSizePreference: &teamSize,
				SeatGroupID:        &groupID,
				IsAvailable:        true,
				IsActive:           true,
			})
		}
	}

	if len(seats) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one seat or group required"})
		return
	}

	if err := h.db.CreateInBatches(seats, 100).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create seats"})
		return
	}

	updates := map[string]interface{}{
		"capacity":          len(seats),
		"current_occupancy": 0,
	}
	if req.Layout != nil {
		layoutBytes, _ := json.Marshal(req.Layout)
		updates["layout_json"] = layoutBytes
	}
	if err := h.db.Model(&room).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": fmt.Sprintf("Created %d seats for room %s", len(seats), room.Name),
		"count":   len(seats),
	})
}

func (h *SeatAllocatorHandler) GetSeatsByRoom(c *gin.Context) {
	roomID := c.Param("room_id")

	var seats []models.Seat
	if err := h.db.Where("room_id = ? AND is_active = ?", roomID, true).
		Order("row_number ASC, column_number ASC").Find(&seats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch seats"})
		return
	}

	c.JSON(http.StatusOK, seats)
}

// GetRoomLayout returns the saved layout JSON for the room (for the canvas builder).
func (h *SeatAllocatorHandler) GetRoomLayout(c *gin.Context) {
	roomID := c.Param("room_id")

	var room models.Room
	if err := h.db.Select("id", "name", "layout_json").First(&room, "id = ?", roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var layout interface{}
	if len(room.LayoutJSON) > 0 {
		if err := json.Unmarshal(room.LayoutJSON, &layout); err != nil {
			c.JSON(http.StatusOK, gin.H{"room_id": room.ID, "room_name": room.Name, "layout": nil})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"room_id": room.ID, "room_name": room.Name, "layout": layout})
}

// GetRoomView returns layout plus allocations for this room: each team with name and list of (row, col) for merged display.
func (h *SeatAllocatorHandler) GetRoomView(c *gin.Context) {
	roomID := c.Param("room_id")

	var room models.Room
	if err := h.db.First(&room, "id = ?", roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var layout interface{}
	if len(room.LayoutJSON) > 0 {
		_ = json.Unmarshal(room.LayoutJSON, &layout)
	}

	var allocations []models.SeatAllocation
	if err := h.db.Preload("Team").Preload("Seat").
		Where("room_id = ?", roomID).
		Find(&allocations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch allocations"})
		return
	}

	// One allocation row per team: get positions from single seat or full seat group
	type teamAlloc struct {
		TeamID    string `json:"team_id"`
		TeamName  string `json:"team_name"`
		SeatLabel string `json:"seat_label"`
		Positions []struct{ Row int `json:"row"`; Col int `json:"col"` } `json:"positions"`
	}
	var teamAllocs []*teamAlloc
	for _, a := range allocations {
		ta := &teamAlloc{TeamID: a.TeamID.String()}
		if a.Team != nil {
			ta.TeamName = a.Team.TeamName
		}
		// SeatLabel: use denormalized if set, else build from seat(s)
		if a.Seat != nil {
			ta.SeatLabel = a.Seat.SeatLabel
			var seats []models.Seat
			if a.Seat.SeatGroupID != nil {
				_ = h.db.Where("room_id = ? AND seat_group_id = ?", a.RoomID, *a.Seat.SeatGroupID).
					Order("row_number ASC, column_number ASC").
					Find(&seats).Error
			}
			if len(seats) == 0 {
				seats = []models.Seat{*a.Seat}
			}
			for _, s := range seats {
				ta.Positions = append(ta.Positions, struct{ Row int `json:"row"`; Col int `json:"col"` }{s.RowNumber, s.ColumnNumber})
			}
			if len(seats) > 1 {
				combined := seats[0].SeatLabel
				for i := 1; i < len(seats); i++ {
					combined += "-" + seats[i].SeatLabel
				}
				ta.SeatLabel = combined
			}
		}
		teamAllocs = append(teamAllocs, ta)
	}

	c.JSON(http.StatusOK, gin.H{
		"room_id":     room.ID,
		"room_name":   room.Name,
		"layout":      layout,
		"allocations": teamAllocs,
	})
}

// slug normalizes a string for URL matching: lowercase, spaces to hyphens
func slug(s string) string {
	return strings.ToLower(strings.TrimSpace(strings.ReplaceAll(s, " ", "-")))
}

// GetPublicRoomView returns layout and allocations for a room by city and room name (slug).
// Public, no auth. For now only city "bengaluru" is supported.
// GET /api/v1/public/viewroom/:city/:roomname
func (h *SeatAllocatorHandler) GetPublicRoomView(c *gin.Context) {
	cityParam := strings.ToLower(strings.TrimSpace(c.Param("city")))
	roomnameParam := strings.TrimSpace(c.Param("roomname"))
	if roomnameParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room name required"})
		return
	}
	// Only Bengaluru supported for now
	if cityParam != "bengaluru" && cityParam != "blr" && cityParam != "bangalore" {
		c.JSON(http.StatusNotFound, gin.H{"error": "city not found or not supported"})
		return
	}

	// Match Bengaluru blocks: exact match or city containing bengaluru/bangalore
	var blocks []models.Block
	if err := h.db.Where(
		"LOWER(TRIM(city)) IN ? OR LOWER(TRIM(city)) LIKE ? OR LOWER(TRIM(city)) LIKE ?",
		[]string{"bengaluru", "blr", "bangalore"},
		"%bengaluru%", "%bangalore%",
	).Find(&blocks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to find blocks"})
		return
	}
	if len(blocks) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no blocks found for this city"})
		return
	}
	blockIDs := make([]uuid.UUID, len(blocks))
	for i := range blocks {
		blockIDs[i] = blocks[i].ID
	}

	var rooms []models.Room
	if err := h.db.Preload("Block").Where("block_id IN ?", blockIDs).Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find rooms"})
		return
	}
	targetSlug := slug(roomnameParam)
	var room models.Room
	var found bool
	for i := range rooms {
		// Match by slug (e.g. "robotics-lab" for "Robotics Lab") or exact name (e.g. "1" for "1")
		if slug(rooms[i].Name) == targetSlug || strings.TrimSpace(rooms[i].Name) == roomnameParam {
			room = rooms[i]
			found = true
			break
		}
	}
	if !found || room.ID == uuid.Nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	var layout interface{}
	if len(room.LayoutJSON) > 0 {
		_ = json.Unmarshal(room.LayoutJSON, &layout)
	}

	var allocations []models.SeatAllocation
	if err := h.db.Preload("Team").Preload("Seat").
		Where("room_id = ?", room.ID).
		Find(&allocations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch allocations"})
		return
	}

	type teamAlloc struct {
		TeamID    string `json:"team_id"`
		TeamName  string `json:"team_name"`
		SeatLabel string `json:"seat_label"`
		Positions []struct{ Row int `json:"row"`; Col int `json:"col"` } `json:"positions"`
	}
	var teamAllocs []*teamAlloc
	for _, a := range allocations {
		ta := &teamAlloc{TeamID: a.TeamID.String()}
		if a.Team != nil {
			ta.TeamName = a.Team.TeamName
		}
		if a.Seat != nil {
			ta.SeatLabel = a.Seat.SeatLabel
			var seats []models.Seat
			if a.Seat.SeatGroupID != nil {
				_ = h.db.Where("room_id = ? AND seat_group_id = ?", a.RoomID, *a.Seat.SeatGroupID).
					Order("row_number ASC, column_number ASC").
					Find(&seats).Error
			}
			if len(seats) == 0 {
				seats = []models.Seat{*a.Seat}
			}
			for _, s := range seats {
				ta.Positions = append(ta.Positions, struct{ Row int `json:"row"`; Col int `json:"col"` }{s.RowNumber, s.ColumnNumber})
			}
			if len(seats) > 1 {
				combined := seats[0].SeatLabel
				for i := 1; i < len(seats); i++ {
					combined += "-" + seats[i].SeatLabel
				}
				ta.SeatLabel = combined
			}
		}
		teamAllocs = append(teamAllocs, ta)
	}

	c.JSON(http.StatusOK, gin.H{
		"room_id":     room.ID,
		"room_name":   room.Name,
		"block_name":  func() string { if room.Block != nil { return room.Block.Name }; return "" }(),
		"layout":      layout,
		"allocations": teamAllocs,
	})
}

// MarkSeatsForTeamSize allows updating multiple seats to have a team preference
func (h *SeatAllocatorHandler) MarkSeatsForTeamSize(c *gin.Context) {
	var req struct {
		SeatIDs  []uuid.UUID `json:"seat_ids" binding:"required"`
		TeamSize *int        `json:"team_size"` // null to clear preference
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Model(&models.Seat{}).
		Where("id IN ?", req.SeatIDs).
		Update("team_size_preference", req.TeamSize).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update seats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Seats updated successfully"})
}

func (h *SeatAllocatorHandler) GetAllAllocations(c *gin.Context) {
	var allocations []models.SeatAllocation

	// Join with seats, rooms, blocks for names
	// For simplicity, fetching raw data + preloads
	// Ideally use a View or specific query for performance
	// OR retrieve populated data from db view if available.
	// For now gorm Preload:

	if err := h.db.Preload("Team").Preload("Seat").Preload("Room").Preload("Block").
		Order("allocated_at DESC").
		Find(&allocations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch allocations"})
		return
	}

	// Map to response with names (since models have them as `gorm:"-"`)
	type AllocationResponse struct {
		models.SeatAllocation
		TeamName string `json:"team_name"`
	}

	var response []AllocationResponse
	for _, allo := range allocations {
		resp := AllocationResponse{SeatAllocation: allo}
		if allo.Team != nil {
			resp.TeamName = allo.Team.TeamName
		}
		if allo.Block != nil {
			resp.BlockName = allo.Block.Name
		}
		if allo.Room != nil {
			resp.RoomName = allo.Room.Name
		}
		if allo.Seat != nil {
			resp.SeatLabel = allo.Seat.SeatLabel
		}
		response = append(response, resp)
	}

	c.JSON(http.StatusOK, response)
}

// GetAllocationStats returns seat allocation statistics (for admin dashboard)
func (h *SeatAllocatorHandler) GetAllocationStats(c *gin.Context) {
	stats, err := services.NewSeatAllocationService(h.db).GetAllocationStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}
