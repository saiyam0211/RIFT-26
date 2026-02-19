package services

import (
	"errors"
	"fmt"
	"sort"

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
func (s *SeatAllocationService) AllocateSeat(teamID uuid.UUID, volunteerID uuid.UUID, preferredBlockName *string) (*models.SeatAllocation, error) {
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
		return nil, errors.New("team size could not be determined (member_count or team_members is empty)")
	}

	// Try preferred block first; if no merged cell for this team size in that block, try next blocks (any block in order)
	seats, err := s.findBestAvailableSeats(tx, teamSize, preferredBlockName)
	if err != nil && preferredBlockName != nil && *preferredBlockName != "" {
		seats, err = s.findBestAvailableSeats(tx, teamSize, nil)
	}
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

	// Build combined label for display (e.g. "A1-A2" or "A1-A2-A3")
	combinedLabel := seats[0].SeatLabel
	for i := 1; i < len(seats); i++ {
		combinedLabel += "-" + seats[i].SeatLabel
	}

	// Schema has UNIQUE(team_id): create only ONE row per team (first seat in group).
	alloc := &models.SeatAllocation{
		TeamID:      teamID,
		SeatID:      seats[0].ID,
		BlockID:     room.BlockID,
		RoomID:      seats[0].RoomID,
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

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	return alloc, nil
}

// baseJoin returns a fresh query chain for Bengaluru seat lookups (do not reuse; GORM has no Clone).
func baseJoin(tx *gorm.DB, preferredBlockName *string) *gorm.DB {
	query := tx.Model(&models.Seat{}).
		Joins("JOIN rooms ON rooms.id = seats.room_id").
		Joins("JOIN blocks ON blocks.id = rooms.block_id").
		Where("seats.is_available = ? AND seats.is_active = ? AND rooms.is_active = ? AND blocks.is_active = ?",
			true, true, true, true).
		Where("blocks.city = ?", "bengaluru")

	if preferredBlockName != nil && *preferredBlockName != "" {
		query = query.Where("blocks.name = ?", *preferredBlockName)
	}

	return query
}

// findBestAvailableSeats returns one or more seats (a group) for the given team size.
// Teams of 2, 3, or 4: only seats with matching team_size_preference and same seat_group_id (all available).
// Team of 1: single seat with team_size_preference IS NULL (or unset).
func (s *SeatAllocationService) findBestAvailableSeats(tx *gorm.DB, teamSize int, preferredBlockName *string) ([]*models.Seat, error) {
	if teamSize >= 2 && teamSize <= 4 {
		// Strict: only merged groups of exactly this team size (all seats in group available).
		// Order: 1st block, 1st room, then row A (row 1), 1st column — deterministic, not random.
		var candidates []models.Seat
		err := baseJoin(tx, preferredBlockName).
			Where("seats.team_size_preference = ? AND seats.seat_group_id IS NOT NULL", teamSize).
			Order("blocks.display_order ASC, rooms.display_order ASC, seats.row_number ASC, seats.column_number ASC").
			Find(&candidates).Error
		if err != nil || len(candidates) == 0 {
			return nil, errors.New("no available seats for this team size")
		}
		// Group by seat_group_id
		byGroup := make(map[uuid.UUID][]*models.Seat)
		for i := range candidates {
			if candidates[i].SeatGroupID == nil {
				continue
			}
			gid := *candidates[i].SeatGroupID
			byGroup[gid] = append(byGroup[gid], &candidates[i])
		}
		// Consider groups in the same order as candidates (1st block, 1st room, row A, col 1 first)
		seenGroup := make(map[uuid.UUID]bool)
		for i := range candidates {
			if candidates[i].SeatGroupID == nil {
				continue
			}
			gid := *candidates[i].SeatGroupID
			if seenGroup[gid] {
				continue
			}
			seenGroup[gid] = true
			groupSeats := byGroup[gid]
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
				// Return seats in row-then-column order (A row, 1st column first)
				sort.Slice(groupSeats, func(i, j int) bool {
					if groupSeats[i].RowNumber != groupSeats[j].RowNumber {
						return groupSeats[i].RowNumber < groupSeats[j].RowNumber
					}
					return groupSeats[i].ColumnNumber < groupSeats[j].ColumnNumber
				})
				return groupSeats, nil
			}
		}
		return nil, errors.New("no available seats for this team size")
	}

	// Team of 1: single seat, prefer no team_size_preference (solo seat)
	var seat models.Seat
	err := baseJoin(tx, preferredBlockName).
		Where("seats.team_size_preference IS NULL").
		Order("blocks.display_order ASC, rooms.display_order ASC, seats.row_number ASC, seats.column_number ASC").
		First(&seat).Error
	if err != nil {
		err = baseJoin(tx, preferredBlockName).
			Order("blocks.display_order ASC, rooms.display_order ASC, seats.row_number ASC, seats.column_number ASC").
			First(&seat).Error
	}
	if err != nil {
		return nil, errors.New("no available seats found")
	}
	return []*models.Seat{&seat}, nil
}

// getTeamSize returns the team's original size (member_count) for seat allocation.
// Allocation is based on registered team size, not how many participants checked in.
func (s *SeatAllocationService) getTeamSize(tx *gorm.DB, teamID uuid.UUID) (int, error) {
	var team models.Team
	err := tx.Select("member_count").First(&team, teamID).Error
	if err != nil {
		return 0, err
	}
	size := team.MemberCount
	if size <= 0 {
		// Fallback: count team_members if member_count not set
		var count int64
		if err := tx.Table("team_members").Where("team_id = ?", teamID).Count(&count).Error; err != nil {
			return 0, err
		}
		size = int(count)
	}
	return size, nil
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
		// If seat is part of a group, build combined label from all seats in group
		if allocation.Seat.SeatGroupID != nil {
			var groupSeats []models.Seat
			if err := s.db.Where("room_id = ? AND seat_group_id = ?", allocation.RoomID, *allocation.Seat.SeatGroupID).
				Order("row_number ASC, column_number ASC").
				Find(&groupSeats).Error; err == nil && len(groupSeats) > 0 {
				combined := groupSeats[0].SeatLabel
				for i := 1; i < len(groupSeats); i++ {
					combined += "-" + groupSeats[i].SeatLabel
				}
				allocation.SeatLabel = combined
			}
		}
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

	// Teams by size (2, 3, 4 participants)
	teamsBySize := map[string]int64{"2": 0, "3": 0, "4": 0}
	for _, size := range []int{2, 3, 4} {
		var c int64
		s.db.Model(&models.SeatAllocation{}).Where("team_size = ?", size).Count(&c)
		teamsBySize[fmt.Sprint(size)] = c
	}
	stats["teams_by_size"] = teamsBySize

	// How many more teams of 2/3/4 can be accommodated: count full available seat groups per team size
	availableSlots := map[string]int64{"2": 0, "3": 0, "4": 0}
	for _, size := range []int{2, 3, 4} {
		var c int64
		// Groups where all seats in the group are available and group size matches
		s.db.Raw(`
			SELECT COUNT(*) FROM (
				SELECT seat_group_id FROM seats
				WHERE seat_group_id IS NOT NULL AND team_size_preference = ? AND is_active = true
				GROUP BY seat_group_id
				HAVING COUNT(*) = ? AND SUM(CASE WHEN is_available THEN 1 ELSE 0 END) = ?
			) t
		`, size, size, size).Scan(&c)
		availableSlots[fmt.Sprint(size)] = c
	}
	stats["available_slots_by_team_size"] = availableSlots

	// Per-room stats: block, room name, capacity, occupied (from actual allocations), available (Bengaluru only)
	// Occupied = SUM(team_size) from seat_allocations for that room (avoids stale rooms.current_occupancy)
	type RoomStatRow struct {
		BlockName      string
		RoomName       string
		Capacity       int
		Occupancy      int
		AvailableSeats int64
	}
	var roomStatRows []RoomStatRow

	s.db.Model(&models.Room{}).
		Select("blocks.name as block_name, rooms.name as room_name, rooms.capacity, (SELECT COALESCE(SUM(team_size), 0) FROM seat_allocations WHERE room_id = rooms.id) as occupancy, COUNT(seats.id) FILTER (WHERE seats.is_available = true) as available_seats").
		Joins("JOIN blocks ON blocks.id = rooms.block_id").
		Joins("LEFT JOIN seats ON seats.room_id = rooms.id AND seats.is_active = true").
		Where("rooms.is_active = ? AND blocks.is_active = ?", true, true).
		Where("LOWER(TRIM(blocks.city)) IN (?, ?, ?)", "bengaluru", "blr", "bangalore").
		Group("rooms.id, blocks.name, rooms.name, rooms.capacity, blocks.display_order, rooms.display_order").
		Order("blocks.display_order, rooms.display_order").
		Scan(&roomStatRows)

	// Normalize for JSON (snake_case) so frontend can rely on one format
	roomStats := make([]map[string]interface{}, 0, len(roomStatRows))
	for _, r := range roomStatRows {
		roomStats = append(roomStats, map[string]interface{}{
			"block_name":      r.BlockName,
			"room_name":      r.RoomName,
			"capacity":       r.Capacity,
			"current_occupancy": r.Occupancy,
			"available_seats": r.AvailableSeats,
		})
	}
	stats["room_stats"] = roomStats

	return stats, nil
}
