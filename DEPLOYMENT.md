# 🚀 DWIGO Cloud Deployment Guide

Deploy DWIGO to a cloud server so you can test on your phone and avoid managing multiple terminal windows.

## Quick Start: Render.com (Recommended)

Render.com offers a **free tier** perfect for testing:
- Free PostgreSQL database
- Free Redis instance
- Free web service (spins down after 15 min inactivity)
- Free worker service
- HTTPS included
- Accessible from your phone!

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up (free account)
3. Connect your GitHub account (recommended)

### Step 2: Create Database

1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Name: `dwigo-db`
3. Database: `dwigo`
4. User: `dwigo_user`
5. Region: Choose closest to you
6. Plan: **Free**
7. Click **"Create Database"**
8. **Save the connection string** (you'll need it)

### Step 3: Create Redis

1. Click **"New +"** → **"Redis"**
2. Name: `dwigo-redis`
3. Plan: **Free**
4. Click **"Create Redis"**
5. **Save the connection string**

### Step 4: Deploy Application

#### Option A: Using render.yaml (Easiest)

1. Push your code to GitHub (if not already)
2. In Render dashboard, click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` automatically
5. Click **"Apply"**
6. Render will create:
   - Web service (API + Frontend)
   - Worker service (background jobs)
   - Database (if not created)
   - Redis (if not created)

#### Option B: Manual Setup

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Settings:
   - **Name**: `dwigo-app`
   - **Environment**: `Node`
   - **Build Command**: 
     ```bash
     npm run install-all && cd client && npm run build && cd ../server && npm install
     ```
   - **Start Command**: 
     ```bash
     cd server && npm start
     ```
   - **Plan**: Free

4. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=<from your PostgreSQL service>
   REDIS_URL=<from your Redis service>
   JWT_SECRET=<generate a random string>
   ADMIN_API_TOKEN=<generate a random string>
   MIN_DEAL_QUALITY_SCORE=0.4
   AUTO_REJECT_QUALITY_SCORE=0.25
   ENABLE_SCHEDULER=true
   JOB_WORKER_CONCURRENCY=3
   ```

5. Click **"Create Web Service"**

### Step 5: Create Worker Service

1. Click **"New +"** → **"Background Worker"**
2. Connect same repository
3. Settings:
   - **Name**: `dwigo-worker`
   - **Environment**: `Node`
   - **Build Command**: 
     ```bash
     npm run install-all && cd server && npm install
     ```
   - **Start Command**: 
     ```bash
     cd server && npm run worker
     ```
   - **Plan**: Free

4. **Environment Variables** (same as web service):
   - Copy all env vars from web service
   - Or use "Sync" feature in Render

5. Click **"Create Background Worker"**

### Step 6: Initialize Database

1. Get your database connection string from Render
2. Run the schema:
   ```bash
   # Option 1: Using psql locally
   psql <DATABASE_URL> -f server/schema.sql
   
   # Option 2: Using Render Shell
   # In Render dashboard → Database → Connect → Shell
   # Then upload and run schema.sql
   ```

3. Or use Render's PostgreSQL dashboard to run SQL

### Step 7: Access Your App

1. Once deployed, Render gives you a URL like:
   `https://dwigo-app.onrender.com`
2. **Open this URL on your phone!** 📱
3. The app should load and work just like localhost

### Step 8: Test It

1. Open the URL on your phone
2. Register a new account
3. Browse deals
4. Test location features
5. Everything should work!

---

## Alternative: Railway.app

Railway is another great option with a free tier:

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Add PostgreSQL and Redis services
5. Set environment variables
6. Deploy!

---

## Alternative: DigitalOcean App Platform

1. Go to [digitalocean.com](https://www.digitalocean.com)
2. Create account ($200 free credit)
3. Create App Platform project
4. Connect GitHub
5. Add PostgreSQL and Redis databases
6. Configure build/start commands
7. Deploy!

---

## Environment Variables Reference

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Random string for JWT tokens
- `ADMIN_API_TOKEN` - Random string for admin API access

### Optional
- `NODE_ENV` - `production` or `development`
- `PORT` - Server port (usually auto-set by platform)
- `MIN_DEAL_QUALITY_SCORE` - Default: `0.4`
- `AUTO_REJECT_QUALITY_SCORE` - Default: `0.25`
- `ENABLE_SCHEDULER` - `true` or `false`
- `JOB_WORKER_CONCURRENCY` - Default: `5`

---

## Troubleshooting

### Database Connection Issues
- Check `DATABASE_URL` is correct
- Ensure database allows connections from Render IPs
- Check SSL settings (Render requires SSL)

### Redis Connection Issues
- Verify `REDIS_URL` format: `redis://user:pass@host:port`
- Check Redis service is running

### Build Failures
- Check Node version (should be 18+)
- Verify all dependencies in package.json
- Check build logs in Render dashboard

### App Not Loading
- Check web service logs
- Verify worker service is running
- Check database schema is initialized

### Phone Can't Access
- Ensure URL uses HTTPS (Render provides this)
- Check CORS settings (should allow all in production)
- Verify firewall/network settings

---

## Cost Estimate

### Render.com Free Tier
- **$0/month** for testing
- Web service spins down after 15 min (wakes on request)
- Database: 90 days free, then $7/month
- Redis: Free tier available

### Recommended for Production
- Starter plan: ~$7/month per service
- Database: ~$7/month
- Redis: ~$10/month
- **Total: ~$25-30/month**

---

## Next Steps

1. ✅ Deploy to Render
2. ✅ Test on your phone
3. ✅ Share URL with team
4. ✅ Set up custom domain (optional)
5. ✅ Configure monitoring (optional)

---

## Quick Commands

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test Redis connection
redis-cli -u $REDIS_URL ping

# View logs (in Render dashboard)
# Or use Render CLI:
render logs --service dwigo-app
```

---

**Need help?** Check Render's docs or open an issue!

