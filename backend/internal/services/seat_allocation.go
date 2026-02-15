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

// AllocateSeat allocates a seat (or group of seats for teams of 2/3/4) to a team.
// Teams of 2/3/4 are allocated only to merged seats marked for that team size.
func (s *SeatAllocationService) AllocateSeat(teamID uuid.UUID, volunteerID uuid.UUID) (*models.SeatAllocation, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var existing models.SeatAllocation
	if err := tx.Where("team_id = ?", teamID).First(&existing).Error; err == nil {
		tx.Rollback()
		return nil, errors.New("team already has a seat allocated")
	}

	teamSize, err := s.getTeamSize(tx, teamID)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to get team size: %w", err)
	}
	if teamSize == 0 {
		tx.Rollback()
		return nil, errors.New("no participants checked in for this team")
	}

	seats, err := s.findBestAvailableSeats(tx, teamSize)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("no available seats: %w", err)
	}

	for _, seat := range seats {
		if err := tx.Model(&models.Seat{}).
			Where("id = ? AND is_available = true", seat.ID).
			Update("is_available", false).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("seat was just allocated by another volunteer")
		}
	}

	var room models.Room
	if err := tx.Preload("Block").First(&room, seats[0].RoomID).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to get room info: %w", err)
	}

	if err := tx.Model(&models.Room{}).
		Where("id = ?", seats[0].RoomID).
		UpdateColumn("current_occupancy", gorm.Expr("current_occupancy + ?", teamSize)).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update room occupancy: %w", err)
	}

	// Build combined label for display (e.g. "A1-A2")
	combinedLabel := seats[0].SeatLabel
	for i := 1; i < len(seats); i++ {
		combinedLabel += "-" + seats[i].SeatLabel
	}

	var firstAlloc *models.SeatAllocation
	for i, seat := range seats {
		alloc := &models.SeatAllocation{
			TeamID:      teamID,
			SeatID:      seat.ID,
			BlockID:     room.BlockID,
			RoomID:      seat.RoomID,
			AllocatedBy: volunteerID,
			TeamSize:    teamSize,
			BlockName:   room.Block.Name,
			RoomName:    room.Name,
			SeatLabel:   combinedLabel,
		}
		if err := tx.Create(alloc).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to create allocation: %w", err)
		}
		if i == 0 {
			firstAlloc = alloc
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	return firstAlloc, nil
}

// baseJoin returns a fresh query chain for Bengaluru seat lookups (do not reuse; GORM has no Clone).
func baseJoin(tx *gorm.DB) *gorm.DB {
	return tx.Model(&models.Seat{}).
		Joins("JOIN rooms ON rooms.id = seats.room_id").
		Joins("JOIN blocks ON blocks.id = rooms.block_id").
		Where("seats.is_available = ? AND seats.is_active = ? AND rooms.is_active = ? AND blocks.is_active = ?",
			true, true, true, true).
		Where("blocks.city = ?", "bengaluru")
}

// findBestAvailableSeats returns one or more seats (a group) for the given team size.
// Teams of 2, 3, or 4: only seats with matching team_size_preference and same seat_group_id (all available).
// Team of 1: single seat with team_size_preference IS NULL (or unset).
func (s *SeatAllocationService) findBestAvailableSeats(tx *gorm.DB, teamSize int) ([]*models.Seat, error) {
	if teamSize >= 2 && teamSize <= 4 {
		// Strict: only merged groups of exactly this team size (all seats in group available)
		var candidates []models.Seat
		err := baseJoin(tx).
			Where("seats.team_size_preference = ? AND seats.seat_group_id IS NOT NULL", teamSize).
			Order("blocks.display_order ASC, rooms.display_order ASC, seats.seat_group_id ASC, seats.row_number ASC, seats.column_number ASC").
			Find(&candidates).Error
		if err != nil || len(candidates) == 0 {
			return nil, errors.New("no available seats for this team size")
		}
		// Group by seat_group_id; return first group that has exactly teamSize and all available
		byGroup := make(map[uuid.UUID][]*models.Seat)
		for i := range candidates {
			if candidates[i].SeatGroupID == nil {
				continue
			}
			gid := *candidates[i].SeatGroupID
			byGroup[gid] = append(byGroup[gid], &candidates[i])
		}
		for _, groupSeats := range byGroup {
			if len(groupSeats) != teamSize {
				continue
			}
			allAvail := true
			for _, seat := range groupSeats {
				if !seat.IsAvailable {
					allAvail = false
					break
				}
			}
			if allAvail {
				return groupSeats, nil
			}
		}
		return nil, errors.New("no available seats for this team size")
	}

	// Team of 1: single seat, prefer no team_size_preference (solo seat)
	var seat models.Seat
	err := baseJoin(tx).
		Where("seats.team_size_preference IS NULL").
		Order("blocks.display_order ASC, rooms.display_order ASC, seats.row_number ASC, seats.column_number ASC").
		First(&seat).Error
	if err != nil {
		err = baseJoin(tx).
			Order("blocks.display_order ASC, rooms.display_order ASC, seats.row_number ASC, seats.column_number ASC").
			First(&seat).Error
	}
	if err != nil {
		return nil, errors.New("no available seats found")
	}
	return []*models.Seat{&seat}, nil
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
