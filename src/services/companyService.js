const Job = require('../models/Job');
const Company = require('../models/Company');
const { companyKey, looksLikePosterName } = require('../utils/companyKey');

const PERSONAL_DOMAINS = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|proton|protonmail|aol)\./i;
const isPersonalEmail = email => PERSONAL_DOMAINS.test(email || '');

function isFallbackName(job) {
  return !!job.isCompanyNameFallback || looksLikePosterName(job.company, job.posterName);
}

// Maps a name to the company key it should be filed under (following admin merges), or null.
async function resolveKey(name, { fallback = false, posterName = null } = {}) {
  if (fallback || looksLikePosterName(name, posterName)) return null;
  const key = companyKey(name);
  if (!key) return null;
  const merged = await Company.findOne({ keyAliases: key }).select('key').lean();
  return merged ? merged.key : key;
}

// Called whenever a job is created/edited: makes sure the company exists and returns its key.
async function registerCompany(name, opts = {}) {
  const key = await resolveKey(name, opts);
  if (!key) return null;
  await Company.updateOne({ key }, { $setOnInsert: { key, name: String(name).trim() } }, { upsert: true });
  return key;
}

const PAGE_MAX = 48;

async function listCompanies({ search, sort = 'jobs', page = 1, limit = 24 }) {
  limit = Math.min(PAGE_MAX, Math.max(1, parseInt(limit, 10) || 24));
  page = Math.max(1, parseInt(page, 10) || 1);
  const term = String(search || '').trim();
  const termKey = companyKey(term);
  const sorts = {
    jobs: { openJobs: -1, totalJobs: -1, name: 1 },
    recent: { lastPostedAt: -1 },
    name: { sortName: 1 },
    total: { totalJobs: -1, name: 1 },
  };

  const pipeline = [
    { $match: { companyKey: { $ne: null } } },
    { $group: {
      _id: '$companyKey',
      totalJobs: { $sum: 1 },
      openJobs: { $sum: { $cond: [{ $and: [{ $eq: ['$deletedAt', null] }, { $eq: ['$status', 'open'] }] }, 1, 0] } },
      lastPostedAt: { $max: '$createdAt' },
      latestName: { $last: '$company' },
    } },
    { $lookup: { from: 'companies', localField: '_id', foreignField: 'key', as: 'c' } },
    { $addFields: {
      key: '$_id',
      name: { $ifNull: [{ $arrayElemAt: ['$c.name', 0] }, '$latestName'] },
      size: { $arrayElemAt: ['$c.size', 0] },
    } },
    { $addFields: { sortName: { $toLower: '$name' } } },
  ];
  if (term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pipeline.push({ $match: { $or: [{ name: new RegExp(escaped, 'i') }, ...(termKey ? [{ key: new RegExp(termKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }] : [])] } });
  }
  pipeline.push(
    { $sort: sorts[sort] || sorts.jobs },
    { $facet: {
      data: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { _id: 0, key: 1, name: 1, size: 1, totalJobs: 1, openJobs: 1, lastPostedAt: 1 } }],
      total: [{ $count: 'n' }],
    } },
  );

  const [{ data, total }] = await Job.aggregate(pipeline);
  const keys = data.map(c => c.key);
  const skills = keys.length
    ? await Job.aggregate([
        { $match: { companyKey: { $in: keys } } },
        { $unwind: '$skills' },
        { $group: { _id: { k: '$companyKey', s: '$skills' }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $group: { _id: '$_id.k', top: { $push: '$_id.s' } } },
      ])
    : [];
  const topByKey = new Map(skills.map(r => [r._id, r.top.slice(0, 4)]));

  const count = total[0]?.n || 0;
  return {
    data: data.map(c => ({ ...c, topSkills: topByKey.get(c.key) || [] })),
    total: count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}

const tally = (items) => {
  const m = new Map();
  for (const i of items) m.set(i, (m.get(i) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
};

async function getCompanyDetail(rawKey) {
  const asked = String(rawKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const company = await Company.findOne({ $or: [{ key: asked }, { keyAliases: asked }] }).lean();
  if (!company) return null;

  const jobs = await Job.find({ companyKey: company.key }).sort({ createdAt: -1 }).select('-rawText').lean();
  const isOpen = j => !j.deletedAt && j.status === 'open';
  const open = jobs.filter(isOpen);
  const past = jobs
    .filter(j => !isOpen(j))
    .map(j => ({ ...j, closedAt: j.deletedAt || (j.status === 'closed' ? j.updatedAt : null) }));

  // Every distinct contact email we have seen on this company's jobs, plus approved community ones.
  const seen = new Map();
  for (const j of jobs) {
    const e = (j.contactEmail || '').trim().toLowerCase();
    if (!e) continue;
    const entry = seen.get(e) || { email: e, source: 'job posts', jobs: 0, lastSeen: j.createdAt };
    entry.jobs += 1;
    seen.set(e, entry);
  }
  for (const c of company.communityEmails || []) {
    if (!seen.has(c.email)) seen.set(c.email, { email: c.email, source: 'community', jobs: 0, lastSeen: c.addedAt });
  }
  const emails = [...seen.values()]
    .map(e => ({ ...e, personal: isPersonalEmail(e.email) }))
    .sort((a, b) => Number(a.personal) - Number(b.personal) || b.jobs - a.jobs);

  return {
    key: company.key,
    name: company.name,
    size: company.size,
    emails,
    technologies: tally(jobs.flatMap(j => j.skills || [])).slice(0, 30),
    categories: tally(jobs.flatMap(j => j.categories || [])).slice(0, 8),
    cities: tally(jobs.flatMap(j => j.cities || [])).slice(0, 8),
    stats: {
      totalJobs: jobs.length,
      openJobs: open.length,
      pastJobs: past.length,
      firstPostedAt: jobs.length ? jobs[jobs.length - 1].createdAt : null,
      lastPostedAt: jobs.length ? jobs[0].createdAt : null,
    },
    openJobs: open,
    pastJobs: past,
  };
}

module.exports = { registerCompany, resolveKey, isFallbackName, isPersonalEmail, listCompanies, getCompanyDetail };
