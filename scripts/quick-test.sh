#!/bin/bash

# DWIGO Quick Test Script
# Tests if everything is set up correctly

echo "🧪 DWIGO Quick Test"
echo "=================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: PostgreSQL
echo "1. Testing PostgreSQL..."
if psql -d dwigo -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is running and database 'dwigo' exists${NC}"
else
    echo -e "${RED}❌ PostgreSQL connection failed${NC}"
    echo "   Run: brew services start postgresql"
    exit 1
fi

# Test 2: Redis
echo "2. Testing Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${RED}❌ Redis is not running${NC}"
    echo "   Run: brew services start redis"
    exit 1
fi

# Test 3: Environment files
echo "3. Testing environment files..."
if [ -f "server/.env" ]; then
    echo -e "${GREEN}✅ server/.env exists${NC}"
else
    echo -e "${RED}❌ server/.env not found${NC}"
    echo "   Run: cp server/.env.example server/.env"
    exit 1
fi

if [ -f "client/.env" ]; then
    echo -e "${GREEN}✅ client/.env exists${NC}"
else
    echo -e "${RED}❌ client/.env not found${NC}"
    echo "   Run: cp client/.env.example client/.env"
    exit 1
fi

# Test 4: Admin tokens match
echo "4. Testing admin tokens..."
SERVER_TOKEN=$(grep ADMIN_API_TOKEN server/.env | cut -d '=' -f2)
CLIENT_TOKEN=$(grep VITE_ADMIN_API_TOKEN client/.env | cut -d '=' -f2)

if [ "$SERVER_TOKEN" == "$CLIENT_TOKEN" ]; then
    echo -e "${GREEN}✅ Admin tokens match${NC}"
else
    echo -e "${YELLOW}⚠️  Admin tokens don't match${NC}"
    echo "   Server: $SERVER_TOKEN"
    echo "   Client: $CLIENT_TOKEN"
fi

# Test 5: API server (if running)
echo "5. Testing API server..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API server is running${NC}"
else
    echo -e "${YELLOW}⚠️  API server is not running${NC}"
    echo "   Run: cd server && npm run dev"
fi

# Test 6: Frontend (if running)
echo "6. Testing frontend..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is not running${NC}"
    echo "   Run: cd client && npm run dev"
fi

echo ""
echo "=================="
echo -e "${GREEN}✅ Quick test complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start API server: cd server && npm run dev"
echo "2. Start worker: cd server && npm run worker"
echo "3. Start frontend: cd client && npm run dev"
echo "4. Test ingestion: cd server && npm run ingest:seed"
echo "5. Open admin page: http://localhost:5173/admin/ingestion"

