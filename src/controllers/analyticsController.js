const ApiError = require('../utils/ApiError');
const { buildDashboard, todayStr, addDays } = require('../services/analyticsQuery');

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const text = v => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined);

async function dashboard(req, res, next) {
  try {
    const q = req.query;
    const to = q.to || todayStr();
    const days = Math.min(365, Math.max(1, parseInt(q.days, 10) || 0));
    const from = q.from || addDays(to, -((days || 30) - 1));
    if (!DAY_RE.test(from) || !DAY_RE.test(to)) throw new ApiError(400, 'from/to must be YYYY-MM-DD.');
    const data = await buildDashboard({
      from, to, granularity: q.granularity,
      country: text(q.country), city: text(q.city),
      platform: ['web'].includes(q.platform) ? q.platform : undefined,
      device: ['desktop', 'mobile', 'tablet'].includes(q.device) ? q.device : undefined,
    });
    res.json({ error: false, ...data });
  } catch (e) {
    next(e);
  }
}

module.exports = { dashboard };
