const { Queue } = require('bullmq');

const { connection, buildQueueEvents } = require('../config/redis');

const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  AGENT_RECOMMENDATIONS: 'agent-recommendations',
  REWARDS: 'rewards',
  INGESTION: 'ingestion',
};

const queues = {
  notifications: new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection }),
  agentRecommendations: new Queue(QUEUE_NAMES.AGENT_RECOMMENDATIONS, { connection }),
  rewards: new Queue(QUEUE_NAMES.REWARDS, { connection }),
  ingestion: new Queue(QUEUE_NAMES.INGESTION, { connection }),
};

const queueEvents = {
  notifications: buildQueueEvents(QUEUE_NAMES.NOTIFICATIONS),
  agentRecommendations: buildQueueEvents(QUEUE_NAMES.AGENT_RECOMMENDATIONS),
  rewards: buildQueueEvents(QUEUE_NAMES.REWARDS),
  ingestion: buildQueueEvents(QUEUE_NAMES.INGESTION),
};

Object.entries(queueEvents).forEach(([key, events]) => {
  events.on('failed', ({ jobId, failedReason }) => {
    console.error(`[QueueEvents:${key}] job ${jobId} failed`, failedReason);
  });

  events.on('completed', ({ jobId }) => {
    console.log(`[QueueEvents:${key}] job ${jobId} completed`);
  });

  events.on('waiting', ({ jobId }) => {
    console.log(`[QueueEvents:${key}] job ${jobId} waiting`);
  });

  events.on('error', (err) => {
    console.error(`[QueueEvents:${key}] error`, err);
  });
});

const enqueueJob = async (queueKey, jobName, payload, opts = {}) => {
  const queue = queues[queueKey];

  if (!queue) {
    throw new Error(`Unknown queue key: ${queueKey}`);
  }

  return queue.add(jobName, payload, opts);
};

module.exports = {
  QUEUE_NAMES,
  queues,
  queueEvents,
  enqueueJob,
};

