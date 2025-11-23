# 🔍 CORS Debugging Steps

## Current Status
- ✅ CORS_ORIGIN is set correctly: `https://dwigo-git-main-dynamocx.vercel.app,http://localhost:5173`
- ❌ Still getting CORS errors
- ⚠️ Render needs to redeploy with new CORS code

---

## Step 1: Force Render Redeploy

The new CORS code I pushed needs to be deployed:

1. **Render Dashboard** → **Services** → **`dwigo-app`**
2. Click **"Manual Deploy"** button (top right)
3. Select **"Deploy latest commit"**
4. Wait for deployment to complete (1-2 minutes)
5. Check logs to ensure it deployed successfully

---

## Step 2: Verify CORS_ORIGIN Format

Double-check in Render:
1. **Environment** tab → **CORS_ORIGIN**
2. Should be exactly (no quotes, no @, no spaces except after comma):
   ```
   https://dwigo-git-main-dynamocx.vercel.app,http://localhost:5173
   ```
3. If it has quotes or extra spaces, fix it

---

## Step 3: Check Render Logs

After redeploy, check logs for:
1. **Render Dashboard** → **Services** → **`dwigo-app`** → **Logs** tab
2. Look for:
   - "DWIGO Server running on port 10000"
   - Any CORS-related warnings
   - Any errors

---

## Step 4: Test Backend Directly

Test if backend is responding:

1. Open: `https://dwigo-app.onrender.com/api/health`
2. Should return: `{"status":"OK","timestamp":"..."}`
3. If this fails, backend isn't running

---

## Step 5: Check Browser Network Tab

1. Open Vercel app
2. Open DevTools → **Network** tab
3. Try to load the page
4. Look at the failed requests:
   - Click on a failed request (red)
   - Check **Headers** tab
   - Look for `Access-Control-Allow-Origin` header
   - If it's missing, CORS isn't working

---

## Common Issues

### Issue 1: Backend Not Running
- **Symptom:** All API calls fail with network errors
- **Fix:** Check Render dashboard - service might be stopped
- **Note:** Free tier spins down after 15 min (first request takes ~30s)

### Issue 2: CORS Code Not Deployed
- **Symptom:** CORS errors persist after updating CORS_ORIGIN
- **Fix:** Force redeploy in Render (Manual Deploy → Deploy latest commit)

### Issue 3: Wrong Origin Format
- **Symptom:** CORS errors even with correct URL
- **Fix:** Check for:
  - Extra spaces
  - Quotes around the value
  - Trailing slashes
  - Wrong protocol (http vs https)

---

## Quick Test

Run this in browser console on your Vercel app:
```javascript
fetch('https://dwigo-app.onrender.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

If you see CORS error, the backend CORS isn't configured correctly.
If you see `{status: "OK"}`, CORS is working!

---

## Next Steps

1. ✅ Force redeploy Render (Manual Deploy)
2. ✅ Wait 1-2 minutes
3. ✅ Test backend health endpoint
4. ✅ Refresh Vercel app
5. ✅ Check browser console

**Let me know what you see in the Render logs and browser console!**

