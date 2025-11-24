# 🗄️ Database Setup Guide

## The Problem
Your Render PostgreSQL database exists but the tables haven't been created yet. You're seeing:
```
error: relation "deals" does not exist
```

## The Solution
Run the database schema to create all tables.

---

## Option 1: Run Script Locally (Easiest)

### Step 1: Get Your Database Connection String
1. Go to **Render Dashboard** → **Databases** → **`dwigo-db`**
2. Click on the database
3. Find **"Internal Database URL"** or **"Connection String"**
4. Copy it (looks like: `postgres://dwigo_user:password@dpg-xxxxx-a/dwigo`)

### Step 2: Run the Setup Script
```bash
cd server
DATABASE_URL="your-connection-string-here" node scripts/setupDatabase.js
```

Replace `your-connection-string-here` with the actual connection string from Render.

**Example:**
```bash
cd server
DATABASE_URL="postgres://dwigo_user:abc123@dpg-xxxxx-a/dwigo" node scripts/setupDatabase.js
```

### Step 3: Verify
You should see:
```
✅ Connected to database
✅ Schema executed successfully!
📊 Created tables:
   ✅ deals
   ✅ merchants
   ✅ users
   ... (more tables)
🎉 Database setup complete!
```

---

## Option 2: Use Render Shell (Alternative)

If you can't run locally, you can use Render's shell:

1. **Render Dashboard** → **Services** → **`dwigo-app`**
2. Click **"Shell"** tab (or look for terminal/shell option)
3. Run:
   ```bash
   cd server
   node scripts/setupDatabase.js
   ```
   (DATABASE_URL should already be set as an environment variable)

---

## Option 3: Use psql Directly

If you have `psql` installed locally:

1. Get connection string from Render (same as Option 1)
2. Run:
   ```bash
   psql "your-connection-string" -f server/schema.sql
   ```

---

## After Setup

Once tables are created:
1. ✅ Backend will stop showing "relation does not exist" errors
2. ✅ API endpoints will work
3. ✅ CORS should work (Redis is already connected)
4. ✅ Your Vercel app should load deals!

---

## Quick Test

After running the schema, test the API:
```bash
curl https://dwigo-app.onrender.com/api/health
```

Should return: `{"status":"OK","timestamp":"..."}`

---

**Which option do you want to use?** Option 1 (local script) is usually easiest!

