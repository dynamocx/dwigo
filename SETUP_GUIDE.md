# DWIGO Setup & Testing Guide

This guide clearly separates **YOUR TASKS** (things you need to do) from **AUTO TASKS** (things the code will do for you).

---

## 🎯 Goal: Test the Ingestion Flow End-to-End

This will verify that:
1. Deals can be ingested (crawled/seeded)
2. Admin can review pending deals
3. Deals can be promoted to live
4. Promoted deals appear in the consumer app

---

## ✅ YOUR TASKS (Manual Steps)

### Step 1: Install Prerequisites (if not already installed)

```bash
# Check if PostgreSQL is installed
psql --version

# Check if Redis is installed
redis-cli --version

# If not installed on macOS:
brew install postgresql redis
```

**What this does:** PostgreSQL stores your data, Redis runs background jobs (ingestion queue).

---

### Step 2: Start PostgreSQL and Redis Services

```bash
# Start PostgreSQL (macOS)
brew services start postgresql

# Start Redis (macOS)
brew services start redis

# Verify they're running
psql -d postgres -c "SELECT 1;"  # Should return "1"
redis-cli ping                    # Should return "PONG"
```

**What this does:** Makes sure your database and job queue are available.

---

### Step 3: Create Database and Run Schema

```bash
# Create the database
createdb dwigo

# Run the schema (creates all tables)
psql -d dwigo -f server/schema.sql
```

**What this does:** Creates the `dwigo` database and all required tables (users, merchants, deals, ingestion tables, etc.).

**If you get an error:** The database might already exist. You can drop and recreate:
```bash
dropdb dwigo
createdb dwigo
psql -d dwigo -f server/schema.sql
```

---

### Step 4: Create Environment Variables File

**YOU NEED TO DO THIS:** Create a file at `server/.env` with your database credentials:

```bash
# Navigate to server directory
cd server

# Create .env file (I'll provide a template below)
```

**Copy this into `server/.env`:**
```env
# Database Configuration
DB_USER=postgres
DB_HOST=localhost
DB_NAME=dwigo
DB_PASSWORD=your_postgres_password_here
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# JWT Secret (for authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Admin API Token (for admin ingestion review)
ADMIN_API_TOKEN=your-admin-token-here-change-this

# Server Port
PORT=3001
```

**IMPORTANT:** 
- Replace `your_postgres_password_here` with your actual PostgreSQL password (or leave blank if no password)
- Replace `your-super-secret-jwt-key-change-this-in-production` with a random string
- Replace `your-admin-token-here-change-this` with a random string (e.g., `admin-secret-123`)

---

### Step 5: Create Frontend Environment Variables

**YOU NEED TO DO THIS:** Create a file at `client/.env`:

```bash
# Navigate to client directory
cd client

# Create .env file
```

**Copy this into `client/.env`:**
```env
# API Base URL
VITE_API_URL=http://localhost:3001

# Admin API Token (same as server)
VITE_ADMIN_API_TOKEN=your-admin-token-here-change-this
```

**IMPORTANT:** Use the same `ADMIN_API_TOKEN` value you used in `server/.env`.

---

### Step 6: Start the Services (3 Terminal Windows)

**Terminal 1 - API Server:**
```bash
cd server
npm run dev
```
**What to look for:** You should see "DWIGO Server running on port 3001" and "Connected to PostgreSQL database"

**Terminal 2 - Background Worker:**
```bash
cd server
npm run worker
```
**What to look for:** You should see worker ready messages (this processes ingestion jobs)

**Terminal 3 - Frontend:**
```bash
cd client
npm run dev
```
**What to look for:** You should see the Vite dev server URL (usually http://localhost:5173)

---

### Step 7: Test the Admin Ingestion Page

1. Open your browser to: `http://localhost:5173/admin/ingestion`
2. You should see the ingestion review page (may be empty if no pending deals)

**If you see an error:** Check the browser console and terminal logs.

---

## 🤖 AUTO TASKS (What I'll Create/Do)

### Task 1: Create Environment File Templates
- ✅ Create `server/.env.example` with all required variables
- ✅ Create `client/.env.example` with all required variables

### Task 2: Create Test Scripts
- ✅ Create a script to seed sample ingestion data
- ✅ Create a script to verify the flow works

### Task 3: Add Better Error Messages
- ✅ Improve error handling in admin routes
- ✅ Add logging for debugging

### Task 4: Create Testing Documentation
- ✅ This guide!

---

## 🧪 Testing the Ingestion Flow

Once everything is running, **YOU CAN DO THIS:**

### Option A: Use the Existing Seed Script

```bash
# In Terminal 4 (or after services are running)
cd server
npm run ingest:seed
```

This will create sample ingestion data. Then:

1. Go to `http://localhost:5173/admin/ingestion`
2. You should see pending deals
3. Select some deals and click "Promote"
4. Check `http://localhost:5173/deals` - promoted deals should appear

### Option B: Use the Lansing Brewery Crawler

```bash
# In Terminal 4
cd server
npm run ingest:crawl:lansing
```

This crawls real data from Lansing Brewery. Then follow the same steps as Option A.

---

## 🐛 Troubleshooting

### "Database connection error"
- Check PostgreSQL is running: `brew services list`
- Check your `server/.env` has correct database credentials
- Try: `psql -d dwigo -c "SELECT 1;"`

### "Redis connection error"
- Check Redis is running: `redis-cli ping`
- Start Redis: `brew services start redis`

### "Unauthorized" error on admin page
- Check `VITE_ADMIN_API_TOKEN` in `client/.env` matches `ADMIN_API_TOKEN` in `server/.env`
- Make sure both `.env` files exist and are in the correct directories

### "Cannot find module" errors
- Run `npm install` in both `server/` and `client/` directories
- Or run `npm run install-all` from the root directory

### Port already in use
- Change `PORT` in `server/.env` to a different port (e.g., 3002)
- Update `VITE_API_URL` in `client/.env` to match

---

## 📋 Quick Checklist

Before testing, make sure:
- [ ] PostgreSQL is installed and running
- [ ] Redis is installed and running
- [ ] Database `dwigo` exists and schema is loaded
- [ ] `server/.env` file exists with correct values
- [ ] `client/.env` file exists with correct values
- [ ] API server is running (Terminal 1)
- [ ] Worker is running (Terminal 2)
- [ ] Frontend is running (Terminal 3)
- [ ] Can access `http://localhost:5173`
- [ ] Can access `http://localhost:5173/admin/ingestion`

---

## 🎓 Next Steps After Testing

Once ingestion flow is working:
1. **Enhance Consumer Experience:** Build deal detail pages, search, filters
2. **Build Merchant Portal:** Create merchant dashboard for deal management
3. **Add More Crawlers:** Expand ingestion sources
4. **Implement AI Recommendations:** Basic personalization algorithm

---

## 💡 Questions?

If you get stuck:
1. Check the error message in the terminal/browser console
2. Verify all prerequisites are installed and running
3. Double-check environment variables match between server and client
4. Check that all three services (API, Worker, Frontend) are running

