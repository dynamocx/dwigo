# 🎯 Next Steps: Adding Deals

Your app is live! Now let's add some deals so users can see content.

---

## Option 1: Add Test Deals via Admin Page (Easiest)

### Step 1: Access Admin Page
1. Go to your Vercel app: `https://dwigo-git-main-dynamocx.vercel.app`
2. Navigate to: `/admin/ingestion`
3. You'll need to authenticate with `ADMIN_API_TOKEN`

### Step 2: Add Test Deals
1. The admin page shows pending ingestion rows
2. You can manually add deals or promote existing ones
3. Click "Promote Selected" to add deals to the main feed

**Note:** You'll need the `ADMIN_API_TOKEN` from Render to access this page.

---

## Option 2: Run Seed Script (Quick Test Data)

### Step 1: Get Admin Token
1. Render Dashboard → Services → `dwigo-app` → Environment
2. Find `ADMIN_API_TOKEN` (or generate a new one)
3. Copy it

### Step 2: Run Seed Script Locally
```bash
cd /Users/millerdigital/dwigo-cursor/server
DATABASE_URL="your-render-db-url" ADMIN_API_TOKEN="your-token" npm run ingest:seed
```

This will create some test deals in the database.

---

## Option 3: Run Crawler (Real Deals)

### Step 1: Run Lansing Brewery Crawler
```bash
cd /Users/millerdigital/dwigo-cursor/server
DATABASE_URL="your-render-db-url" npm run ingest:crawl:lansing
```

This crawls real deals from Lansing Brewery and adds them to the ingestion pipeline.

### Step 2: Promote Deals
After crawling, go to `/admin/ingestion` and promote the deals you want to show.

---

## Option 4: Add Deals via API (Programmatic)

You can also add deals directly via the API:

```bash
curl -X POST https://dwigo-app.onrender.com/api/ingestion \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{
    "source": "manual",
    "deals": [{
      "merchantAlias": "Test Merchant",
      "rawPayload": {
        "title": "50% Off Everything",
        "description": "Great deal!",
        "price": 50,
        "originalPrice": 100
      }
    }]
  }'
```

---

## Recommended: Start with Option 2 (Seed Script)

**Quickest way to get deals showing:**

1. Get your `DATABASE_URL` from Render (External Database URL)
2. Get your `ADMIN_API_TOKEN` from Render
3. Run:
   ```bash
   cd /Users/millerdigital/dwigo-cursor/server
   DATABASE_URL="postgresql://..." ADMIN_API_TOKEN="your-token" npm run ingest:seed
   ```
4. Refresh your Vercel app - deals should appear!

---

## After Adding Deals

1. ✅ Refresh your Vercel app
2. ✅ Deals should appear on the main page
3. ✅ Click on deals to see detail pages
4. ✅ Test the full user flow

---

**Which option do you want to try first?** I recommend Option 2 (seed script) for quick test data!

