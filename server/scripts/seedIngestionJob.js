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

const sampleDeals = [
  {
    merchantAlias: 'Lansing Brewing Company',
    rawPayload: {
      title: 'Michigan Mondays – 15% Off Local Pours',
      description: 'Celebrate the Mitten every Monday with 15% off all Michigan-made drafts and flights.',
      category: 'Dining',
      address: '518 E Shiawassee St, Lansing, MI 48912',
      city: 'Lansing',
      state: 'MI',
      postalCode: '48912',
      startDate: '2025-01-06T16:00:00-05:00',
      endDate: '2025-03-31T21:00:00-05:00',
      sourceUrl: 'https://www.lansingbrewingcompany.com/events',
    },
    normalizedPayload: {
      title: 'Michigan Mondays – 15% Off Local Pours',
      category: 'Dining',
      location: {
        city: 'Lansing',
        state: 'MI',
      },
      schedule: {
        type: 'recurring_weekly',
        rule: {
          daysOfWeek: ['monday'],
          startTime: '16:00',
          endTime: '21:00',
        },
      },
      discount: {
        type: 'percentage',
        value: 15,
      },
    },
    confidence: 0.8,
  },
  {
    merchantAlias: 'Horrocks Farm Market',
    rawPayload: {
      title: 'Winter Wine Walk & Cheese Pairings',
      description: 'Stroll the greenhouse with live acoustic music, sample 6 curated wine and cheese pairings.',
      category: 'Events',
      address: '7420 W Saginaw Hwy, Lansing, MI 48917',
      city: 'Lansing',
      state: 'MI',
      postalCode: '48917',
      startDate: '2025-02-08T17:00:00-05:00',
      endDate: '2025-02-08T20:00:00-05:00',
      price: 25,
      sourceUrl: 'https://www.shophorrocks.com/events',
    },
    normalizedPayload: {
      title: 'Winter Wine Walk & Cheese Pairings',
      category: 'Events',
      price: {
        currency: 'USD',
        amount: 25,
      },
      location: {
        city: 'Lansing',
        state: 'MI',
      },
      schedule: {
        type: 'one_time',
        rule: {
          startsAt: '2025-02-08T17:00:00-05:00',
          endsAt: '2025-02-08T20:00:00-05:00',
        },
      },
    },
    confidence: 0.7,
  },
];

async function main() {
  try {
    const payload = {
      source: 'manual-seed',
      scope: 'mid-michigan-beta',
      deals: sampleDeals,
    };

    await enqueueJob('ingestion', 'manual-mid-michigan-seed', payload, {
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log('Enqueued ingestion job for Mid-Michigan pilot seed.');
  } catch (error) {
    console.error('Failed to enqueue ingestion seed job', error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

void main();


