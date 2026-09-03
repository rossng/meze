#!/usr/bin/env bash
# Backs up the remote D1 database to a timestamped .sql file (schema + data).
# Read-only against the live database — safe to run anytime.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="meze"
BACKUP_DIR="backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT="${BACKUP_DIR}/${DB_NAME}-${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Exporting remote D1 database '${DB_NAME}' to ${OUTPUT}..."
npx wrangler d1 export "$DB_NAME" --remote --output "$OUTPUT"

echo "Backup written: ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
