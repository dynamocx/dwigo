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

  // Daily Eventbrite sync (03:00 AM UTC / 11:00 PM EST previous day)
  cron.schedule('0 3 * * *', async () => {
    try {
      const { fetchMidMichiganEvents } = require('../services/aggregators/eventbrite');
      const deals = await fetchMidMichiganEvents({
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      
      if (deals.length > 0) {
        void enqueueIngestionJob({
          source: 'aggregator:eventbrite',
          scope: 'mid-michigan-pilot',
          deals,
        });
        console.log(`[Scheduler] Enqueued ${deals.length} Eventbrite events for ingestion`);
      }
    } catch (error) {
      console.error('[Scheduler] Eventbrite sync failed:', error);
    }
  });

  console.log('[Scheduler] cron jobs initialised');
};

module.exports = {
  enqueueNotification,
  enqueueAgentRecommendation,
  enqueueRewardJob,
  enqueueIngestionJob,
  startScheduledJobs,
};

