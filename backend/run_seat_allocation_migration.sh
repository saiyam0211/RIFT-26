#!/bin/bash

set -e

# Load DATABASE_URL from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not set in .env"
    exit 1
fi

echo "🔄 Running seat allocation migration..."
echo "Database: ${DATABASE_URL%%\?*}"

# Run seat allocation migration
psql "$DATABASE_URL" -f migrations/000013_create_seat_allocation_system.up.sql

echo "✅ Seat allocation migration completed!"
