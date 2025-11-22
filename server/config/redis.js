const { QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

connection.on('error', (err) => {
  console.error('[Redis] connection error', err);
});

connection.on('ready', () => {
  console.log('[Redis] connection ready');
});

const buildQueueEvents = (queueName) =>
  new QueueEvents(queueName, {
    connection,
  });

module.exports = {
  connection,
  buildQueueEvents,
};

