-- Migration: 005_add_email_to_otps
-- Add email support to OTP table for email-based OTP authentication

-- Add email column to otps table
ALTER TABLE otps ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Make phone nullable since we're switching to email-based OTP
ALTER TABLE otps ALTER COLUMN phone DROP NOT NULL;

-- Add index for email lookups (performance optimization)
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);

-- Add comment for documentation
COMMENT ON COLUMN otps.email IS 'Email address for email-based OTP authentication';
