#!/bin/bash
# AutoScheduler — Linux Backup Script

echo ""
echo "====================================================="
echo " AutoScheduler — Backup Database"
echo "====================================================="
echo ""

DB_PATH="backend/app.db"
BACKUP_DIR="backups"

if [ ! -f "$DB_PATH" ]; then
    echo "[ERROR] Database file not found at $DB_PATH."
    echo "        Have you run the app yet?"
    echo ""
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
fi

# Formatted timestamp: YYYYMMDD_HHMMSS
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/app_$TIMESTAMP.db"

echo "Creating backup..."
cp "$DB_PATH" "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to create backup."
    echo ""
    exit 1
else
    echo ""
    echo "[SUCCESS] Backup created successfully!"
    echo "          Saved as: $BACKUP_FILE"
    echo ""
fi
