/**
 * Sync Eventbrite events to DWIGO ingestion pipeline
 * 
 * Usage:
 *   node scripts/syncEventbrite.js
 * 
 * Or schedule via cron:
 *   0 2 * * * cd /path/to/server && node scripts/syncEventbrite.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { fetchMidMichiganEvents } = require('../services/aggregators/eventbrite');
const { processIngestionJob } = require('../services/ingestion');

async function main() {
  console.log('[syncEventbrite] Starting Eventbrite sync...');

  try {
    const deals = await fetchMidMichiganEvents({
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // Next 90 days
    });

    if (deals.length === 0) {
      console.log('[syncEventbrite] No events found, exiting');
      process.exit(0);
    }

    const payload = {
      source: 'aggregator:eventbrite',
      scope: 'mid-michigan-pilot',
      deals,
    };

    const result = await processIngestionJob(payload);

    console.log('[syncEventbrite] Sync completed:', {
      jobId: result.jobId,
      stats: result.stats,
      dealCount: deals.length,
    });

    console.log('\n[syncEventbrite] Next steps:');
    console.log('  1. Review deals at /admin/ingestion/pending');
    console.log('  2. Promote approved deals using the admin UI or API');
    console.log('  3. Deals will appear in the app once promoted');

    process.exit(0);
  } catch (error) {
    console.error('[syncEventbrite] Sync failed:', error);
    process.exit(1);
  }
}

void main();

