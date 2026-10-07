const Job = require('../models/Job');
const escapeRegex = require('../utils/escapeRegex');
const {
  STACK_OPTIONS,
  REMOTE_TYPE_OPTIONS,
  JOB_STATUS_OPTIONS,
  CATEGORIES,
  TRACKS,
  SKILLS,
  EXPERIENCE_BUCKETS,
} = require('../constants');
const { SKILL_DEFS, CATEGORY_DEFS } = require('../taxonomy');

// "a,b,c" (or repeated ?x=a&x=b) -> ['a','b','c']
function toList(value) {
  if (value == null) return [];
  const parts = Array.isArray(value) ? value : String(value).split(',');
  return parts.map(v => String(v).trim()).filter(Boolean);
}

const pickValid = (value, allowed) => toList(value).filter(v => allowed.includes(v));

// Builds the Mongo filter shared by the list endpoint. Multi-valued filters match ANY selected
// value; different filters combine with AND. `skillsMatch=all` requires every selected skill.
function buildFilter(query) {
  const and = [{ deletedAt: null }];
  and.push({ status: JOB_STATUS_OPTIONS.includes(query.status) ? query.status : 'open' });

  if (TRACKS.includes(query.track)) and.push({ track: query.track });

  const categories = pickValid(query.categories, CATEGORIES);
  if (categories.length) and.push({ categories: { $in: categories } });

  const skills = pickValid(query.skills, SKILLS);
  if (skills.length) {
    and.push({ skills: query.skillsMatch === 'all' ? { $all: skills } : { $in: skills } });
  }

  // "unspecified" = the post named no city (empty or missing list); combines with real cities via OR.
  const cityValues = toList(query.cities);
  if (cityValues.length) {
    const named = cityValues.filter(c => c !== 'unspecified');
    const clauses = [];
    if (named.length) clauses.push({ cities: { $in: named } });
    if (cityValues.includes('unspecified')) clauses.push({ cities: { $size: 0 } }, { cities: { $exists: false } });
    and.push({ $or: clauses });
  }

  const remoteTypes = pickValid(query.remoteType, REMOTE_TYPE_OPTIONS);
  if (remoteTypes.length) and.push({ remoteType: { $in: remoteTypes } });

  // Legacy single-value stack filter, still honoured for older clients.
  if (STACK_OPTIONS.includes(query.stack)) and.push({ stack: query.stack });

  const buckets = pickValid(query.experience, Object.keys(EXPERIENCE_BUCKETS));
  if (buckets.length) and.push({ $or: buckets.map(b => EXPERIENCE_BUCKETS[b]) });

  const minExperience = parseInt(query.minExperience, 10);
  const maxExperience = parseInt(query.maxExperience, 10);
  if (!Number.isNaN(minExperience) || !Number.isNaN(maxExperience)) {
    const range = {};
    if (!Number.isNaN(minExperience)) range.$gte = minExperience;
    if (!Number.isNaN(maxExperience)) range.$lte = maxExperience;
    and.push({ experienceYears: range });
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    and.push({ $or: [{ jobTitle: rx }, { company: rx }, { description: rx }, { skills: rx }, { categories: rx }] });
  }

  return { $and: and };
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const filter = buildFilter(req.query);

    const [data, total] = await Promise.all([
      Job.find(filter, '-rawText')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Job.countDocuments(filter),
    ]);

    res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
}

const countsOf = rows => Object.fromEntries(rows.map(r => [r._id, r.n]));

// Everything the filter UI needs to render its options, with counts over currently open jobs.
async function facets(req, res, next) {
  try {
    const match = { deletedAt: null, status: 'open' };
    const unwindCount = field => [
      { $match: match },
      { $unwind: `$${field}` },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ];
    const scalarCount = field => [
      { $match: { ...match, [field]: { $ne: null } } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ];

    const [categories, skills, cities, tracks, remote, noExperience, noCity, total] = await Promise.all([
      Job.aggregate(unwindCount('categories')),
      Job.aggregate(unwindCount('skills')),
      Job.aggregate(unwindCount('cities')),
      Job.aggregate(scalarCount('track')),
      Job.aggregate(scalarCount('remoteType')),
      Job.countDocuments({ ...match, experienceYears: null }),
      Job.countDocuments({ ...match, $or: [{ cities: { $size: 0 } }, { cities: { $exists: false } }] }),
      Job.countDocuments(match),
    ]);

    const categoryCounts = countsOf(categories);
    const skillCounts = countsOf(skills);

    const experience = { unspecified: noExperience };
    for (const [bucket, cond] of Object.entries(EXPERIENCE_BUCKETS)) {
      if (bucket !== 'unspecified') experience[bucket] = await Job.countDocuments({ ...match, ...cond });
    }

    res.json({
      total,
      tracks: countsOf(tracks),
      categories: CATEGORY_DEFS.map(c => ({ name: c.name, track: c.track, count: categoryCounts[c.name] || 0 })),
      skills: SKILL_DEFS.map(s => ({ name: s.name, group: s.group, count: skillCounts[s.name] || 0 })),
      cities: cities.map(c => ({ name: c._id, count: c.n })).sort((a, b) => b.count - a.count),
      citiesUnspecified: noCity,
      remoteTypes: countsOf(remote),
      experience,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, facets, buildFilter };
