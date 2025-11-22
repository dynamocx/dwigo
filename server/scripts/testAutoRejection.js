#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const dotenv = require('dotenv');

const { enqueueJob } = require('../jobs/queues');

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

// Mix of good and bad deals to test auto-rejection
const testDeals = [
  // ✅ Good deal - should pass
  {
    merchantAlias: 'Test Store',
    rawPayload: {
      title: '50% Off Everything Sale',
      description: 'Massive clearance sale! Get 50% off all items in store. Limited time only.',
      category: 'Shopping',
      discountPercentage: 50,
      originalPrice: 100,
      dealPrice: 50,
    },
    normalizedPayload: {
      title: '50% Off Everything Sale',
      description: 'Massive clearance sale! Get 50% off all items in store. Limited time only.',
      category: 'Shopping',
      discount: {
        type: 'percentage',
        value: 50,
      },
      price: {
        original: 100,
        amount: 50,
      },
    },
    confidence: 0.9,
  },
  // ❌ Bad deal - should be auto-rejected (no description, no discount)
  {
    merchantAlias: 'Empty Store',
    rawPayload: {
      title: 'Menu',
      description: '',
      category: 'Dining',
    },
    normalizedPayload: {
      title: 'Menu',
      category: 'Dining',
    },
    confidence: 0.5,
  },
  // ❌ Bad deal - should be auto-rejected (generic title, minimal description)
  {
    merchantAlias: 'Generic Business',
    rawPayload: {
      title: 'Deal 123',
      description: 'Special',
      category: 'Other',
    },
    normalizedPayload: {
      title: 'Deal 123',
      description: 'Special',
      category: 'Other',
    },
    confidence: 0.3,
  },
  // ❌ Bad deal - should be auto-rejected (no value proposition)
  {
    merchantAlias: 'No Value Store',
    rawPayload: {
      title: 'LBC Beer',
      description: null,
      category: 'Dining',
    },
    normalizedPayload: {
      title: 'LBC Beer',
      category: 'Dining',
    },
    confidence: 0.6,
  },
  // ✅ Good deal - should pass (event with price and description)
  {
    merchantAlias: 'Event Venue',
    rawPayload: {
      title: 'Summer Music Festival',
      description: 'Join us for a weekend of live music, food trucks, and fun activities. Tickets include access to all stages.',
      category: 'Events',
      price: 45,
      originalPrice: 60,
    },
    normalizedPayload: {
      title: 'Summer Music Festival',
      description: 'Join us for a weekend of live music, food trucks, and fun activities. Tickets include access to all stages.',
      category: 'Events',
      price: {
        original: 60,
        amount: 45,
      },
    },
    confidence: 0.85,
  },
  // ⚠️ Borderline deal - might pass or need review (low discount)
  {
    merchantAlias: 'Low Discount Store',
    rawPayload: {
      title: 'Small Discount',
      description: 'Get 3% off your purchase',
      category: 'Shopping',
      discountPercentage: 3,
    },
    normalizedPayload: {
      title: 'Small Discount',
      description: 'Get 3% off your purchase',
      category: 'Shopping',
      discount: {
        type: 'percentage',
        value: 3,
      },
    },
    confidence: 0.7,
  },
];

async function main() {
  try {
    const payload = {
      source: 'test-auto-rejection',
      scope: 'quality-test',
      deals: testDeals,
    };

    await enqueueJob('ingestion', 'test-auto-rejection', payload, {
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log('✅ Enqueued test ingestion job with mix of good and bad deals.');
    console.log('📊 Expected results:');
    console.log('   - 2-3 deals should pass (high quality)');
    console.log('   - 3-4 deals should be auto-rejected (low quality)');
    console.log('\n💡 Check results with:');
    console.log('   psql -d dwigo -c "SELECT status, COUNT(*) FROM ingested_deal_raw WHERE job_id = (SELECT MAX(id) FROM ingestion_jobs) GROUP BY status;"');
  } catch (error) {
    console.error('❌ Failed to enqueue test ingestion job', error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

void main();

