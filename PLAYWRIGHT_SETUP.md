# Playwright Setup for Render

Playwright is required for scraping JavaScript-heavy websites (rendered HTML mode).

## Automatic Installation (Recommended)

The `render.yaml` file is configured to automatically install Playwright browsers during the build process:

```yaml
buildCommand: cd server && npm install && npx playwright install chromium
```

This runs automatically when you deploy to Render.

## Manual Installation (If Needed)

If you need to install Playwright manually in Render:

1. Go to Render Dashboard → Your Service → Settings
2. Find "Build Command"
3. Update it to: `cd server && npm install && npx playwright install chromium`
4. Save and redeploy

## Verify Installation

After deployment, check the build logs. You should see:
```
Installing Chromium...
Chromium installed successfully
```

## Troubleshooting

### Playwright Not Found
If you see errors like "Playwright chromium not available":
- Check build logs to see if `npx playwright install chromium` ran successfully
- Verify `playwright` is in `server/package.json` dependencies
- Try redeploying

### Build Timeout
Playwright browser installation can take 2-3 minutes. If build times out:
- Render free tier has build time limits
- Consider upgrading to a paid plan
- Or use only `staticHtml` mode (no Playwright needed)

### System Dependencies
On some systems, you may need:
```bash
npx playwright install --with-deps chromium
```

However, Render's free tier may not support `--with-deps`. If this fails, stick with:
```bash
npx playwright install chromium
```

## Alternative: Use Only Static HTML Mode

If Playwright installation is problematic, you can:
1. Set all sources in `dealSources.json` to use `fetchMode: "staticHtml"`
2. This doesn't require Playwright
3. Works for websites that don't require JavaScript rendering

## Current Status

- ✅ Playwright package: Installed (in package.json)
- ✅ Browser binaries: Installed via build command
- ✅ Code: Handles missing Playwright gracefully

If Playwright isn't available, the scraper will:
- Log a warning
- Skip sources that require `renderedHtml` mode
- Continue with `staticHtml` sources

