#!/bin/bash
# Run ps_submissions migrations (000023 create table, 000025 add custom_fields).
# Usage: DATABASE_URL="postgresql://..." ./run_ps_submissions_migrations.sh
# Or: export DATABASE_URL=... then ./run_ps_submissions_migrations.sh

set -e
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  echo "Usage: DATABASE_URL=\"postgresql://user:pass@host/db?sslmode=require\" $0"
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Running 000023_ps_submissions.up.sql..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/migrations/000023_ps_submissions.up.sql"
echo "Running 000025_ps_submissions_custom_fields.up.sql..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/migrations/000025_ps_submissions_custom_fields.up.sql"
echo "Done."
