const redis = require('../config/redis');

// Max analyses per user per hour
const MAX_ANALYSES_PER_HOUR = 30;
// Max repo size in KB (e.g. 100MB = 100,000KB)
const MAX_REPO_SIZE_KB = 100000;

const analysisRateLimiter = async (req, res, next) => {
  try {
    const identifier = req.user ? `user:${req.user._id}` : `ip:${req.ip}`;
    const key = `ratelimit:analysis:${identifier}`;

    let current = 1;
    try {
      current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 3600); // 1 hour window
      }
    } catch (redisErr) {
      // Fallback gracefully if Redis is momentarily unavailable
      return next();
    }

    if (current > MAX_ANALYSES_PER_HOUR) {
      return res.status(429).json({
        message: `Rate limit exceeded. Maximum ${MAX_ANALYSES_PER_HOUR} analyses per hour.`,
        retryAfter: 3600
      });
    }

    next();
  } catch (err) {
    next();
  }
};

const checkRepoSizeCap = (repoData) => {
  if (repoData && repoData.size && repoData.size > MAX_REPO_SIZE_KB) {
    throw new Error(`Repository size (${Math.round(repoData.size / 1024)}MB) exceeds limit of ${MAX_REPO_SIZE_KB / 1024}MB.`);
  }
  return true;
};

module.exports = {
  analysisRateLimiter,
  checkRepoSizeCap,
  MAX_REPO_SIZE_KB,
  MAX_ANALYSES_PER_HOUR
};
