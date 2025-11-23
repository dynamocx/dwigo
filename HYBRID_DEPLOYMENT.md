# 🚀 Hybrid Deployment Guide: Vercel (Frontend) + Render (Backend)

This guide walks you through deploying your frontend to Vercel and keeping your backend on Render.

---

## Step 1: Deploy Backend to Render (If Not Already Done)

### 1.1 Create Render Services
1. Go to [render.com](https://render.com) and sign in
2. Create a new **Blueprint** from your GitHub repo
3. Render will detect `render.yaml` and create:
   - ✅ PostgreSQL database (`dwigo-db`)
   - ✅ Redis instance (create manually if needed)
   - ✅ Web service (`dwigo-app`) - **This is your backend API**

### 1.2 Configure Backend Environment Variables
In Render dashboard, add these to your `dwigo-app` service:

**Required:**
```
NODE_ENV=production
PORT=10000
DATABASE_URL=<from database connection string>
REDIS_URL=<from Redis connection string>
JWT_SECRET=<generate random string>
ADMIN_API_TOKEN=<generate random string>
MIN_DEAL_QUALITY_SCORE=0.4
AUTO_REJECT_QUALITY_SCORE=0.25
ENABLE_SCHEDULER=true
JOB_WORKER_CONCURRENCY=3
```

### 1.3 Get Your Backend URL
After deployment, your backend will be at:
```
https://dwigo-app.onrender.com
```

**Note:** On free tier, backend spins down after 15 min of inactivity. First request will be slow (~30s).

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Sign Up / Sign In
1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up" → "Continue with GitHub"
3. Authorize Vercel

### 2.2 Import Project
1. Click "Add New Project"
2. Find `dynamocx/dwigo` repository
3. Click "Import"

### 2.3 Configure Project
Vercel will auto-detect Vite! Use these settings:

**Project Settings:**
- **Framework Preset:** Vite (auto-detected)
- **Root Directory:** `client` (or leave blank if using root)
- **Build Command:** `npm run build` (or `cd client && npm run build`)
- **Output Directory:** `dist` (or `client/dist`)
- **Install Command:** `npm install` (or `cd client && npm install`)

**If Root Directory is blank:**
- Build Command: `cd client && npm run build`
- Output Directory: `client/dist`
- Install Command: `cd client && npm install`

### 2.4 Set Environment Variables
In Vercel project settings → Environment Variables, add:

```
VITE_API_URL=https://dwigo-app.onrender.com/api
```

**Important:** Replace `dwigo-app.onrender.com` with your actual Render backend URL!

### 2.5 Deploy!
Click "Deploy" and Vercel will:
- ✅ Install dependencies
- ✅ Build your Vite app
- ✅ Deploy to global CDN
- ✅ Give you a URL like `https://dwigo.vercel.app`

---

## Step 3: Test the Connection

### 3.1 Test Frontend
1. Open your Vercel URL: `https://dwigo.vercel.app`
2. Check browser console for errors
3. Try logging in or viewing deals

### 3.2 Test Backend Connection
1. Open browser DevTools → Network tab
2. Look for API calls to `/api/deals`, `/api/auth`, etc.
3. They should go to: `https://dwigo-app.onrender.com/api/...`

### 3.3 Common Issues

**Issue: CORS errors**
- **Fix:** Update Render backend CORS settings in `server/index.js`:
  ```javascript
  app.use(cors({
    origin: [
      'https://dwigo.vercel.app',
      'https://your-custom-domain.vercel.app',
      'http://localhost:5173' // for local dev
    ],
    credentials: true,
  }));
  ```

**Issue: Backend not responding**
- **Fix:** Render free tier spins down. First request takes ~30s. Consider upgrading to keep it warm.

**Issue: 404 on API calls**
- **Fix:** Check `VITE_API_URL` in Vercel environment variables. Should end with `/api`.

---

## Step 4: Custom Domain (Optional)

### 4.1 Frontend Domain
1. In Vercel dashboard → Settings → Domains
2. Add your custom domain (e.g., `app.dwigo.com`)
3. Follow DNS instructions

### 4.2 Backend Domain
1. In Render dashboard → Settings → Custom Domain
2. Add subdomain (e.g., `api.dwigo.com`)
3. Update `VITE_API_URL` in Vercel to use new domain

---

## Step 5: Keep Services Running (Optional)

### 5.1 Render Free Tier Limitations
- Backend spins down after 15 min inactivity
- First request after spin-down takes ~30s
- Database and Redis stay running

### 5.2 Solutions
**Option A: Upgrade Render ($7/month)**
- Backend stays warm
- Faster response times
- Background workers available

**Option B: Use Uptime Monitor**
- Free service like [UptimeRobot](https://uptimerobot.com)
- Pings your backend every 5 min
- Keeps it warm (free tier allows this)

**Option C: Accept Cold Starts**
- Fine for testing/beta
- Users wait ~30s on first request
- Subsequent requests are fast

---

## Architecture Overview

```
┌─────────────────┐
│   Vercel CDN    │  ← Frontend (React/Vite)
│  dwigo.vercel   │     - Fast global CDN
│      .app       │     - Free tier
└────────┬────────┘     - Auto-deployments
         │
         │ API Calls
         │ (VITE_API_URL)
         ▼
┌─────────────────┐
│  Render Backend │  ← Backend (Express)
│ dwigo-app.on    │     - PostgreSQL database
│    render.com   │     - Redis cache
│                 │     - Background workers
└─────────────────┘     - Free tier (spins down)
```

---

## Quick Reference

### Frontend (Vercel)
- **URL:** `https://dwigo.vercel.app`
- **Build:** Automatic on git push
- **Env Var:** `VITE_API_URL=https://dwigo-app.onrender.com/api`

### Backend (Render)
- **URL:** `https://dwigo-app.onrender.com`
- **API:** `https://dwigo-app.onrender.com/api`
- **Database:** Managed PostgreSQL
- **Redis:** Managed Redis
- **Workers:** Available on paid plan

### Local Development
```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
cd client && npm run dev

# Set in client/.env:
VITE_API_URL=http://localhost:3001/api
```

---

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Deploy frontend to Vercel
3. ✅ Test connection
4. ✅ Set up custom domain (optional)
5. ✅ Configure uptime monitor (optional)

**Ready to deploy?** Start with Step 1!

