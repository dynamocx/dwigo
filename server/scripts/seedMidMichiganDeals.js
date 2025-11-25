/**
 * Seed script for Mid-Michigan deals (Lansing, Flint, Grand Blanc, Fenton)
 * Run with: node scripts/seedMidMichiganDeals.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { processIngestionJob } = require('../services/ingestion');

const MID_MICHIGAN_DEALS = [
  // Lansing Area
  {
    merchantAlias: 'Lansing Brewing Company',
    rawPayload: {
      title: 'Michigan Mondays – 15% Off Local Pours',
      description: 'Celebrate the Mitten every Monday with 15% off all Michigan-made drafts and flights.',
      category: 'Dining',
      address: '518 E Shiawassee St',
      city: 'Lansing',
      state: 'MI',
      postalCode: '48912',
      latitude: 42.7325,
      longitude: -84.5555,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: 'https://www.lansingbrewingcompany.com',
    },
    normalizedPayload: {
      title: 'Michigan Mondays – 15% Off Local Pours',
      category: 'Dining',
      discount: { type: 'percentage', value: 15 },
      location: { city: 'Lansing', state: 'MI', latitude: 42.7325, longitude: -84.5555 },
    },
    confidence: 0.85,
  },
  {
    merchantAlias: 'Horrocks Farm Market',
    rawPayload: {
      title: 'Winter Wine Walk & Cheese Pairings',
      description: 'Stroll the greenhouse with live acoustic music, sample 6 curated wine and cheese pairings.',
      category: 'Entertainment',
      address: '7420 W Saginaw Hwy',
      city: 'Lansing',
      state: 'MI',
      postalCode: '48917',
      latitude: 42.7325,
      longitude: -84.5555,
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      price: 25,
      sourceUrl: 'https://www.shophorrocks.com',
    },
    normalizedPayload: {
      title: 'Winter Wine Walk & Cheese Pairings',
      category: 'Entertainment',
      price: { currency: 'USD', amount: 25 },
      location: { city: 'Lansing', state: 'MI', latitude: 42.7325, longitude: -84.5555 },
    },
    confidence: 0.8,
  },
  {
    merchantAlias: 'The Soup Spoon Cafe',
    rawPayload: {
      title: 'Happy Hour Specials',
      description: 'Half-price appetizers and $2 off craft cocktails, Monday-Friday 3-6 PM.',
      category: 'Dining',
      address: '1419 E Grand River Ave',
      city: 'Lansing',
      state: 'MI',
      postalCode: '48906',
      latitude: 42.7325,
      longitude: -84.5555,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: 'https://www.soupspooncafe.com',
    },
    normalizedPayload: {
      title: 'Happy Hour Specials',
      category: 'Dining',
      discount: { type: 'percentage', value: 50 },
      location: { city: 'Lansing', state: 'MI', latitude: 42.7325, longitude: -84.5555 },
    },
    confidence: 0.75,
  },
  // Flint Area
  {
    merchantAlias: 'The Torch Bar & Grill',
    rawPayload: {
      title: 'Taco Tuesday – $2 Tacos',
      description: 'Every Tuesday, enjoy $2 tacos all day long. Choose from beef, chicken, or vegetarian options.',
      category: 'Dining',
      address: '701 S Saginaw St',
      city: 'Flint',
      state: 'MI',
      postalCode: '48502',
      latitude: 43.0125,
      longitude: -83.6875,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: 'https://www.torchbar.com',
    },
    normalizedPayload: {
      title: 'Taco Tuesday – $2 Tacos',
      category: 'Dining',
      price: { currency: 'USD', amount: 2 },
      location: { city: 'Flint', state: 'MI', latitude: 43.0125, longitude: -83.6875 },
    },
    confidence: 0.8,
  },
  {
    merchantAlias: 'Sloan Museum',
    rawPayload: {
      title: 'Free Admission First Friday',
      description: 'Free admission to Sloan Museum on the first Friday of each month, 5-8 PM.',
      category: 'Entertainment',
      address: '1221 E Kearsley St',
      city: 'Flint',
      state: 'MI',
      postalCode: '48503',
      latitude: 43.0125,
      longitude: -83.6875,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: 'https://www.sloanlongway.org',
    },
    normalizedPayload: {
      title: 'Free Admission First Friday',
      category: 'Entertainment',
      discount: { type: 'percentage', value: 100 },
      location: { city: 'Flint', state: 'MI', latitude: 43.0125, longitude: -83.6875 },
    },
    confidence: 0.85,
  },
  // Grand Blanc Area
  {
    merchantAlias: 'Genesee Valley Center',
    rawPayload: {
      title: 'Weekend Shopping Specials',
      description: 'Save 20% on select stores throughout the mall. Valid Friday-Sunday.',
      category: 'Shopping',
      address: '3341 S Linden Rd',
      city: 'Flint',
      state: 'MI',
      postalCode: '48507',
      latitude: 42.9275,
      longitude: -83.6169,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: 'https://www.geneseevalleycenter.com',
    },
    normalizedPayload: {
      title: 'Weekend Shopping Specials',
      category: 'Shopping',
      discount: { type: 'percentage', value: 20 },
      location: { city: 'Grand Blanc', state: 'MI', latitude: 42.9275, longitude: -83.6169 },
    },
    confidence: 0.7,
  },
  {
    merchantAlias: 'The Fenton Hotel',
    rawPayload: {
      title: 'Sunday Brunch Buffet',
      description: 'All-you-can-eat brunch buffet every Sunday 10 AM - 2 PM. $18.99 per person.',
      category: 'Dining',
      address: '100 N Leroy St',
      city: 'Fenton',
      state: 'MI',
      postalCode: '48430',
      latitude: 42.7978,
      longitude: -83.7050,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: 'https://www.fentonhotel.com',
    },
    normalizedPayload: {
      title: 'Sunday Brunch Buffet',
      category: 'Dining',
      price: { currency: 'USD', amount: 18.99 },
      location: { city: 'Fenton', state: 'MI', latitude: 42.7978, longitude: -83.7050 },
    },
    confidence: 0.75,
  },
  {
    merchantAlias: 'Fenton Winery & Brewery',
    rawPayload: {
      title: 'Wine Tasting Flight Special',
      description: '5-wine tasting flight for $12 (regularly $15). Available daily.',
      category: 'Entertainment',
      address: '1370 N Long Lake Rd',
      city: 'Fenton',
      state: 'MI',
      postalCode: '48430',
      latitude: 42.7978,
      longitude: -83.7050,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: 'https://www.fentonwinery.com',
    },
    normalizedPayload: {
      title: 'Wine Tasting Flight Special',
      category: 'Entertainment',
      discount: { type: 'percentage', value: 20 },
      location: { city: 'Fenton', state: 'MI', latitude: 42.7978, longitude: -83.7050 },
    },
    confidence: 0.8,
  },
];

async function main() {
  console.log('[seedMidMichiganDeals] Starting seed job...');
  console.log(`[seedMidMichiganDeals] Seeding ${MID_MICHIGAN_DEALS.length} deals for Mid-Michigan`);

  try {
    const payload = {
      source: 'admin-seed',
      scope: 'mid-michigan-initial',
      deals: MID_MICHIGAN_DEALS,
    };

    const result = await processIngestionJob(payload);

    console.log('[seedMidMichiganDeals] Seed job completed:', {
      jobId: result.jobId,
      stats: result.stats,
    });

    console.log('[seedMidMichiganDeals] Next steps:');
    console.log('  1. Review deals at /admin/ingestion/pending');
    console.log('  2. Promote approved deals using the admin UI or API');
    console.log('  3. Deals will appear in the app once promoted');

    process.exit(0);
  } catch (error) {
    console.error('[seedMidMichiganDeals] Seed job failed:', error);
    process.exit(1);
  }
}

void main();

