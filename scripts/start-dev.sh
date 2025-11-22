#!/bin/bash

# DWIGO Development Startup Script
# Starts all services in separate terminal windows (macOS)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting DWIGO Development Environment${NC}"
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "This script is designed for macOS. For other platforms, start services manually:"
    echo "  Terminal 1: cd server && npm run dev"
    echo "  Terminal 2: cd server && npm run worker"
    echo "  Terminal 3: cd client && npm run dev"
    exit 1
fi

# Function to open a new terminal window and run a command
open_terminal() {
    local title=$1
    local command=$2
    osascript -e "tell application \"Terminal\" to do script \"cd $PROJECT_ROOT && echo '=== $title ===' && $command\""
}

echo "Opening terminal windows..."

# Terminal 1: API Server
echo "  📡 Starting API server..."
open_terminal "DWIGO API Server" "cd server && npm run dev"
sleep 2

# Terminal 2: Worker
echo "  🔄 Starting background worker..."
open_terminal "DWIGO Worker" "cd server && npm run worker"
sleep 2

# Terminal 3: Frontend
echo "  🎨 Starting frontend..."
open_terminal "DWIGO Frontend" "cd client && npm run dev"
sleep 2

echo ""
echo -e "${GREEN}✅ All services starting!${NC}"
echo ""
echo "Services are starting in separate terminal windows."
echo ""
echo "📋 Next Steps:"
echo "  1. Wait for all services to start (check terminal windows)"
echo "  2. Open browser: http://localhost:5173"
echo "  3. Test ingestion: cd server && npm run ingest:seed"
echo "  4. Open admin page: http://localhost:5173/admin/ingestion"
echo ""
echo "💡 To stop all services: Close the terminal windows or press Ctrl+C in each"
echo ""
echo "📖 For more info: See QUICK_START.md"

