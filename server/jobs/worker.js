const { Worker } = require('bullmq');

const { connection } = require('../config/redis');
const { QUEUE_NAMES } = require('./queues');
const { processIngestionJob } = require('../services/ingestion');

const concurrency = Number(process.env.JOB_WORKER_CONCURRENCY || 5);

const handlers = {
  [QUEUE_NAMES.NOTIFICATIONS]: async (job) => {
    console.log(`[Queue:notifications] processing job ${job.id}`, job.name, job.data);
    // TODO: send push/email/SMS notifications
    return { status: 'stubbed' };
  },
  [QUEUE_NAMES.AGENT_RECOMMENDATIONS]: async (job) => {
    console.log(`[Queue:agent-recommendations] processing job ${job.id}`, job.name, job.data);
    // TODO: kick off agent ML pipeline / scoring
    return { status: 'stubbed' };
  },
  [QUEUE_NAMES.REWARDS]: async (job) => {
    console.log(`[Queue:rewards] processing job ${job.id}`, job.name, job.data);
    // TODO: update reward balances, ledger entries, streaks
    return { status: 'stubbed' };
  },
  [QUEUE_NAMES.INGESTION]: async (job) => {
    console.log(`[Queue:ingestion] processing job ${job.id}`, job.name);
    return processIngestionJob(job.data);
  },
};

const startWorker = (queueName) => {
  const worker = new Worker(
    queueName,
    async (job) => {
      const handler = handlers[queueName];
      if (!handler) {
        console.warn(`No handler registered for queue ${queueName}`);
        return null;
      }
      return handler(job);
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker:${queueName}] completed job ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${queueName}] failed job ${job?.id}`, err);
  });

  worker.on('error', (err) => {
    console.error(`[Worker:${queueName}] error`, err);
  });

  return worker;
};

console.log('[Worker] starting BullMQ workers with concurrency', concurrency);

Object.values(QUEUE_NAMES).forEach((queueName) => {
  startWorker(queueName);
});

process.on('SIGINT', async () => {
  console.log('[Worker] shutting down gracefully');
  await connection.quit();
  process.exit(0);
});

