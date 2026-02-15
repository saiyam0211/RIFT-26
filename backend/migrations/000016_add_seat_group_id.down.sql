DROP INDEX IF EXISTS idx_seats_seat_group_id;
ALTER TABLE seats DROP COLUMN IF EXISTS seat_group_id;
