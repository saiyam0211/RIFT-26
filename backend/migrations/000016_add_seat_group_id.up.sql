-- Add seat_group_id to seats for merged team seats (2, 3, or 4 seats allocated together)
ALTER TABLE seats ADD COLUMN IF NOT EXISTS seat_group_id UUID;
CREATE INDEX IF NOT EXISTS idx_seats_seat_group_id ON seats(seat_group_id);
