#!/bin/bash

# RIFT Database Migration Runner - Participant Check-ins
# Run this to apply migration 000012_create_participant_checkins.up.sql

echo "🚀 RIFT Database Migration Runner - Participant Check-ins"
echo "========================================================="
echo ""

# Load environment variables
if [ -f "/Users/saiyam0211/Documents/RIFT/.env" ]; then
    export $(cat /Users/saiyam0211/Documents/RIFT/.env | grep DATABASE_URL | xargs)
    echo "✅ Loaded DATABASE_URL from .env"
else
    echo "❌ .env file not found"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env"
    exit 1
fi

# Check if migration file exists
MIGRATION_FILE="/Users/saiyam0211/Documents/RIFT/backend/migrations/000012_create_participant_checkins.up.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Migration file: 000012_create_participant_checkins.up.sql"
echo "🗄️  Database: NeonDB (ap-southeast-1)"
echo ""

# Test connection
echo "🔌 Testing NeonDB connection..."
psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Failed to connect to NeonDB"
    echo ""
    echo "💡 Make sure you have PostgreSQL client installed:"
    echo "   brew install postgresql"
    exit 1
fi

echo "✅ NeonDB connection successful"
echo ""

# Show migration preview
echo "📋 Migration Preview"
echo "--------------------"
echo "This will create:"
echo "  • participant_check_ins table (track individual participant check-ins)"
echo "  • table_confirmations table (track when table volunteer marks team as done)"
echo "  • volunteer_table_id column in teams table"
echo "  • Indexes for performance"
echo ""

# Confirm
read -p "Apply this migration? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 0
fi

# Run migration
echo ""
echo "⚡ Applying migration to NeonDB..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Verifying tables..."
    echo ""
    psql "$DATABASE_URL" -c "\\dt" | grep -E "participant_check_ins|table_confirmations"
    echo ""
    echo "🔍 Checking teams table for volunteer_table_id column..."
    psql "$DATABASE_URL" -c "\\d teams" | grep "volunteer_table_id"
    echo ""
    echo "🎉 Done! Migration complete."
    echo ""
    echo "📋 Next steps:"
    echo "  1. Create ParticipantCheckIn model in backend"
    echo "  2. Create TableConfirmation model in backend"
    echo "  3. Update check-in handlers to accept participant arrays"
    echo "  4. Update scanner frontend to select participants"
    echo "  5. Rebuild and test backend"
else
    echo ""
    echo "❌ Migration failed"
    echo "Please check the error messages above"
    exit 1
fi
