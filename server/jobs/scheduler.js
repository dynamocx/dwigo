const cron = require('node-cron');

const { enqueueJob } = require('./queues');

const enqueueNotification = (payload, opts) =>
  enqueueJob('notifications', payload.type ?? 'send-notification', payload, opts);

const enqueueAgentRecommendation = (payload, opts) =>
  enqueueJob('agentRecommendations', payload.type ?? 'generate-agent-recommendations', payload, opts);

const enqueueRewardJob = (payload, opts) =>
  enqueueJob('rewards', payload.type ?? 'process-reward', payload, opts);

const startScheduledJobs = () => {
  // Nightly agent recommendation refresh (02:30 AM UTC)
  cron.schedule('30 2 * * *', () => {
    void enqueueAgentRecommendation({ type: 'nightly-refresh' });
  });

  // Hourly nudge sweep (top of every hour)
  cron.schedule('0 * * * *', () => {
    void enqueueNotification({ type: 'hourly-nudge-sweep' });
  });

  console.log('[Scheduler] cron jobs initialised');
};

module.exports = {
  enqueueNotification,
  enqueueAgentRecommendation,
  enqueueRewardJob,
  startScheduledJobs,
};

