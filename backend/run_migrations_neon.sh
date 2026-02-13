#!/bin/bash

# Script to run migrations on NeonDB
# Usage: ./run_migrations_neon.sh

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

echo "🔄 Running migrations on NeonDB..."
echo "Database: ${DATABASE_URL%%\?*}" # Print DB URL without query params

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ psql is not installed. Please install PostgreSQL client tools."
    echo "   On macOS: brew install postgresql"
    echo "   On Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Run each migration file in order
for migration in migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "📝 Running: $migration"
        psql "$DATABASE_URL" -f "$migration"
        if [ $? -eq 0 ]; then
            echo "✅ Success: $migration"
        else
            echo "❌ Failed: $migration"
            exit 1
        fi
    fi
done

echo ""
echo "✅ All migrations completed successfully!"
echo ""
echo "🔍 Verifying tables..."
psql "$DATABASE_URL" -c "\dt"
