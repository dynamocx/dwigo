# 🚀 DWIGO Quick Start Guide

**Goal:** Get a working beta up and running as fast as possible!

---

## ✅ Pre-Flight Check (Already Done!)

- ✅ Redis is running
- ✅ PostgreSQL is installed and running
- ✅ Database `dwigo` exists with schema loaded
- ✅ `.env` files created with secure tokens
- ✅ Admin tokens configured and matching

---

## 🎯 Start Everything (3 Terminal Windows)

### Terminal 1: API Server
```bash
cd server
npm run dev
```

**What to look for:**
- `DWIGO Server running on port 3001`
- `Connected to PostgreSQL database`
- `[Redis] connection ready`

**If you see errors:**
- Database connection error → Check PostgreSQL is running: `brew services list`
- Redis connection error → Check Redis is running: `redis-cli ping`

---

### Terminal 2: Background Worker
```bash
cd server
npm run worker
```

**What to look for:**
- Worker ready messages
- Job processing logs

**What this does:** Processes ingestion jobs (crawls, promotes deals, etc.)

---

### Terminal 3: Frontend
```bash
cd client
npm run dev
```

**What to look for:**
- Vite dev server URL (usually `http://localhost:5173`)
- No compilation errors

---

## 🧪 Test the Ingestion Flow (Terminal 4 or after services are running)

### Step 1: Seed Sample Data
```bash
cd server
npm run ingest:seed
```

**What this does:** Creates sample deals in the ingestion queue.

**Expected output:**
- `Enqueued ingestion job for Mid-Michigan pilot seed.`

---

### Step 2: Check Admin Review Page

1. Open browser: `http://localhost:5173/admin/ingestion`
2. You should see pending deals (may take a few seconds if worker is processing)

**If you see "Unauthorized":**
- Check `client/.env` has `VITE_ADMIN_API_TOKEN` matching `server/.env` `ADMIN_API_TOKEN`
- Both should be: `9KXQVOTKdRv7si5r5ihFpsDUqrMG99hUw+yv23er66c=`

---

### Step 3: Promote Deals

1. In the admin page, select one or more deals
2. Click "Promote Selected"
3. Deals should move from "pending" to "promoted"

---

### Step 4: View Live Deals

1. Open browser: `http://localhost:5173/deals`
2. Promoted deals should appear in the deals list

---

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
# Install dependencies
cd server && npm install
cd ../client && npm install
```

### "Database connection error"
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Start if not running
brew services start postgresql

# Verify connection
psql -d dwigo -c "SELECT 1;"
```

### "Redis connection error"
```bash
# Check Redis is running
redis-cli ping

# Start if not running
brew services start redis
```

### "Unauthorized" on admin page
- Check `server/.env` has `ADMIN_API_TOKEN=9KXQVOTKdRv7si5r5ihFpsDUqrMG99hUw+yv23er66c=`
- Check `client/.env` has `VITE_ADMIN_API_TOKEN=9KXQVOTKdRv7si5r5ihFpsDUqrMG99hUw+yv23er66c=`
- Restart the frontend: `Ctrl+C` then `npm run dev`

### Port already in use
- Change `PORT=3001` to `PORT=3002` in `server/.env`
- Update `VITE_API_URL=http://localhost:3002` in `client/.env`
- Restart both server and client

---

## 📊 What's Working

### ✅ Consumer Features
- Deals page: View all deals
- Personalized deals: AI-powered recommendations
- Preferences: User preference management
- Agents: AI travel concierge
- Rewards: Points and rewards system

### ✅ Admin Features
- Ingestion review: Review and promote deals
- Deal management: Promote/reject ingested deals

### ✅ Technical Features
- Ingestion pipeline: Crawl → Process → Review → Promote
- Background jobs: BullMQ workers for async processing
- Analytics: Event tracking
- Feature flags: A/B testing support

---

## 🎯 Next Steps for Beta

### High Priority
1. **Add More Deals:** Run more crawlers or manually add deals
2. **Test Consumer Flow:** Register user → Set preferences → View deals
3. **Test Location Services:** Enable location → View nearby deals
4. **Build Deal Detail Pages:** Full deal view with merchant info

### Medium Priority
1. **Merchant Portal:** Dashboard for merchants to manage deals
2. **More Crawlers:** Expand ingestion sources
3. **Search & Filters:** Search deals, filter by category/location
4. **Saved Deals:** View/manage saved deals

### Lower Priority
1. **AI Recommendations:** Improve personalization algorithm
2. **Push Notifications:** Location-based notifications
3. **Mobile App:** Wrap in React Native or Capacitor

---

## 🚢 Ready for Beta?

### Checklist
- [ ] All 3 services running (API, Worker, Frontend)
- [ ] Can access `http://localhost:5173`
- [ ] Can access admin page: `http://localhost:5173/admin/ingestion`
- [ ] Can seed deals: `npm run ingest:seed`
- [ ] Can promote deals in admin page
- [ ] Can view promoted deals: `http://localhost:5173/deals`
- [ ] Can register/login: `http://localhost:5173/register`
- [ ] Can set preferences: `http://localhost:5173/preferences`

### Once Checklist is Complete
You're ready to:
1. Add real deals (crawl more sources or manual entry)
2. Test with real users
3. Deploy to staging/production
4. Start selling!

---

## 💡 Quick Commands Reference

```bash
# Start everything
cd server && npm run dev        # Terminal 1: API
cd server && npm run worker     # Terminal 2: Worker
cd client && npm run dev        # Terminal 3: Frontend

# Test ingestion
cd server && npm run ingest:seed          # Seed sample data
cd server && npm run ingest:promote       # Promote pending deals
cd server && npm run ingest:crawl:lansing # Crawl Lansing Brewery

# Database
psql -d dwigo -c "SELECT COUNT(*) FROM deals;"           # Count deals
psql -d dwigo -c "SELECT COUNT(*) FROM ingested_deal_raw WHERE status='pending';"  # Count pending
psql -d dwigo -c "SELECT COUNT(*) FROM ingested_deal_raw WHERE status='promoted';" # Count promoted

# Health checks
curl http://localhost:3001/api/health                    # API health
redis-cli ping                                           # Redis health
psql -d dwigo -c "SELECT 1;"                            # Database health
```

---

## 🎓 Need Help?

- Check terminal logs for errors
- Check browser console for frontend errors
- Verify all 3 services are running
- Check `.env` files match between server and client
- Review `SETUP_GUIDE.md` for detailed setup instructions

---

**You're all set! Let's build something amazing! 🚀**

