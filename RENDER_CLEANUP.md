# 🧹 Render Cleanup Guide

## Should You Delete Everything?

### ✅ **Delete if:**
- You have no important data in the database
- You want a clean slate
- Previous deployments were all failures
- You're starting fresh

### ❌ **Keep if:**
- You have deals/users in the database you want to keep
- You have a working database connection
- You want to reuse existing data

---

## Option A: Clean Slate (Recommended for Testing)

**Steps:**
1. Go to Render dashboard
2. Delete all services:
   - `dwigo-app` (web service)
   - `dwigo-worker` (if exists)
   - `dwigo-db` (database) - **⚠️ This deletes all data!**
   - `dwigo-redis` (if exists)
3. Delete any blueprints
4. Start fresh with new blueprint

**Pros:**
- ✅ Clean configuration
- ✅ No conflicts
- ✅ Fresh start

**Cons:**
- ❌ Lose all data
- ❌ Need to re-run migrations
- ❌ Need to re-ingest deals

---

## Option B: Keep Database, Recreate Service

**Steps:**
1. Go to Render dashboard
2. Delete only the web service (`dwigo-app`)
3. Keep the database (`dwigo-db`)
4. Create new blueprint (it will reuse existing database)

**Pros:**
- ✅ Keep your data
- ✅ Keep deals you've ingested
- ✅ Faster setup

**Cons:**
- ⚠️ Need to ensure database name matches in `render.yaml`

---

## Option C: Update Existing Blueprint

**Steps:**
1. Go to Render dashboard
2. Find your existing blueprint
3. Click "Sync" to pull latest `render.yaml`
4. Render will update services

**Pros:**
- ✅ Keep everything
- ✅ Minimal changes

**Cons:**
- ⚠️ Might have old config conflicts
- ⚠️ Need to manually update env vars

---

## My Recommendation

**For testing/beta:** Start fresh (Option A)
- You can always re-ingest deals
- Cleaner setup
- Less confusion

**If you have important data:** Keep database (Option B)
- Reuse existing PostgreSQL
- Just recreate the web service

---

## Quick Cleanup Steps

1. **Render Dashboard** → Services
2. For each service:
   - Click service name
   - Settings → Delete
   - Confirm deletion
3. **Render Dashboard** → Blueprints
4. Delete any existing blueprints
5. **Ready for fresh start!**

---

## After Cleanup

1. Create new Blueprint from GitHub
2. Render will create fresh services
3. Add environment variables
4. Deploy!

**Ready?** Choose your option and proceed!

