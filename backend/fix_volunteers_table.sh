#!/bin/bash

# Load .env file
export $(cat .env | grep -v '^#' | xargs)

# Run the fix
psql "$DATABASE_URL" -f /tmp/fix_volunteers.sql

echo "✅ Fixed volunteers table!"
