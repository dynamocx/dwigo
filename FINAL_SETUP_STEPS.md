# 🎉 Final Setup Steps - Connect Frontend & Backend

## ✅ What's Done
- ✅ Backend deployed to Render
- ✅ Frontend deployed to Vercel
- ✅ Build successful!

---

## 🔗 Step 1: Get Your URLs

### Your Vercel URL:
- Should be something like: `https://dwigo-xyz123.vercel.app`
- Or your custom domain if you set one up
- **Copy this URL!**

### Your Render Backend URL:
- Should be: `https://dwigo-app.onrender.com`
- (Or whatever you named your Render service)
- **Copy this URL!**

---

## 🔧 Step 2: Update CORS in Render

1. Go to **Render Dashboard** → **Services** → **`dwigo-app`**
2. Click **"Environment"** tab
3. Find **`CORS_ORIGIN`** variable
4. Edit it to include your **actual Vercel URL**:
   ```
   https://dwigo-xyz123.vercel.app,http://localhost:5173
   ```
   (Replace `dwigo-xyz123.vercel.app` with your actual Vercel URL)
5. **Save** (Render will auto-redeploy)

---

## 🔧 Step 3: Verify Vercel Environment Variable

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Check that **`VITE_API_URL`** is set to:
   ```
   https://dwigo-app.onrender.com/api
   ```
   (Replace `dwigo-app` with your actual Render service name if different)
3. If it's not set, add it now
4. **Redeploy** if you just added it

---

## 🧪 Step 4: Test the Connection

1. **Open your Vercel URL** in a browser
2. **Open browser DevTools** (F12 or Cmd+Option+I)
3. Go to **Network** tab
4. Try to:
   - View deals
   - Log in
   - Navigate around
5. **Check Network tab** for API calls:
   - Should see calls to: `https://dwigo-app.onrender.com/api/...`
   - Should NOT see CORS errors
   - Should see successful responses (200 status)

---

## 🐛 Troubleshooting

### CORS Errors?
- ✅ Make sure `CORS_ORIGIN` in Render includes your exact Vercel URL
- ✅ Make sure there are no trailing slashes
- ✅ Wait for Render to finish redeploying after updating CORS

### API Calls Failing?
- ✅ Check `VITE_API_URL` in Vercel is correct
- ✅ Check Render backend is running (might be spinning up if free tier)
- ✅ Check Network tab for actual error messages

### Backend Not Responding?
- ⚠️ **Render free tier spins down after 15 min**
- First request after spin-down takes ~30 seconds
- Subsequent requests are fast
- Consider upgrading to keep it warm, or use UptimeRobot to ping it

---

## 📱 Step 5: Test on Your Phone!

1. **Open your Vercel URL** on your phone's browser
2. Test the app:
   - View deals
   - Try logging in
   - Check if everything loads
3. **Share the URL** with your team!

---

## 🎯 Quick Checklist

- [ ] Got Vercel URL: `https://...`
- [ ] Got Render backend URL: `https://...`
- [ ] Updated `CORS_ORIGIN` in Render with Vercel URL
- [ ] Verified `VITE_API_URL` in Vercel points to Render backend
- [ ] Tested frontend in browser
- [ ] Checked Network tab for API calls
- [ ] No CORS errors
- [ ] Tested on phone! 📱

---

## 🚀 You're Live!

Your hybrid deployment is complete:
- **Frontend:** Vercel (fast, global CDN)
- **Backend:** Render (PostgreSQL, Redis, workers)

**Congratulations!** 🎉

---

**Need help?** Share your URLs and any errors you see!

