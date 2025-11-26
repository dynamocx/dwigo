const cron = require('node-cron');

const { enqueueJob } = require('./queues');

const enqueueNotification = (payload, opts) =>
  enqueueJob('notifications', payload.type ?? 'send-notification', payload, opts);

const enqueueAgentRecommendation = (payload, opts) =>
  enqueueJob('agentRecommendations', payload.type ?? 'generate-agent-recommendations', payload, opts);

const enqueueRewardJob = (payload, opts) =>
  enqueueJob('rewards', payload.type ?? 'process-reward', payload, opts);

const enqueueIngestionJob = (payload, opts) =>
  enqueueJob('ingestion', payload.type ?? 'ingestion-job', payload, opts);

const startScheduledJobs = () => {
  // Nightly agent recommendation refresh (02:30 AM UTC)
  cron.schedule('30 2 * * *', () => {
    void enqueueAgentRecommendation({ type: 'nightly-refresh' });
  });

  // Hourly nudge sweep (top of every hour)
  cron.schedule('0 * * * *', () => {
    void enqueueNotification({ type: 'hourly-nudge-sweep' });
  });

  // Daily AI Deal Fetching (04:00 AM UTC / 12:00 AM EST)
  if (process.env.OPENAI_API_KEY) {
    cron.schedule('0 4 * * *', async () => {
      try {
        const { discoverDealsForPilotLocations } = require('../services/ai/dealFetchingAgent');
        const deals = await discoverDealsForPilotLocations({
          categories: ['Dining', 'Entertainment', 'Shopping'],
          maxDealsPerLocation: 10,
        });
        
        if (deals.length > 0) {
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
            },
            confidence: deal.confidence || 0.75,
          }));
          
          void enqueueIngestionJob({
            source: 'ai:deal-fetching-agent',
            scope: 'mid-michigan-pilot',
            deals: ingestionDeals,
          });
          console.log(`[Scheduler] Enqueued ${deals.length} AI-discovered deals for ingestion`);
        }
      } catch (error) {
        console.error('[Scheduler] AI deal fetching failed:', error);
      }
    });
  }

  console.log('[Scheduler] cron jobs initialised');
};

module.exports = {
  enqueueNotification,
  enqueueAgentRecommendation,
  enqueueRewardJob,
  enqueueIngestionJob,
  startScheduledJobs,
};

