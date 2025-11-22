# 🚀 Quick Deploy to Cloud (5 Minutes)

Get DWIGO running on a cloud server so you can test on your phone!

## Option 1: Render.com (Recommended - Free Tier)

### Step 1: Push to GitHub
```bash
git init  # if not already initialized
git add .
git commit -m "Ready for deployment"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml`
5. Click **"Apply"**

Render will create:
- ✅ Web service (API + Frontend)
- ✅ Worker service (background jobs)
- ✅ PostgreSQL database
- ✅ Redis instance

### Step 3: Initialize Database

After deployment, get your `DATABASE_URL` from Render dashboard, then:

```bash
psql <DATABASE_URL> -f server/schema.sql
```

Or use Render's PostgreSQL dashboard to run the SQL.

### Step 4: Access Your App

Your app will be at: `https://dwigo-app.onrender.com`

**Open this on your phone!** 📱

---

## Option 2: Railway.app (Also Free)

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Add PostgreSQL and Redis services
5. Set environment variables (see `.env.production.example`)
6. Deploy!

---

## Environment Variables Needed

Copy these to your cloud platform:

```
DATABASE_URL=<from your database service>
REDIS_URL=<from your redis service>
JWT_SECRET=<generate random string>
ADMIN_API_TOKEN=<generate random string>
NODE_ENV=production
MIN_DEAL_QUALITY_SCORE=0.4
AUTO_REJECT_QUALITY_SCORE=0.25
ENABLE_SCHEDULER=true
JOB_WORKER_CONCURRENCY=3
```

---

## Troubleshooting

**Database connection fails?**
- Check `DATABASE_URL` format
- Ensure SSL is enabled (Render requires it)

**App not loading?**
- Check web service logs in dashboard
- Verify worker service is running
- Ensure database schema is initialized

**Can't access from phone?**
- Use HTTPS URL (Render provides this)
- Check CORS settings (already configured)

---

## Cost

**Free tier:**
- Render: $0/month (spins down after 15 min)
- Railway: $5/month free credit

**Production:**
- ~$25-30/month for always-on services

---

## Next Steps

1. ✅ Deploy to cloud
2. ✅ Test on your phone
3. ✅ Share URL with team
4. ✅ Set up custom domain (optional)

**That's it!** No more managing terminal windows! 🎉

