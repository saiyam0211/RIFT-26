package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create block"})
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
