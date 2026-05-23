#!/bin/bash
# AutoScheduler — Linux Start Script

echo ""
echo "====================================================="
echo " AutoScheduler — Starting up on Linux..."
echo "====================================================="
echo ""

if [ ! -d "node_modules" ]; then
    echo "[!] It looks like you haven't run setup yet."
    echo "    Please run ./setup_linux.sh first."
    echo ""
    exit 1
fi

echo "Starting Frontend and Backend concurrently..."
echo "To stop the servers, press Ctrl+C."
echo ""

# Attempt to open the default web browser in the background after a short delay
(sleep 3 && xdg-open http://localhost:5173 &> /dev/null || open http://localhost:5173 &> /dev/null) &

# Run the development servers
npm run dev
