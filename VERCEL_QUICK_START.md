# ⚡ Vercel Quick Start Guide

## Step 2: Deploy Frontend to Vercel

### Step 1: Sign Up / Sign In
1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub account

### Step 2: Import Project
1. Click **"Add New Project"** (or **"New Project"**)
2. You'll see a list of your GitHub repositories
3. Find **`dynamocx/dwigo`** (or `dwigo` if that's the repo name)
4. Click **"Import"**

### Step 3: Configure Project
Vercel will auto-detect Vite! Here's what to check:

**Project Settings:**
- **Framework Preset:** Should show **"Vite"** (auto-detected) ✅
- **Root Directory:** 
  - Option A: Leave blank (if repo root)
  - Option B: Type `client` (if you want to set it explicitly)
- **Build Command:** 
  - If Root Directory is blank: `cd client && npm run build`
  - If Root Directory is `client`: `npm run build`
- **Output Directory:**
  - If Root Directory is blank: `client/dist`
  - If Root Directory is `client`: `dist`
- **Install Command:**
  - If Root Directory is blank: `cd client && npm install`
  - If Root Directory is `client`: `npm install`

**Recommended:** Set Root Directory to `client` for cleaner config:
- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Step 4: Add Environment Variable
**Before clicking Deploy**, click **"Environment Variables"** section:

1. Click **"Add"** or **"+ Add"**
2. Add this variable:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://dwigo-app.onrender.com/api`
     - ⚠️ **Replace `dwigo-app` with your actual Render service name!**
     - You can find it in Render dashboard → Services → `dwigo-app` → URL
3. Click **"Add"** or **"Save"**

### Step 5: Deploy!
1. Click **"Deploy"** button
2. Vercel will:
   - ✅ Install dependencies
   - ✅ Build your Vite app
   - ✅ Deploy to global CDN
   - ✅ Give you a URL like `https://dwigo-xyz123.vercel.app`

### Step 6: Get Your Vercel URL
After deployment completes:
1. You'll see a success page with your URL
2. Copy the URL (e.g., `https://dwigo-xyz123.vercel.app`)
3. **Update Render CORS_ORIGIN:**
   - Go back to Render → Services → `dwigo-app` → Environment
   - Edit `CORS_ORIGIN` variable
   - Update value to: `https://dwigo-xyz123.vercel.app,http://localhost:5173`
     - (Replace with your actual Vercel URL)
   - Save changes
   - Render will auto-redeploy

---

## Quick Checklist

- [ ] Signed up for Vercel
- [ ] Imported `dynamocx/dwigo` project
- [ ] Configured Root Directory: `client`
- [ ] Set Build Command: `npm run build`
- [ ] Set Output Directory: `dist`
- [ ] Added `VITE_API_URL` environment variable
- [ ] Clicked Deploy
- [ ] Got Vercel URL
- [ ] Updated Render `CORS_ORIGIN` with Vercel URL

---

## Troubleshooting

**Build fails?**
- Check that Root Directory is set correctly
- Check that `client/package.json` has a `build` script
- Check build logs in Vercel dashboard

**Can't find Environment Variables?**
- Look for "Environment Variables" section before clicking Deploy
- Or add them after deployment in Settings → Environment Variables

**API calls failing?**
- Check `VITE_API_URL` is set correctly
- Check Render backend is running
- Check CORS_ORIGIN includes your Vercel URL

---

**Ready?** Go to [vercel.com](https://vercel.com) and start!

