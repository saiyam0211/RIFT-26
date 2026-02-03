#!/bin/bash

# RIFT Database Migration Runner for NeonDB
# Run this to apply migration 000008_add_tickets.up.sql

echo "🚀 RIFT Database Migration Runner (NeonDB)"
echo "==========================================="
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
MIGRATION_FILE="/Users/saiyam0211/Documents/RIFT/backend/migrations/000008_add_tickets.up.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Migration file: 000008_add_tickets.up.sql"
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
echo "  • tickets table"
echo "  • announcements table"
echo "  • email_logs table"
echo "  • edit_allowed_until column in teams table"
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
    psql "$DATABASE_URL" -c "\dt" | grep -E "tickets|announcements|email_logs"
    echo ""
    echo "🔍 Checking teams table for edit_allowed_until column..."
    psql "$DATABASE_URL" -c "\d teams" | grep "edit_allowed_until"
    echo ""
    echo "🎉 Done! Migration complete."
    echo ""
    echo "📋 Next steps:"
    echo "  1. Copy handler files from BACKEND_COMPLETE_IMPLEMENTATION.md"
    echo "  2. Update email service methods"
    echo "  3. Wire up routes in main.go"
    echo "  4. Rebuild and test backend"
else
    echo ""
    echo "❌ Migration failed"
    echo "Please check the error messages above"
    exit 1
fi
