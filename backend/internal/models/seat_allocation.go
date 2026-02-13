package models

import (
	"time"

	"github.com/google/uuid"
)

// Block represents a physical block/building
type Block struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name         string    `json:"name" gorm:"type:varchar(100);not null"`
	City         string    `json:"city" gorm:"type:varchar(50);not null;default:'bengaluru'"`
	DisplayOrder int       `json:"display_order" gorm:"not null"`
	IsActive     bool      `json:"is_active" gorm:"default:true"`
	CreatedAt    time.Time `json:"created_at" gorm:"default:now()"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"default:now()"`
}

// Room represents a room within a block
type Room struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	BlockID          uuid.UUID `json:"block_id" gorm:"type:uuid;not null"`
	Name             string    `json:"name" gorm:"type:varchar(100);not null"`
	Capacity         int       `json:"capacity" gorm:"not null"`
	CurrentOccupancy int       `json:"current_occupancy" gorm:"default:0"`
	DisplayOrder     int       `json:"display_order" gorm:"not null"`
	IsActive         bool      `json:"is_active" gorm:"default:true"`
	CreatedAt        time.Time `json:"created_at" gorm:"default:now()"`
	UpdatedAt        time.Time `json:"updated_at" gorm:"default:now()"`

	// Relations
	Block *Block `json:"block,omitempty" gorm:"foreignKey:BlockID"`
}

// Seat represents an individual seat in a room
type Seat struct {
	ID                 uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	RoomID             uuid.UUID `json:"room_id" gorm:"type:uuid;not null"`
	RowNumber          int       `json:"row_number" gorm:"not null"`
	ColumnNumber       int       `json:"column_number" gorm:"not null"`
	SeatLabel          string    `json:"seat_label" gorm:"type:varchar(10);not null"`
	TeamSizePreference *int      `json:"team_size_preference" gorm:"default:null"`
	IsAvailable        bool      `json:"is_available" gorm:"default:true"`
	IsActive           bool      `json:"is_active" gorm:"default:true"`
	CreatedAt          time.Time `json:"created_at" gorm:"default:now()"`
	UpdatedAt          time.Time `json:"updated_at" gorm:"default:now()"`

	// Relations
	Room *Room `json:"room,omitempty" gorm:"foreignKey:RoomID"`
}

// SeatAllocation represents a seat assignment to a team
type SeatAllocation struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	TeamID      uuid.UUID `json:"team_id" gorm:"type:uuid;not null;uniqueIndex"`
	SeatID      uuid.UUID `json:"seat_id" gorm:"type:uuid;not null"`
	BlockID     uuid.UUID `json:"block_id" gorm:"type:uuid"`
	RoomID      uuid.UUID `json:"room_id" gorm:"type:uuid"`
	AllocatedBy uuid.UUID `json:"allocated_by" gorm:"type:uuid"`
	AllocatedAt time.Time `json:"allocated_at" gorm:"default:now()"`
	TeamSize    int       `json:"team_size" gorm:"not null"`

	// Relations
	Team      *Team      `json:"team,omitempty" gorm:"foreignKey:TeamID"`
	Seat      *Seat      `json:"seat,omitempty" gorm:"foreignKey:SeatID"`
	Block     *Block     `json:"block,omitempty" gorm:"foreignKey:BlockID"`
	Room      *Room      `json:"room,omitempty" gorm:"foreignKey:RoomID"`
	Volunteer *Volunteer `json:"volunteer,omitempty" gorm:"foreignKey:AllocatedBy"`

	// Denormalized fields for easy display
	BlockName string `json:"block_name,omitempty" gorm:"-"`
	RoomName  string `json:"room_name,omitempty" gorm:"-"`
	SeatLabel string `json:"seat_label,omitempty" gorm:"-"`
}

// TableName overrides
func (Block) TableName() string {
	return "blocks"
}

func (Room) TableName() string {
	return "rooms"
}

func (Seat) TableName() string {
	return "seats"
}

func (SeatAllocation) TableName() string {
	return "seat_allocations"
}
