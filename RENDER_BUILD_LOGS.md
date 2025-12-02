# How to View Build Logs in Render

Build logs are **separate** from runtime logs. Here's how to find them:

## Method 1: Build Logs Tab (Easiest)

1. Go to **Render Dashboard** → Your Service (dwigo-app)
2. Click on the **"Events"** tab (or look for "Deployments" / "Builds")
3. Find the most recent deployment/build
4. Click on it to see the **build logs**
5. Look for lines like:
   ```
   ==> Running build command 'cd server && npm install && npx playwright install chromium'...
   Installing Chromium...
   Chromium installed successfully
   ```

## Method 2: Deployment History

1. Go to **Render Dashboard** → Your Service
2. Scroll down to **"Deployments"** or **"Build History"**
3. Click on the latest deployment
4. You'll see:
   - **Build Logs** (what happened during `npm install` and Playwright install)
   - **Runtime Logs** (what happens when the app is running)

## Method 3: Filter Runtime Logs

If you're looking at runtime logs and want to filter out Redis errors:

1. In the **Logs** tab, use the search/filter box
2. Search for: `[scraperService]` or `[baseScraper]` or `Playwright`
3. This filters to only show scraper-related logs

## What to Look For in Build Logs

### ✅ Successful Playwright Installation:
```
Installing Chromium...
Chromium installed successfully
```

### ❌ Failed Playwright Installation:
```
Failed to install browsers
Error: Installation process exited with code: 1
```

### ✅ Successful Build:
```
==> Build succeeded
```

### ❌ Failed Build:
```
==> Build failed 😞
```

## Quick Check: Health Endpoint

You can also check if Playwright is working by calling the health endpoint:
```
https://your-render-url.com/api/health
```

Look for the `redis` check - if it says "not configured" that's fine (Redis is optional).

## Suppressing Redis Errors

The Redis connection errors are now suppressed when Redis isn't configured. You should see:
```
[Redis] Not configured (optional - app works without it)
```

Instead of repeated connection errors.

