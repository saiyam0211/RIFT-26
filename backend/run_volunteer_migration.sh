#!/bin/bash

# Load .env file
export $(cat .env | grep -v '^#' | xargs)

# Run the volunteer migration
psql "$DATABASE_URL" -f migrations/000009_create_volunteers.up.sql

echo "✅ Volunteer migration completed!"
