# DWIGO Level 1 Ingestion & Merchant Pipeline

This document supplements `README.md` with implementation details for the automated ingestion and promotion workflow. The goal is to make Level 1 (“do nothing with DWIGO”) participation turnkey, while laying the foundation for higher merchant levels.

## Overview

```
   [Source adapters]  -->  enqueue ingestion job  -->  BullMQ ingestion queue
                                                               |
                                                               v
                                                       processIngestionJob
                                                       (ingested_deal_raw)
                                                               |
                                               +---------------+---------------+
                                               |                               |
                                        auto-promotion                   manual review
                                               |                               |
                                               v                               v
                                         promotePendingIngestedDeals -> deals, merchants
```

1. Source-specific crawlers/feeds produce normalized deals and enqueue a job.
2. `processIngestionJob` records each row in `ingested_deal_raw`, along with stats/errors.
3. Promotion logic matches or creates merchants/locations, inserts into `deals`, and logs provenance.
4. Human review can resolve low-confidence rows; high-confidence deals can auto-promote.

## Source Adapters

Each Level 1 source (merchant website, aggregator API, etc.) should expose a function that returns normalized payloads. Example: `server/services/crawlers/lansingBrewery.js` fetches the Lansing Brewing Company events page, extracts titles/descriptions/dates with `cheerio`, and emits the following structure:

```ts
interface NormalizedDeal {
  merchantAlias: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: {
    title: string;
    description?: string;
    category?: string;
    location?: { city?: string; state?: string; latitude?: number; longitude?: number };
    schedule?: { type: 'one_time' | 'recurring_weekly'; rule: Record<string, unknown> };
    price?: { amount?: number; original?: number };
    discount?: { type?: 'percentage' | 'bogo'; value?: number };
    inventory?: { max?: number; remaining?: number };
    sourceUrl?: string;
  };
  confidence?: number;
}
```

In code, an adapter can live under `server/services/crawlers/<source>.js` and export `{ crawlSource }`.

## Scheduling (Fetcher Cron)

A small script (e.g., `scripts/crawlSources.js`) can loop over configured sources and enqueue jobs. The repository includes `scripts/crawlLansingBrewery.js`, which looks roughly like:

```js
const { enqueueJob } = require('../jobs/queues');
const { crawlLansingBrewery } = require('../services/crawlers/lansingBrewery');

async function run() {
  const deals = await crawlLansingBrewery();
  await enqueueJob('ingestion', 'crawl-lansing-brewery', {
    source: 'crawler:lansing-brewery',
    scope: 'mid-michigan',
    deals,
  });
}
```

Use `node-cron` or the scheduler to run this nightly/weekly per source.

## Queue Handling

- `QUEUE_NAMES.INGESTION` already exists and the worker calls `processIngestionJob`.
- Future enhancement: add a promotion queue (e.g., `ingestion-promotion`) to offload the matching/insertion step instead of running `ingest:promote` manually.

## Promotion Logic Highlights

- Merchant matching uses `merchant_aliases` and `merchants` (fallback to creating `status='imported', level=1`).
- Locations are created in `merchant_locations` on first sighting.
- Deals are inserted with `status='active'` if `confidence >= 0.75`, otherwise `pending_review`.
- Provenance is stored in `deal_sources`.
- Raw row status is updated to `promoted` or `error`.

## Manual Review

- `GET /api/ingestion/pending` returns raw rows for review tools.
- A simple internal UI can call a POST endpoint to promote/reject specific IDs (future work).
- Admin can also re-run `npm run ingest:promote -- --limit N` after manually editing rows or adjusting confidence.

## Monitoring & Error Handling

- `ingestion_jobs` records total, recorded, and error counts.
- `ingestion_errors` logs stage-specific failures (fetch, normalization, promotion).
- Recommended: integrate worker logs with your monitoring/alerting stack (e.g., watch for growing pending queue, high error rates).

## Production Checklist

1. **Source Adapters**: Build per-source crawlers that return normalized payloads.
2. **Cron Fetcher**: Schedule crawls via `node-cron` or an external job runner.
3. **Promotion Strategy**:
   - Auto-promote high-confidence rows (`confidence >= threshold`).
   - Queue manual review for low-confidence or missing fields.
4. **Admin Tooling**: Provide internal dashboard to inspect/approve deals before promotion.
5. **Alerting**: Trigger notifications if ingestion errors exceed thresholds or when pending rows age beyond `X` days.
6. **Data Hygiene**:
   - Periodically expire or pause deals whose `end_date` has passed.
   - Notify merchants (when Level 2+ is active) about stale data.

## Related Scripts / Commands

```bash
cd server
npm run migrate:deals-status   # one-time migration for legacy rows
npm run worker                 # start BullMQ workers
npm run ingest:seed            # enqueue sample pilot payloads
npm run ingest:promote -- --limit 10
npm run ingest:crawl:lansing   # crawl Lansing Brewing events and enqueue payloads
npm run ingest:promote -- --limit 10
```

These commands provide a starting point for local pilots; replace the seed script with real crawlers once adapters are ready.


