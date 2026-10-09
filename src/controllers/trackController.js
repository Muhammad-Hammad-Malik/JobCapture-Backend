const { recordClientEvents } = require('../services/analyticsCollector');

// Public, fire-and-forget collector. Always answers 204 so the site is never affected by tracking.
async function track(req, res) {
  try {
    await recordClientEvents(req);
  } catch (e) {
    console.warn('[track] failed:', e.message);
  }
  res.status(204).end();
}

module.exports = { track };
