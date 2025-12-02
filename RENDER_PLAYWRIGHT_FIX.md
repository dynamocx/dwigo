# Fix Playwright Installation in Render

## Problem
Build is failing with: `su: Authentication failure` when trying to install Playwright with `--with-deps`.

## Solution

### Option 1: Update Build Command in Render Dashboard (Recommended)

1. Go to **Render Dashboard** → Your Service (dwigo-app) → **Settings**
2. Find **"Build Command"**
3. Change it to:
   ```
   cd server && npm install && npx playwright install chromium
   ```
4. **Important**: 
   - Make sure there's NO `--with-deps` flag
   - Remove any `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variables (not needed)
   - Remove the `|| echo` fallback (we handle that in code)
5. Click **Save Changes**
6. Go to **Manual Deploy** → **Clear build cache & deploy**

### Option 2: Verify render.yaml is Being Used

If Render is using `render.yaml`:
- The build command should be: `cd server && npm install && npx playwright install chromium`
- If it's still using `--with-deps`, Render might be ignoring the YAML file
- In that case, use Option 1 (manual dashboard setting)

### Option 3: Alternative - Install Without System Dependencies

If the above still fails, try:
```
cd server && npm install && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 npx playwright install chromium
```

Or if Playwright installation is optional:
```
cd server && npm install && (npx playwright install chromium || echo "Playwright install skipped")
```

## Verify Installation

After successful build, check logs for:
```
Installing Chromium...
Chromium installed successfully
```

## What Happens If Playwright Fails?

The scraper will:
- ✅ Continue working for `staticHtml` sources (most of your sources)
- ⚠️ Skip `renderedHtml` sources (fentonbrewery, downtownlansing)
- ✅ Automatically fallback to staticHtml if Playwright fails during scraping

## Current Source Status

- **staticHtml** (no Playwright needed):
  - The Laundry ✅
  - Lansing Brewing Company ✅
  - Kean's Store ✅
  - Meridian Mall ✅

- **renderedHtml** (needs Playwright):
  - Fenton Winery & Brewery ⚠️
  - Downtown Lansing Inc. ⚠️

## Next Steps

1. Update build command in Render dashboard (remove `--with-deps`)
2. Clear build cache and redeploy
3. Check build logs for Playwright installation
4. Try scraping again

