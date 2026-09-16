const { Queue } = require('bullmq');
const redis = require('../config/redis');

const QUEUE_NAME = 'analysis-jobs';

const analysisQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,
      age: 86400,
    },
    removeOnFail: {
      count: 50,
    }
  }
});

const enqueueAnalysis = async (jobPayload) => {
  const job = await analysisQueue.add('run-audit', jobPayload, {
    jobId: jobPayload.analysisId.toString(),
  });
  console.log(`[BullMQ] Enqueued analysis job ${job.id} for analysis ${jobPayload.analysisId}`);
  return job;
};

module.exports = {
  analysisQueue,
  enqueueAnalysis,
  QUEUE_NAME
};
