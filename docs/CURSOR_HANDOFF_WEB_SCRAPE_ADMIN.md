## Cursor handoff: Admin seeding + web scrape sources

This doc is a **handoff note** capturing what changed, why, and where—so you can restart Cursor (or upgrade) and pick up instantly.

### Goal of this thread

- Clarify how **web scrape** vs **Places/AI** work.
- Add **review UX** for configured scrape URLs (not under `scrapers/`).
- Iterate **`dealSources.json`** for **Fenton** test venues and tune selectors.

---

## Key decisions / mental model

### “Scrape Deals from Web” = config allowlist (`dealSources.json`)

- The “Scrape Deals from Web” admin action only scrapes URLs listed in:
  - `server/config/dealSources.json`
- That file is **not** in `server/services/scrapers/`. The scraper code reads it from `server/config/`.
- Optional runtime filters:
  - **`SCRAPER_CATEGORY_FILTER`** env: keeps rows whose `category` matches (e.g. `Dining`)
  - Admin **city multi-select**: keeps rows whose `city` matches selected values
- No auto-discovery occurs in this path: it’s an **explicit allowlist** of targets (malls, CVBs, merchant pages, etc.).

### Discover Dining / AI: Real = Places-driven discovery (separate pipeline)

- **Discover Dining** and **AI: Real (Places + website)** use Google Places discovery and do not depend on `dealSources.json` as the target list.
- We discussed adding “dining-only scope” to AI: Real and decided it’s not urgent right now because:
  - AI: Real already runs `categories: ['Dining','Entertainment','Shopping']`
  - “Dining-only” mostly helps cost/focus, not necessarily more dining deals than the dining portion of the full run.

### Facebook content

- Current web scrape pipeline does **not** fetch Facebook content.
- Facebook as a source is on the **roadmap** (Graph API vs brittle scraping). For now, keep a `facebookUrl` or “Notes” column in your sheet to flag venues where FB is the real source.

---

## Shipped changes (code)

### 1) Admin Auto-Seeding UI cleanup

**User request**: pair each dropdown with its button.

- Discover Dining preset dropdown is paired with the Discover Dining button.
- Web scrape cities multi-select is paired with Scrape Deals from Web button.
- AI Real places cities multi-select is paired with AI: Real button.

Also extracted shared config out of the big page component:

- `client/src/pages/admin/adminAutoSeedingConfig.ts`
  - `DISCOVER_PRESETS`, preset IDs/types, and `buildAdminCityPickerOptions()`
- `client/src/pages/admin/IngestionReviewPage.tsx`
  - Auto-Seeding tab reorganized into three outlined cards + “Other seeding”

Commit:
- `1afc6c2` — `refactor(admin): pair seeding controls with actions; extract auto-seeding config`

### 2) Read-only admin catalog of web scrape sources (grouped by city)

Problem: it’s hard to know “what’s currently in the scraper per location” without opening the repo.

Added:

- API route (admin-token protected):
  - `GET /api/admin/deal-sources`
  - Returns all rows from `server/config/dealSources.json` plus a `SCRAPER_CATEGORY_FILTER` hint.
- New admin page:
  - `/admin/deal-sources`
  - Tables grouped by **city**, links to each URL, shows `enabled`, `fetchMode`, and selector summary.
- In ingestion review UI:
  - Added a “Web scrape sources” navigation button near the header.
  - Added a link under the “Scrape Deals from Web” caption: “Review configured URLs by city”.

Files:
- `server/routes/admin/dealSourcesCatalog.js`
- `server/index.js` (mounts `/api/admin/deal-sources`)
- `client/src/api/adminDealSources.ts`
- `client/src/pages/admin/DealSourcesPage.tsx`
- `client/src/App.tsx` (route)
- `client/src/pages/admin/IngestionReviewPage.tsx` (links)

Commit:
- `02bdc1f` — `feat(admin): read-only web scrape source catalog by city`

---

## `dealSources.json` iteration (Fenton sources)

You provided two Fenton dining targets:

- The Laundry
  - Initially targeted `https://lunchandbeyond.com/specials/`
  - Later switched to homepage due to content living there:
    - `https://lunchandbeyond.com/`
- One Eleven
  - `https://www.111fenton.com/happy-hour.html`

Observed behavior:

- When the admin UI shows “0 deals” and “0 items found”, the pipeline doesn’t call the extractor:
  - `baseScraper.extractWithSelectors()` produced **0** extracted items
  - `dealExtractor.processScrapedContent()` intentionally **skips** LLM extraction when items are empty to prevent hallucinated deals.

Selector strategy used to unstick extraction:

- Switched from site-specific `.deal/.event` selectors to a conservative “grab main content” pattern:
  - `selectors.item`: `main, article, #content, ...`
  - `title`: `h1, h2, h3, ...`
  - `desc`: `p, li`
- Cleared `keywords: []` so content isn’t filtered out.
- Switched Laundry + One Eleven to `renderedHtml` to handle JS-heavy pages.
- Later, Laundry URL changed to homepage and selectors expanded to capture promo/tile/instagram-ish sections.

Commits (sequence):
- `f41e00b` — initial add/update Laundry + One Eleven
- `79cc6a1` — loosen selectors, clear keywords, switch Laundry/One Eleven to `renderedHtml`
- `84fa730` — Laundry → homepage + expanded selectors

Current relevant rows live in:
- `server/config/dealSources.json`

---

## How to resume testing after restart

1. Pull latest `main`.
2. Open admin:
   - `/admin/ingestion`
   - `/admin/deal-sources` (verify rows grouped by city)
3. Run:
   - Ingestion Review → Auto-Seeding → “Scrape Deals from Web”
   - Select **Fenton** in the cities dropdown (optional) and run.
4. Interpret results:
   - **0 items found**: selectors are wrong OR content is blocked OR content is all images.
   - **items found but 0 deals**: extractor didn’t find offer-like text; may need better targeting/selectors.
5. If Laundry is still weak:
   - Homepage has mixed content; some specials are images → cannot extract without OCR.
   - Prefer targeting a page with real HTML text if possible; otherwise accept limited extraction.

