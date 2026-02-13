-- Drop tables in reverse order due to foreign key constraints
DROP INDEX IF EXISTS idx_allocations_seat;
DROP INDEX IF EXISTS idx_allocations_team;
DROP INDEX IF EXISTS idx_blocks_display_order;
DROP INDEX IF EXISTS idx_rooms_display_order;
DROP INDEX IF EXISTS idx_rooms_block;
DROP INDEX IF EXISTS idx_seats_team_size;
DROP INDEX IF EXISTS idx_seats_availability;
DROP INDEX IF EXISTS idx_seats_room;

DROP TABLE IF EXISTS seat_allocations;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS blocks;
