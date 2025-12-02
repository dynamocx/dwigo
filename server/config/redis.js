const { QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Only create Redis connection if URL is configured (not empty string)
const hasRedisConfig = redisUrl && redisUrl.trim() !== '' && redisUrl !== 'redis://127.0.0.1:6379';

const connection = hasRedisConfig 
  ? new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        // Stop retrying after 3 attempts
        if (times > 3) {
          return null;
        }
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true, // Don't connect immediately
    })
  : null;

if (connection) {
  connection.on('error', (err) => {
    // Only log if Redis is actually configured (not just default localhost)
    if (hasRedisConfig) {
      console.error('[Redis] connection error', err);
    }
    // Otherwise silently ignore - Redis is optional
  });

  connection.on('ready', () => {
    console.log('[Redis] connection ready');
  });

  // Try to connect, but don't fail if it doesn't work
  connection.connect().catch(() => {
    // Silently fail - Redis is optional
  });
} else {
  // Redis not configured - that's fine, it's optional
  console.log('[Redis] Not configured (optional - app works without it)');
}

const buildQueueEvents = (queueName) =>
  new QueueEvents(queueName, {
    connection,
  });

module.exports = {
  connection,
  buildQueueEvents,
};

