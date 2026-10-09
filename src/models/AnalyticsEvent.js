const mongoose = require('mongoose');

// One small document per tracked event. Raw events expire automatically (TTL) so the free Atlas
// tier never fills up; aggregate views are computed on demand by services/analyticsQuery.js.
const RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS) || 180;

const analyticsEventSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    type: { type: String, required: true },
    platform: { type: String, default: 'web' }, // web | server
    vid: String, // anonymous visitor id (random, stored in the browser)
    sid: String, // session id
    firstVisit: Boolean, // first visit for this visitor id
    ip: String, // salted daily hash — never the raw address
    country: String,
    region: String,
    city: String,
    lat: Number,
    lon: Number,
    device: String,
    os: String,
    browser: String,
    ref: String, // referrer host
    utm: { s: String, m: String, c: String },
    path: String,
    lang: String,
    tz: String,
    hour: Number, // visitor-local hour 0-23
    dow: Number, // visitor-local weekday 0-6
    scr: String,
    theme: String,
    conn: String,
    data: mongoose.Schema.Types.Mixed,
  },
  { versionKey: false },
);

analyticsEventSchema.index({ ts: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400 });
analyticsEventSchema.index({ type: 1, ts: -1 });
analyticsEventSchema.index({ sid: 1 });

module.exports = mongoose.models.AnalyticsEvent || mongoose.model('AnalyticsEvent', analyticsEventSchema);
