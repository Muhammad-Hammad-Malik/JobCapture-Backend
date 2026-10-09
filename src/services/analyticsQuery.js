const AnalyticsEvent = require('../models/AnalyticsEvent');
const Job = require('../models/Job');

const TZ = process.env.ANALYTICS_TZ || 'Asia/Karachi';
const DAY_MS = 86400000;
const INTERACTION = ['job_open', 'apply_click', 'email_click', 'source_click', 'search', 'filter', 'track_switch', 'page_change'];
const CLICKS = ['apply_click', 'email_click', 'source_click'];

// ---- time helpers (day strings are YYYY-MM-DD in the analytics timezone) -------------------
function tzOffsetMs(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map(p => [p.type, p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}
const dayStart = day => {
  const [y, m, d] = day.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMs(guess));
};
const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

function bucketExpr(granularity) {
  const format = { day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' }[granularity];
  return { $dateToString: { format, date: '$ts', timezone: TZ } };
}

// ---- reusable pipeline pieces ---------------------------------------------------------------
// Count distinct visitors (and raw events) per value of `field`.
const breakdown = (match, field, { type = 'pageview', limit = 12 } = {}) =>
  AnalyticsEvent.aggregate([
    { $match: { ...match, type, [field]: { $nin: [null, ''] } } },
    { $group: { _id: { k: `$${field}`, v: '$vid' }, n: { $sum: 1 } } },
    { $group: { _id: '$_id.k', visitors: { $sum: 1 }, views: { $sum: '$n' } } },
    { $sort: { visitors: -1, views: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: '$_id', visitors: 1, views: 1 } },
  ]);

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null);

function fillSeries(rows, granularity, from, to) {
  const byBucket = new Map(rows.map(r => [r._id, r]));
  const make = (bucket, r) => ({ bucket, visitors: r?.visitors || 0, sessions: r?.sessions || 0, pageviews: r?.pageviews || 0 });
  if (granularity !== 'day') return [...byBucket.keys()].sort().map(b => make(b, byBucket.get(b)));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(make(d, byBucket.get(d)));
  return out;
}

function retention(pairs, today) {
  const daysByVisitor = new Map();
  for (const { v, d } of pairs) {
    if (!daysByVisitor.has(v)) daysByVisitor.set(v, []);
    daysByVisitor.get(v).push(d);
  }
  const out = { d1: { cohort: 0, returned: 0 }, d7: { cohort: 0, returned: 0 }, d30: { cohort: 0, returned: 0 } };
  for (const days of daysByVisitor.values()) {
    days.sort();
    const first = days[0];
    const age = diffDays(first, today);
    for (const [key, n] of [['d1', 1], ['d7', 7], ['d30', 30]]) {
      if (age < n) continue; // not old enough to judge yet
      out[key].cohort += 1;
      if (days.some(d => { const gap = diffDays(first, d); return gap >= 1 && gap <= n; })) out[key].returned += 1;
    }
  }
  return out;
}

async function storageInfo() {
  const count = await AnalyticsEvent.estimatedDocumentCount();
  const oldest = await AnalyticsEvent.findOne().sort({ ts: 1 }).select('ts').lean();
  let bytes = null;
  try {
    const [stats] = await AnalyticsEvent.aggregate([{ $collStats: { storageStats: {} } }]);
    bytes = stats?.storageStats?.size ?? null;
  } catch (e) { /* not permitted on some tiers; fall back to an estimate */ }
  return {
    events: count,
    bytes: bytes ?? count * 450,
    estimated: bytes === null,
    oldest: oldest?.ts || null,
    retentionDays: Number(process.env.ANALYTICS_RETENTION_DAYS) || 180,
  };
}

// ---- main entry -----------------------------------------------------------------------------
async function buildDashboard({ from, to, granularity, country, city, platform, device }) {
  const today = todayStr();
  to = to > today ? today : to;
  if (from > to) from = to;
  if (diffDays(from, to) > 365) from = addDays(to, -365);
  if (!['day', 'week', 'month'].includes(granularity)) {
    const span = diffDays(from, to) + 1;
    granularity = span <= 31 ? 'day' : span <= 120 ? 'week' : 'month';
  }

  const start = dayStart(from);
  const end = dayStart(addDays(to, 1));
  const range = { ts: { $gte: start, $lt: end } };
  const match = { ...range, platform: 'web' };
  if (country) match.country = country;
  if (city) match.city = city;
  if (platform) match.platform = platform;
  if (device) match.device = device;
  const bucket = bucketExpr(granularity);
  const pv = { ...match, type: 'pageview' };

  const [
    seriesRows, totalsRows, sessionRows, countries, cities, regions, devices, oss, browsers, referrers, utmSources,
    languages, screens, themes, connections, timezones, paths, hourRows, dowRows,
    topJobs, topApplied, searches, filterRows, trackRows, pageRows, funnelRows, leaveRows, scrollRows,
    perfRows, apiRows, recentErrors, retentionPairs, active, options, storage,
    jobsByDay, jobTracks, jobCategories, jobCities, jobSkills, ingestRows,
  ] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: pv },
      { $group: { _id: { b: bucket, v: '$vid' }, pv: { $sum: 1 }, s: { $addToSet: '$sid' } } },
      { $group: { _id: '$_id.b', visitors: { $sum: 1 }, pageviews: { $sum: '$pv' }, sessions: { $sum: { $size: '$s' } } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: pv },
      { $group: { _id: '$vid', pv: { $sum: 1 }, firstVisit: { $max: '$firstVisit' }, s: { $addToSet: '$sid' } } },
      { $group: { _id: null, visitors: { $sum: 1 }, pageviews: { $sum: '$pv' }, sessions: { $sum: { $size: '$s' } }, newVisitors: { $sum: { $cond: ['$firstVisit', 1, 0] } } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: { $in: ['pageview', 'page_leave', ...INTERACTION] } } },
      { $group: {
        _id: '$sid',
        pv: { $sum: { $cond: [{ $eq: ['$type', 'pageview'] }, 1, 0] } },
        inter: { $sum: { $cond: [{ $in: ['$type', INTERACTION] }, 1, 0] } },
        first: { $min: '$ts' }, last: { $max: '$ts' },
      } },
      { $group: {
        _id: null, sessions: { $sum: 1 }, pages: { $avg: '$pv' },
        bounced: { $sum: { $cond: [{ $and: [{ $lte: ['$pv', 1] }, { $eq: ['$inter', 0] }] }, 1, 0] } },
        duration: { $avg: { $subtract: ['$last', '$first'] } },
      } },
    ]),
    breakdown(match, 'country', { limit: 20 }), breakdown(match, 'city', { limit: 20 }), breakdown(match, 'region', { limit: 15 }),
    breakdown(match, 'device'), breakdown(match, 'os'), breakdown(match, 'browser'),
    breakdown(match, 'ref', { limit: 15 }), breakdown(match, 'utm.s'),
    breakdown(match, 'lang'), breakdown(match, 'scr'), breakdown(match, 'theme'), breakdown(match, 'conn'), breakdown(match, 'tz'),
    breakdown(match, 'path'),
    AnalyticsEvent.aggregate([{ $match: { ...pv, hour: { $ne: null } } }, { $group: { _id: '$hour', n: { $sum: 1 } } }]),
    AnalyticsEvent.aggregate([{ $match: { ...pv, dow: { $ne: null } } }, { $group: { _id: '$dow', n: { $sum: 1 } } }]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'job_open', 'data.jobId': { $ne: null } } },
      { $group: { _id: '$data.jobId', opens: { $sum: 1 }, v: { $addToSet: '$vid' }, title: { $first: '$data.title' }, company: { $first: '$data.company' } } },
      { $project: { _id: 0, jobId: '$_id', opens: 1, visitors: { $size: '$v' }, title: 1, company: 1 } },
      { $sort: { opens: -1 } }, { $limit: 15 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: { $in: CLICKS }, 'data.jobId': { $ne: null } } },
      { $group: { _id: '$data.jobId', clicks: { $sum: 1 }, title: { $first: '$data.title' }, company: { $first: '$data.company' } } },
      { $project: { _id: 0, jobId: '$_id', clicks: 1, title: 1, company: 1 } },
      { $sort: { clicks: -1 } }, { $limit: 15 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'search', 'data.q': { $nin: [null, ''] } } },
      { $group: { _id: { $toLower: '$data.q' }, count: { $sum: 1 }, avgResults: { $avg: '$data.results' }, zero: { $sum: { $cond: [{ $eq: ['$data.results', 0] }, 1, 0] } } } },
      { $project: { _id: 0, q: '$_id', count: 1, avgResults: { $round: ['$avgResults', 0] }, zero: 1 } },
      { $sort: { count: -1 } }, { $limit: 100 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'filter', 'data.key': { $ne: null } } },
      { $unwind: { path: '$data.values', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { k: '$data.key', v: '$data.values' }, count: { $sum: 1 } } },
      { $project: { _id: 0, key: '$_id.k', value: '$_id.v', count: 1 } },
      { $sort: { count: -1 } }, { $limit: 25 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'track_switch' } },
      { $group: { _id: { $ifNull: ['$data.track', 'all'] }, count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'page_change' } },
      { $group: { _id: null, changes: { $sum: 1 }, deepest: { $max: '$data.page' }, avgPage: { $avg: '$data.page' } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: { $in: ['pageview', 'job_open', ...CLICKS] } } },
      { $group: {
        _id: '$sid',
        a: { $max: { $cond: [{ $eq: ['$type', 'pageview'] }, 1, 0] } },
        b: { $max: { $cond: [{ $eq: ['$type', 'job_open'] }, 1, 0] } },
        c: { $max: { $cond: [{ $in: ['$type', CLICKS] }, 1, 0] } },
      } },
      { $group: { _id: null, visited: { $sum: '$a' }, opened: { $sum: '$b' }, applied: { $sum: '$c' } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'page_leave', 'data.dur': { $gte: 0 } } },
      { $group: { _id: null, avgSeconds: { $avg: '$data.dur' }, n: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: 'page_leave', 'data.scroll': { $ne: null } } },
      { $group: { _id: { $switch: { branches: [
        { case: { $lt: ['$data.scroll', 25] }, then: '0-24%' }, { case: { $lt: ['$data.scroll', 50] }, then: '25-49%' },
        { case: { $lt: ['$data.scroll', 75] }, then: '50-74%' }, { case: { $lt: ['$data.scroll', 100] }, then: '75-99%' },
      ], default: '100%' } }, count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.find({ ...match, type: 'perf' }).select('data').limit(5000).lean(),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: { $in: ['api_slow', 'api_error'] } } },
      { $group: { _id: { e: '$data.endpoint', t: '$type' }, count: { $sum: 1 }, avgMs: { $avg: '$data.ms' }, status: { $last: '$data.status' } } },
      { $sort: { count: -1 } }, { $limit: 15 },
    ]),
    AnalyticsEvent.find({ ...match, type: { $in: ['js_error', 'api_error'] } }).sort({ ts: -1 }).limit(15)
      .select('ts type data path browser os').lean(),
    AnalyticsEvent.aggregate([
      { $match: { platform: 'web', type: 'pageview' } },
      { $group: { _id: { v: '$vid', d: { $dateToString: { format: '%Y-%m-%d', date: '$ts', timezone: TZ } } } } },
      { $limit: 200000 },
      { $project: { _id: 0, v: '$_id.v', d: '$_id.d' } },
    ]),
    AnalyticsEvent.distinct('vid', { platform: 'web', ts: { $gte: new Date(Date.now() - 5 * 60000) } }),
    Promise.all([
      AnalyticsEvent.aggregate([{ $match: { ...range, platform: 'web', type: 'pageview', country: { $ne: null } } }, { $group: { _id: '$country' } }, { $sort: { _id: 1 } }, { $limit: 100 }]),
      AnalyticsEvent.aggregate([{ $match: { ...range, platform: 'web', type: 'pageview', city: { $ne: null } } }, { $group: { _id: '$city' } }, { $sort: { _id: 1 } }, { $limit: 200 }]),
    ]),
    storageInfo(),
    Job.aggregate([
      { $match: { deletedAt: null, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
    ]),
    Job.aggregate([{ $match: { deletedAt: null, createdAt: { $gte: start, $lt: end } } }, { $group: { _id: '$track', count: { $sum: 1 } } }]),
    Job.aggregate([{ $match: { deletedAt: null, createdAt: { $gte: start, $lt: end } } }, { $unwind: '$categories' }, { $group: { _id: '$categories', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Job.aggregate([{ $match: { deletedAt: null, createdAt: { $gte: start, $lt: end } } }, { $unwind: '$cities' }, { $group: { _id: '$cities', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Job.aggregate([{ $match: { deletedAt: null, createdAt: { $gte: start, $lt: end } } }, { $unwind: '$skills' }, { $group: { _id: '$skills', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    AnalyticsEvent.aggregate([
      { $match: { ...range, platform: 'server', type: { $in: ['ingest_ok', 'ingest_fail'] } } },
      { $group: { _id: { t: '$type', by: '$data.by', reason: '$data.reason' }, count: { $sum: 1 }, avgMs: { $avg: '$data.ms' } } },
    ]),
  ]);

  const t = totalsRows[0] || { visitors: 0, pageviews: 0, sessions: 0, newVisitors: 0 };
  const s = sessionRows[0] || { sessions: 0, pages: 0, bounced: 0, duration: 0 };
  const f = funnelRows[0] || { visited: 0, opened: 0, applied: 0 };
  const perfLoads = perfRows.map(r => r.data?.load).filter(Number.isFinite).sort((a, b) => a - b);
  const ingestOk = ingestRows.filter(r => r._id.t === 'ingest_ok');
  const ingestFail = ingestRows.filter(r => r._id.t === 'ingest_fail');
  const sum = rows => rows.reduce((n, r) => n + r.count, 0);
  const avg = (rows) => { const c = sum(rows); return c ? Math.round(rows.reduce((n, r) => n + (r.avgMs || 0) * r.count, 0) / c) : null; };
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, views: hourRows.find(r => r._id === h)?.n || 0 }));
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => ({ name, views: dowRows.find(r => r._id === i)?.n || 0 }));
  const dayCounts = new Map(jobsByDay.map(r => [r._id, r.count]));
  const submissionsPerDay = [];
  for (let d = from; d <= to; d = addDays(d, 1)) submissionsPerDay.push({ day: d, count: dayCounts.get(d) || 0 });

  return {
    range: { from, to, granularity, timezone: TZ },
    filters: { country: country || null, city: city || null, platform: platform || null, device: device || null },
    options: { countries: options[0].map(r => r._id), cities: options[1].map(r => r._id) },
    live: { activeNow: active.length },
    totals: {
      visitors: t.visitors, sessions: t.sessions, pageviews: t.pageviews,
      newVisitors: t.newVisitors, returningVisitors: Math.max(0, t.visitors - t.newVisitors),
      sessionsPerVisitor: t.visitors ? +(t.sessions / t.visitors).toFixed(2) : 0,
      pagesPerSession: +(s.pages || 0).toFixed(2),
      bounceRate: s.sessions ? +((s.bounced / s.sessions) * 100).toFixed(1) : 0,
      avgSessionSeconds: Math.round((s.duration || 0) / 1000),
    },
    series: fillSeries(seriesRows, granularity, from, to),
    audience: { countries, cities, regions, languages, timezones },
    tech: { devices, os: oss, browsers, screens, themes, connections },
    sources: { referrers, utmSources, paths },
    time: { hours, weekdays: dows },
    behavior: {
      topJobs, topApplied,
      topSearches: searches.slice(0, 15),
      zeroResultSearches: searches.filter(r => r.zero > 0).sort((a, b) => b.zero - a.zero).slice(0, 15),
      filters: filterRows,
      trackSwitch: trackRows.map(r => ({ name: r._id, count: r.count })),
      paging: pageRows[0] ? { changes: pageRows[0].changes, deepest: pageRows[0].deepest, avgPage: +(pageRows[0].avgPage || 0).toFixed(1) } : null,
      funnel: [
        { step: 'Visited the list', sessions: f.visited },
        { step: 'Opened a job', sessions: f.opened },
        { step: 'Clicked apply / email / source', sessions: f.applied },
      ],
      timeOnPageSeconds: leaveRows[0] ? Math.round(leaveRows[0].avgSeconds) : null,
      scrollDepth: ['0-24%', '25-49%', '50-74%', '75-99%', '100%'].map(name => ({ name, count: scrollRows.find(r => r._id === name)?.count || 0 })),
    },
    retention: retention(retentionPairs, todayStr()),
    quality: {
      pageLoad: { samples: perfLoads.length, avg: perfLoads.length ? Math.round(perfLoads.reduce((a, b) => a + b, 0) / perfLoads.length) : null, p50: percentile(perfLoads, 0.5), p95: percentile(perfLoads, 0.95) },
      apiIssues: apiRows.map(r => ({ endpoint: r._id.e, kind: r._id.t === 'api_error' ? 'error' : 'slow', count: r.count, avgMs: Math.round(r.avgMs || 0), status: r.status })),
      recentErrors: recentErrors.map(e => ({ ts: e.ts, type: e.type, message: e.data?.msg || e.data?.endpoint || '', detail: e.data?.src || (e.data?.status ? `HTTP ${e.data.status}` : ''), path: e.path, browser: e.browser, os: e.os })),
    },
    supply: {
      submissionsPerDay,
      total: submissionsPerDay.reduce((n, d) => n + d.count, 0),
      byTrack: jobTracks.map(r => ({ name: r._id || 'unknown', count: r.count })),
      topCategories: jobCategories.map(r => ({ name: r._id, count: r.count })),
      topCities: jobCities.map(r => ({ name: r._id, count: r.count })),
      topSkills: jobSkills.map(r => ({ name: r._id, count: r.count })),
      ingest: {
        ok: sum(ingestOk), failed: sum(ingestFail), avgMsOk: avg(ingestOk),
        failReasons: ingestFail.map(r => ({ reason: r._id.reason || 'unknown', by: r._id.by || '', count: r.count })).sort((a, b) => b.count - a.count).slice(0, 8),
      },
    },
    storage,
  };
}

module.exports = { buildDashboard, todayStr, addDays };
