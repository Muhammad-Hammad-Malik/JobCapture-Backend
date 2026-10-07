const ApiError = require('../utils/ApiError');

// Small in-memory sliding-window limiter, keyed by client IP. On serverless each warm instance
// keeps its own counters, so this is a best-effort brake against runaway/abusive clients (every
// submission costs an LLM call), not a hard global quota.
function rateLimit({ windowMs, max, skip }) {
  const hits = new Map();

  return function limiter(req, res, next) {
    if (skip && skip(req)) return next();

    const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      return next(new ApiError(429, `Too many submissions. Try again in ${retryAfter}s.`));
    }

    recent.push(now);
    hits.set(ip, recent);

    if (hits.size > 5000) {
      for (const [key, times] of hits) {
        if (times.every(t => now - t >= windowMs)) hits.delete(key);
      }
    }
    next();
  };
}

module.exports = { rateLimit };
