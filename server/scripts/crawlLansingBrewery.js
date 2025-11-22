#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const dotenv = require('dotenv');

const { enqueueJob } = require('../jobs/queues');
const { crawlLansingBrewery } = require('../services/crawlers/lansingBrewery');

const envCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

envCandidates.some((candidate) => {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    return true;
  }
  return false;
});

async function main() {
  try {
    console.log('[crawlLansingBrewery] Fetching events…');
    const deals = await crawlLansingBrewery();

    if (deals.length === 0) {
      console.warn('[crawlLansingBrewery] No deals detected, skipping enqueue.');
      process.exit(0);
    }

    await enqueueJob('ingestion', 'crawl-lansing-brewery', {
      source: 'crawler:lansing-brewery',
      scope: 'mid-michigan',
      deals,
    });

    console.log(`[crawlLansingBrewery] Enqueued ${deals.length} deal(s) from Lansing Brewing Company.`);
  } catch (error) {
    console.error('[crawlLansingBrewery] Failed to crawl and enqueue', error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

void main();


