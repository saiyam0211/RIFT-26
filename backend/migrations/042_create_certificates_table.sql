-- Migration: 042_create_certificates_table.sql
-- Creates the certificates table for verifiable hackathon certificates

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_name TEXT NOT NULL,
    participant_email TEXT NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    team_name TEXT NOT NULL,
    cert_type TEXT NOT NULL CHECK (cert_type IN ('participant', 'semi_finalist')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (participant_email, cert_type)
);

CREATE INDEX IF NOT EXISTS idx_certificates_email ON certificates(participant_email);
CREATE INDEX IF NOT EXISTS idx_certificates_team_id ON certificates(team_id);
