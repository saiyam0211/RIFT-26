-- Blocks (e.g., Block A, Block B)
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL DEFAULT 'bengaluru',
    display_order INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Rooms within blocks
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    current_occupancy INT DEFAULT 0,
    display_order INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual seats
CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    column_number INT NOT NULL,
    seat_label VARCHAR(10) NOT NULL,
    team_size_preference INT,
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(room_id, row_number, column_number)
);

-- Seat allocations
CREATE TABLE IF NOT EXISTS seat_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    seat_id UUID REFERENCES seats(id) ON DELETE CASCADE,
    block_id UUID REFERENCES blocks(id),
    room_id UUID REFERENCES rooms(id),
    allocated_by UUID REFERENCES volunteers(id),
    allocated_at TIMESTAMP DEFAULT NOW(),
    team_size INT NOT NULL,
    UNIQUE(team_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seats_room ON seats(room_id);
CREATE INDEX IF NOT EXISTS idx_seats_availability ON seats(is_available, is_active);
CREATE INDEX IF NOT EXISTS idx_seats_team_size ON seats(team_size_preference);
CREATE INDEX IF NOT EXISTS idx_rooms_block ON rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_rooms_display_order ON rooms(display_order);
CREATE INDEX IF NOT EXISTS idx_blocks_display_order ON blocks(display_order);
CREATE INDEX IF NOT EXISTS idx_allocations_team ON seat_allocations(team_id);
CREATE INDEX IF NOT EXISTS idx_allocations_seat ON seat_allocations(seat_id);
