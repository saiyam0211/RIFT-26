package services

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"gorm.io/gorm"
)

type SeatAllocationService struct {
	db *gorm.DB
}

func NewSeatAllocationService(db *gorm.DB) *SeatAllocationService {
	return &SeatAllocationService{db: db}
}

// AllocateSeat allocates a seat to a team using smart allocation logic
func (s *SeatAllocationService) AllocateSeat(teamID uuid.UUID, volunteerID uuid.UUID) (*models.SeatAllocation, error) {
	// Start transaction with proper isolation
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Check if team already has a seat allocated
	var existing models.SeatAllocation
	if err := tx.Where("team_id = ?", teamID).First(&existing).Error; err == nil {
		tx.Rollback()
		return nil, errors.New("team already has a seat allocated")
	}

	// Get team size (count checked-in participants)
	teamSize, err := s.getTeamSize(tx, teamID)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to get team size: %w", err)
	}

	if teamSize == 0 {
		tx.Rollback()
		return nil, errors.New("no participants checked in for this team")
	}

	// Find best available seat using smart allocation
	seat, err := s.findBestAvailableSeat(tx, teamSize)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("no available seats: %w", err)
	}

	// Lock the seat row for update
	if err := tx.Model(&models.Seat{}).
		Where("id = ? AND is_available = true", seat.ID).
		Update("is_available", false).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("seat was just allocated by another volunteer")
	}

	// Update room occupancy
	if err := tx.Model(&models.Room{}).
		Where("id = ?", seat.RoomID).
		UpdateColumn("current_occupancy", gorm.Expr("current_occupancy + ?", teamSize)).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update room occupancy: %w", err)
	}

	// Get room and block info for denormalized fields
	var room models.Room
	if err := tx.Preload("Block").First(&room, seat.RoomID).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to get room info: %w", err)
	}

	// Create allocation record
	allocation := &models.SeatAllocation{
		TeamID:      teamID,
		SeatID:      seat.ID,
		BlockID:     room.BlockID,
		RoomID:      seat.RoomID,
		AllocatedBy: volunteerID,
		TeamSize:    teamSize,
		BlockName:   room.Block.Name,
		RoomName:    room.Name,
		SeatLabel:   seat.SeatLabel,
	}

	if err := tx.Create(allocation).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create allocation: %w", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return allocation, nil
}

// findBestAvailableSeat implements smart allocation logic
func (s *SeatAllocationService) findBestAvailableSeat(tx *gorm.DB, teamSize int) (*models.Seat, error) {
	var seat models.Seat

	// Strategy 1: Try to find a seat with matching team_size_preference
	err := tx.Joins("JOIN rooms ON rooms.id = seats.room_id").
		Joins("JOIN blocks ON blocks.id = rooms.block_id").
		Where("seats.is_available = ? AND seats.is_active = ? AND rooms.is_active = ? AND blocks.is_active = ?",
			true, true, true, true).
		Where("seats.team_size_preference = ?", teamSize).
		Order("blocks.display_order ASC, rooms.display_order ASC, seats.row_number ASC, seats.column_number ASC").
		First(&seat).Error

	if err == nil {
		return &seat, nil
	}

	// Strategy 2: Find any available seat (no preference)
	err = tx.Joins("JOIN rooms ON rooms.id = seats.room_id").
		Joins("JOIN blocks ON blocks.id = rooms.block_id").
		Where("seats.is_available = ? AND seats.is_active = ? AND rooms.is_active = ? AND blocks.is_active = ?",
			true, true, true, true).
		Order("blocks.display_order ASC, rooms.display_order ASC, seats.row_number ASC, seats.column_number ASC").
		First(&seat).Error

	if err != nil {
		return nil, errors.New("no available seats found")
	}

	return &seat, nil
}

// getTeamSize counts checked-in participants for a team
func (s *SeatAllocationService) getTeamSize(tx *gorm.DB, teamID uuid.UUID) (int, error) {
	var count int64

	// Count checked-in participants
	err := tx.Model(&models.ParticipantCheckIn{}).
		Where("team_id = ?", teamID).
		Count(&count).Error

	if err != nil {
		return 0, err
	}

	return int(count), nil
}

// GetTeamAllocation retrieves the seat allocation for a team
func (s *SeatAllocationService) GetTeamAllocation(teamID uuid.UUID) (*models.SeatAllocation, error) {
	var allocation models.SeatAllocation

	err := s.db.Preload("Seat").
		Preload("Room").
		Preload("Block").
		Where("team_id = ?", teamID).
		First(&allocation).Error

	if err != nil {
		return nil, err
	}

	// Populate denormalized fields
	if allocation.Block != nil {
		allocation.BlockName = allocation.Block.Name
	}
	if allocation.Room != nil {
		allocation.RoomName = allocation.Room.Name
	}
	if allocation.Seat != nil {
		allocation.SeatLabel = allocation.Seat.SeatLabel
	}

	return &allocation, nil
}

// GetAllocationStats returns statistics about seat allocations
func (s *SeatAllocationService) GetAllocationStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total seats
	var totalSeats int64
	s.db.Model(&models.Seat{}).Where("is_active = ?", true).Count(&totalSeats)
	stats["total_seats"] = totalSeats

	// Available seats
	var availableSeats int64
	s.db.Model(&models.Seat{}).Where("is_available = ? AND is_active = ?", true, true).Count(&availableSeats)
	stats["available_seats"] = availableSeats

	// Allocated seats
	var allocatedSeats int64
	s.db.Model(&models.SeatAllocation{}).Count(&allocatedSeats)
	stats["allocated_seats"] = allocatedSeats

	// Total participants allocated
	var totalParticipants int64
	s.db.Model(&models.SeatAllocation{}).Select("COALESCE(SUM(team_size), 0)").Scan(&totalParticipants)
	stats["total_participants_allocated"] = totalParticipants

	// Per-room stats
	type RoomStat struct {
		BlockName        string
		RoomName         string
		Capacity         int
		CurrentOccupancy int
		AvailableSeats   int64
	}
	var roomStats []RoomStat

	s.db.Model(&models.Room{}).
		Select("blocks.name as block_name, rooms.name as room_name, rooms.capacity, rooms.current_occupancy, COUNT(seats.id) FILTER (WHERE seats.is_available = true) as available_seats").
		Joins("JOIN blocks ON blocks.id = rooms.block_id").
		Joins("LEFT JOIN seats ON seats.room_id = rooms.id AND seats.is_active = true").
		Where("rooms.is_active = ? AND blocks.is_active = ?", true, true).
		Group("blocks.name, rooms.name, rooms.capacity, rooms.current_occupancy").
		Order("blocks.display_order, rooms.display_order").
		Scan(&roomStats)

	stats["room_stats"] = roomStats

	return stats, nil
}
