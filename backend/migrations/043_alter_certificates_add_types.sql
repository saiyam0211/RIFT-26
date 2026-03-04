-- Migration: 043_alter_certificates_add_types.sql
-- Expands cert_type to support winner, volunteer, hod, custom
-- Adds optional position column for winners
-- Makes team fields nullable for non-team certs

-- 1. Drop the existing CHECK constraint on cert_type
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_cert_type_check;

-- 2. Add new CHECK with expanded values
ALTER TABLE certificates ADD CONSTRAINT certificates_cert_type_check
  CHECK (cert_type IN ('participant', 'semi_finalist', 'winner', 'volunteer', 'hod', 'custom'));

-- 3. Add position column (nullable — only used for winners and custom)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS position TEXT;

-- 4. Make team_id and team_name nullable (volunteers/HODs/custom don't belong to teams)
ALTER TABLE certificates ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE certificates ALTER COLUMN team_name DROP NOT NULL;

-- 5. Drop old unique constraint (was per email+cert_type) and recreate
--    so we allow same person to have e.g. participant + winner certs
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_participant_email_cert_type_key;
ALTER TABLE certificates ADD CONSTRAINT certificates_participant_email_cert_type_key
  UNIQUE (participant_email, cert_type);
