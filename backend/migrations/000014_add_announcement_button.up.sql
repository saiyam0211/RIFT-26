-- Migration 000014: Add optional button to announcements

ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS button_text VARCHAR(255),
ADD COLUMN IF NOT EXISTS button_url TEXT;

