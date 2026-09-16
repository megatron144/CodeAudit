const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
const redisOptions = redisUrl
  ? (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://') ? redisUrl : `redis://${redisUrl}`)
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    };

const redis = new Redis(redisOptions, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  }
});

redis.on('connect', () => {
  console.log('[Redis] Connected to cluster/instance');
});

redis.on('error', (err) => {
  console.warn(`[Redis] Connection warning: ${err.message}`);
});

module.exports = redis;
