const crypto = require('crypto');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const CLIENT_TYPES = new Set([
  'pageview', 'page_leave', 'job_open', 'apply_click', 'email_click', 'source_click',
  'search', 'filter', 'track_switch', 'page_change', 'perf', 'api_error', 'api_slow', 'js_error',
  'company_open', 'company_submit',
]);
const MAX_BATCH = 25;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|preview|curl\/|wget|python-requests|axios|node-fetch|go-http|java\//i;

const str = (v, max = 120) => (typeof v === 'string' && v ? v.slice(0, max) : undefined);
const num = (v, min, max) => (Number.isFinite(v) && v >= min && v <= max ? v : undefined);

function parseUserAgent(ua = '') {
  const bot = !ua || BOT_RE.test(ua);
  let device = 'desktop';
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) device = 'tablet';
  else if (/mobi|iphone|ipod|android/i.test(ua)) device = 'mobile';

  let os = 'Other';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  const pick = [
    ['Edge', /edg(?:e|a|ios)?\/(\d+)/i], ['Opera', /opr\/(\d+)/i], ['Samsung Internet', /samsungbrowser\/(\d+)/i],
    ['Firefox', /(?:firefox|fxios)\/(\d+)/i], ['Chrome', /(?:chrome|crios)\/(\d+)/i], ['Safari', /version\/(\d+).*safari/i],
  ].find(([, re]) => re.test(ua));
  const browser = pick ? `${pick[0]} ${ua.match(pick[1])[1]}` : 'Other';
  return { bot, device, os, browser };
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
}

// Salted per-day hash: gives rough uniqueness without ever storing the address itself.
function hashIp(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT || process.env.JWT_SECRET || 'jobcapture';
  return crypto.createHash('sha256').update(`${salt}|${day}|${ip}`).digest('hex').slice(0, 16);
}

// Vercel adds these headers to every request (free). Absent when running locally.
function geoFromHeaders(h) {
  const dec = v => { try { return v ? decodeURIComponent(v) : undefined; } catch { return v || undefined; } };
  const round = v => (v && Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : undefined);
  return {
    country: dec(h['x-vercel-ip-country']) || 'Unknown',
    region: dec(h['x-vercel-ip-country-region']),
    city: dec(h['x-vercel-ip-city']),
    lat: round(h['x-vercel-ip-latitude']),
    lon: round(h['x-vercel-ip-longitude']),
  };
}

// Keeps event payloads flat and tiny: primitives and short string arrays only.
function cleanData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(data).slice(0, 14)) {
    if (!/^[A-Za-z0-9_]{1,24}$/.test(key)) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 200);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.slice(0, 10).filter(v => typeof v === 'string').map(v => v.slice(0, 60));
  }
  return Object.keys(out).length ? out : undefined;
}

function buildEvents(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const ctx = body.ctx || {};
  const ua = parseUserAgent(req.headers['user-agent']);
  if (ua.bot || !ID_RE.test(ctx.vid || '') || !ID_RE.test(ctx.sid || '')) return [];

  const common = {
    platform: 'web',
    vid: ctx.vid,
    sid: ctx.sid,
    firstVisit: ctx.isNew === true,
    ip: hashIp(clientIp(req)),
    ...geoFromHeaders(req.headers),
    device: ua.device,
    os: ua.os,
    browser: ua.browser,
    ref: str(ctx.ref, 100),
    utm: ctx.utm && typeof ctx.utm === 'object' ? { s: str(ctx.utm.s, 60), m: str(ctx.utm.m, 60), c: str(ctx.utm.c, 80) } : undefined,
    lang: str(ctx.lang, 12),
    tz: str(ctx.tz, 50),
    scr: str(ctx.scr, 16),
    theme: ['dark', 'light'].includes(ctx.theme) ? ctx.theme : undefined,
    conn: str(ctx.conn, 12),
  };

  const now = Date.now();
  return (Array.isArray(body.events) ? body.events : [])
    .slice(0, MAX_BATCH)
    .filter(e => e && CLIENT_TYPES.has(e.type))
    .map(e => ({
      ...common,
      type: e.type,
      ts: new Date(now - (num(e.ago, 0, 3600000) || 0)),
      path: str(e.path, 80),
      hour: num(e.hour, 0, 23),
      dow: num(e.dow, 0, 6),
      data: cleanData(e.data),
    }));
}

async function recordClientEvents(req) {
  const docs = buildEvents(req);
  if (docs.length) await AnalyticsEvent.insertMany(docs, { ordered: false });
  return docs.length;
}

// Server-side events (e.g. ingest success/failure). Never throws — analytics must not break features.
async function recordServerEvent(type, data) {
  try {
    await AnalyticsEvent.create({ ts: new Date(), type, platform: 'server', data: cleanData(data) });
  } catch (e) {
    console.warn('[analytics] could not record server event:', e.message);
  }
}

module.exports = { recordClientEvents, recordServerEvent, parseUserAgent, hashIp };
