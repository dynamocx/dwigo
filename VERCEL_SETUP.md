# 🚀 Vercel Deployment Guide

Vercel is perfect for Vite/React apps and will handle all the build issues we had with Render.

## Quick Setup (5 Minutes)

### Step 1: Sign Up
1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub

### Step 2: Import Project
1. Click "Add New Project"
2. Find your `dynamocx/dwigo` repository
3. Click "Import"

### Step 3: Configure (Vercel Auto-Detects Vite!)
Vercel will automatically detect:
- ✅ Framework: Vite
- ✅ Build Command: `cd client && npm run build`
- ✅ Output Directory: `client/dist`

**You can use the defaults!** Just click "Deploy"

### Step 4: Set Environment Variables
After deployment starts, add these in Vercel dashboard:

**Required:**
- `DATABASE_URL` - Your PostgreSQL connection string (from Render or new database)
- `REDIS_URL` - Your Redis connection string (from Render or new Redis)
- `JWT_SECRET` - Generate a random string
- `ADMIN_API_TOKEN` - Generate a random string

**Optional:**
- `NODE_ENV=production`
- `MIN_DEAL_QUALITY_SCORE=0.4`
- `AUTO_REJECT_QUALITY_SCORE=0.25`
- `ENABLE_SCHEDULER=true`
- `JOB_WORKER_CONCURRENCY=3`

### Step 5: Deploy!
Click "Deploy" and Vercel will:
- ✅ Install dependencies
- ✅ Build your Vite app
- ✅ Deploy to global CDN
- ✅ Give you a URL like `https://dwigo.vercel.app`

---

## Important: Backend API

**Note:** Vercel is great for the frontend, but your backend (Express server) needs to run somewhere else. Options:

### Option A: Keep Backend on Render (Recommended for now)
- Keep your Render database and Redis
- Deploy just the client to Vercel
- Point client API calls to your Render backend URL

### Option B: Deploy Backend to Vercel Serverless
- Convert Express routes to Vercel serverless functions
- More complex, but everything in one place

### Option C: Use Vercel for Frontend + Railway for Backend
- Vercel for client (free, fast)
- Railway for server + database (easy setup)

---

## Quick Start: Frontend Only on Vercel

For now, let's deploy just the frontend to Vercel:

1. **In Vercel setup:**
   - Root Directory: Leave blank (or set to `client`)
   - Framework Preset: Vite (auto-detected)
   - Build Command: `npm run build` (or `cd client && npm run build`)
   - Output Directory: `dist` (or `client/dist`)
   - Install Command: `npm install` (or `cd client && npm install`)

2. **Environment Variables:**
   - `VITE_API_URL` - Your Render backend URL (e.g., `https://dwigo-app.onrender.com/api`)

3. **Deploy!**

Your frontend will be on Vercel, backend stays on Render (or wherever you want).

---

## Next Steps After Deployment

1. ✅ Test the frontend URL
2. ✅ Update `VITE_API_URL` to point to your backend
3. ✅ Test on your phone! 📱
4. ✅ Share the URL with your team

---

## Cost

**Vercel Free Tier:**
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Perfect for testing and small projects

**Upgrade when needed:**
- Pro: $20/month (for production)

---

**Ready?** Go to [vercel.com](https://vercel.com) and import your repo!

