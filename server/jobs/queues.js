const { Queue } = require('bullmq');

const { connection, buildQueueEvents } = require('../config/redis');

const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  AGENT_RECOMMENDATIONS: 'agent-recommendations',
  REWARDS: 'rewards',
  INGESTION: 'ingestion',
};

// Only create queues if Redis connection is available
const queues = connection ? {
  notifications: new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection }),
  agentRecommendations: new Queue(QUEUE_NAMES.AGENT_RECOMMENDATIONS, { connection }),
  rewards: new Queue(QUEUE_NAMES.REWARDS, { connection }),
  ingestion: new Queue(QUEUE_NAMES.INGESTION, { connection }),
} : {};

// Only create queue events if Redis connection is available
const queueEvents = connection ? {
  notifications: buildQueueEvents(QUEUE_NAMES.NOTIFICATIONS),
  agentRecommendations: buildQueueEvents(QUEUE_NAMES.AGENT_RECOMMENDATIONS),
  rewards: buildQueueEvents(QUEUE_NAMES.REWARDS),
  ingestion: buildQueueEvents(QUEUE_NAMES.INGESTION),
} : {};

// Only set up event listeners if queue events exist
if (connection && Object.keys(queueEvents).length > 0) {
  Object.entries(queueEvents).forEach(([key, events]) => {
    if (events) {
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
        // Only log if it's not a connection refused error (Redis not configured)
        if (!err.message || !err.message.includes('ECONNREFUSED')) {
          console.error(`[QueueEvents:${key}] error`, err);
        }
        // Otherwise silently ignore - Redis is optional
      });
    }
  });
} else {
  console.log('[Queues] Redis not configured - queues disabled (optional)');
}

const enqueueJob = async (queueKey, jobName, payload, opts = {}) => {
  // If Redis/queues aren't available, just log and continue (queues are optional)
  if (!connection || !queues[queueKey]) {
    console.warn(`[Queues] Cannot enqueue ${jobName} - Redis not configured. Job would be: ${JSON.stringify(payload)}`);
    return null; // Return null instead of throwing - queues are optional
  }

  const queue = queues[queueKey];
  return queue.add(jobName, payload, opts);
};

module.exports = {
  QUEUE_NAMES,
  queues,
  queueEvents,
  enqueueJob,
};

