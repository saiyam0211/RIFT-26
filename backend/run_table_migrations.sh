#!/bin/bash

# Load .env file
export $(grep -v '^#' .env | xargs)

echo "🚀 Running table management migrations..."

# Run event_tables migration
echo "📋 Creating event_tables table..."
psql "$DATABASE_URL" -f migrations/000010_create_event_tables.up.sql

# Run volunteers update migration
echo "👥 Updating volunteers table..."
psql "$DATABASE_URL" -f migrations/000011_update_volunteers_for_tables.up.sql

echo "✅ Migrations complete!"
echo ""
echo "📊 Next steps:"
echo "1. Create tables in admin panel"
echo "2. Assign volunteers to tables"
echo "3. Volunteers login and see their assigned table"
