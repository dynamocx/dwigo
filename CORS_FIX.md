# 🔧 CORS Fix Instructions

## The Problem
Your Vercel URL is: `https://dwigo-git-main-dynamocx.vercel.app`

But Render's `CORS_ORIGIN` probably has the placeholder: `https://dwigo.vercel.app`

## The Fix

### Step 1: Update CORS_ORIGIN in Render

1. Go to **Render Dashboard** → **Services** → **`dwigo-app`**
2. Click **"Environment"** tab
3. Find **`CORS_ORIGIN`** variable
4. **Edit** it to:
   ```
   https://dwigo-git-main-dynamocx.vercel.app,http://localhost:5173
   ```
   ⚠️ **Important:** Use your **actual Vercel URL** (the one from the error message)
5. **Save Changes**
6. Render will automatically redeploy

### Step 2: Wait for Redeploy
- Render will redeploy automatically (takes 1-2 minutes)
- You can watch the logs in Render dashboard

### Step 3: Test Again
- Refresh your Vercel app
- Check browser console - CORS errors should be gone!

---

## Note: Vercel Preview URLs

Vercel creates different URLs:
- **Production:** `https://dwigo-git-main-dynamocx.vercel.app` (this one)
- **Preview:** `https://dwigo-xyz123.vercel.app` (for each branch)

If you want to support **all** Vercel preview URLs, you can use:
```
https://*.vercel.app,http://localhost:5173
```

But the CORS middleware I updated will need to handle wildcards. For now, use the exact URL.

---

## Quick Copy-Paste

**CORS_ORIGIN value:**
```
https://dwigo-git-main-dynamocx.vercel.app,http://localhost:5173
```

**Update this in Render → Services → dwigo-app → Environment → CORS_ORIGIN**

---

**After updating, wait 1-2 minutes for Render to redeploy, then refresh your Vercel app!**

