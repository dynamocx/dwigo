# 🔧 Adding Environment Variables in Render

## Step-by-Step: Add CORS_ORIGIN

### Step 1: Navigate to Your Service
1. Go to [render.com](https://render.com) and sign in
2. Click on **"Dashboard"** (top navigation)
3. Find your service: **`dwigo-app`** (the web service)
4. Click on the service name to open it

### Step 2: Open Environment Tab
1. In your service page, look for tabs at the top:
   - **Overview** | **Logs** | **Events** | **Settings** | **Environment**
2. Click on **"Environment"** tab

### Step 3: Add Environment Variable
1. You'll see a section called **"Environment Variables"**
2. Click the **"Add Environment Variable"** button (or **"+ Add"**)
3. A form will appear with two fields:
   - **Key:** Type `CORS_ORIGIN`
   - **Value:** Type `https://dwigo.vercel.app,http://localhost:5173`
4. Click **"Save Changes"** (or **"Add"**)

### Step 4: Manual Save (if needed)
- Some Render interfaces require you to click **"Save Changes"** at the bottom
- Look for a save button and click it

### Step 5: Deploy (if auto-deploy is off)
- Render will automatically redeploy when you add env vars
- If it doesn't, go to **"Manual Deploy"** → **"Deploy latest commit"**

---

## Alternative: Via Blueprint Sync

If you're using a blueprint:

1. Go to **Blueprints** (left sidebar)
2. Click on your blueprint
3. Click **"Sync"** button
4. This will pull the latest `render.yaml` which includes `CORS_ORIGIN`

**Note:** The `render.yaml` already has `CORS_ORIGIN` defined, so syncing should add it automatically!

---

## Verify It's Added

1. Go back to your service → **Environment** tab
2. You should see:
   ```
   CORS_ORIGIN = https://dwigo.vercel.app,http://localhost:5173
   ```

---

## Quick Visual Guide

```
Render Dashboard
  └─ Services
      └─ dwigo-app (click)
          └─ Environment (tab)
              └─ Add Environment Variable
                  ├─ Key: CORS_ORIGIN
                  └─ Value: https://dwigo.vercel.app,http://localhost:5173
                      └─ Save Changes
```

---

## Troubleshooting

**Can't find Environment tab?**
- Make sure you're in the **web service** (`dwigo-app`), not the database
- Try refreshing the page

**Variable not saving?**
- Check for a "Save Changes" button at the bottom
- Some interfaces require clicking "Save" after adding each variable

**Want to use Blueprint instead?**
- Go to Blueprints → Your blueprint → Sync
- This will automatically add all env vars from `render.yaml`

---

**Need help?** Let me know what you see in your Render dashboard!

