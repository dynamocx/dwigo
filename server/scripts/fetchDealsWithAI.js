/**
 * AI-Powered Deal Fetching Script
 * 
 * Uses LLM to discover deals for Mid-Michigan pilot locations
 * 
 * Usage:
 *   node scripts/fetchDealsWithAI.js
 * 
 * Requires:
 *   OPENAI_API_KEY environment variable
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { discoverDealsForPilotLocations } = require('../services/ai/dealFetchingAgent');
const { processIngestionJob } = require('../services/ingestion');

async function main() {
  console.log('[fetchDealsWithAI] Starting AI-powered deal discovery...');

  if (!process.env.OPENAI_API_KEY) {
    console.error('[fetchDealsWithAI] ERROR: OPENAI_API_KEY not set');
    console.error('[fetchDealsWithAI] Get your API key from: https://platform.openai.com/api-keys');
    process.exit(1);
  }

  try {
    const deals = await discoverDealsForPilotLocations({
      categories: ['Dining', 'Entertainment', 'Shopping'],
      maxDealsPerLocation: 5, // Start small for testing
    });

    if (deals.length === 0) {
      console.log('[fetchDealsWithAI] No deals discovered');
      process.exit(0);
    }

    console.log(`[fetchDealsWithAI] Discovered ${deals.length} deals via AI`);

    // Transform to ingestion format
    const ingestionDeals = deals.map(deal => ({
      merchantAlias: deal.merchantName || 'Unknown Merchant',
      rawPayload: {
        title: deal.title,
        description: deal.description,
        category: deal.category,
        address: deal.address,
        city: deal.city || deal.location?.split(',')[0],
        state: deal.state || 'MI',
        postalCode: deal.postalCode,
        latitude: deal.latitude,
        longitude: deal.longitude,
        startDate: deal.startDate,
        endDate: deal.endDate,
        price: deal.price,
        discountPercentage: deal.discountPercentage,
        sourceUrl: deal.sourceUrl,
      },
      normalizedPayload: {
        title: deal.title,
        category: deal.category,
        location: {
          city: deal.city || deal.location?.split(',')[0],
          state: deal.state || 'MI',
          latitude: deal.latitude,
          longitude: deal.longitude,
        },
        ...(deal.discountPercentage ? {
          discount: {
            type: 'percentage',
            value: deal.discountPercentage,
          },
        } : {}),
        ...(deal.price ? {
          price: {
            currency: 'USD',
            amount: parseFloat(deal.price.replace('$', '')) || null,
          },
        } : {}),
      },
      confidence: deal.confidence || 0.75,
    }));

    const payload = {
      source: 'ai:deal-fetching-agent',
      scope: 'mid-michigan-pilot',
      deals: ingestionDeals,
    };

    const result = await processIngestionJob(payload);

    console.log('[fetchDealsWithAI] Ingestion job completed:', {
      jobId: result.jobId,
      stats: result.stats,
      dealCount: ingestionDeals.length,
    });

    console.log('\n[fetchDealsWithAI] Next steps:');
    console.log('  1. Review deals at /admin/ingestion/pending');
    console.log('  2. Promote approved deals using the admin UI or API');
    console.log('  3. Deals will appear in the app once promoted');

    process.exit(0);
  } catch (error) {
    console.error('[fetchDealsWithAI] Failed:', error);
    process.exit(1);
  }
}

void main();

