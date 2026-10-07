const Job = require('../models/Job');
const ApiError = require('../utils/ApiError');
const { JOB_STATUS_OPTIONS } = require('../constants');
const { deriveTrack, deriveLegacyStack, normalizeCities } = require('../taxonomy');
const { normalizeUrl } = require('../services/jobService');
const escapeRegex = require('../utils/escapeRegex');

const MAX_PAGE_SIZE = 100;

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { deletedAt: null };

    if (JOB_STATUS_OPTIONS.includes(req.query.status)) filter.status = req.query.status;

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ jobTitle: rx }, { company: rx }];
    }

    // rawText is large and never shown in the list; it is still returned by GET /jobs/:id.
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

async function getOne(req, res, next) {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) throw new ApiError(404, 'Job not found.');
    res.json(job);
  } catch (e) {
    next(e);
  }
}

const EDITABLE_FIELDS = [
  'jobTitle',
  'company',
  'isCompanyNameFallback',
  'stack',
  'categories',
  'skills',
  'cities',
  'experienceYears',
  'location',
  'remoteType',
  'description',
  'contactEmail',
  'applicationLink',
  'posterName',
  'sourceUrl',
  'status',
];

async function update(req, res, next) {
  try {
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updates[field] = req.body[field];
      }
    }
    if (Array.isArray(updates.cities)) updates.cities = normalizeCities(updates.cities);
    if (Array.isArray(updates.categories)) {
      // Keep the derived fields consistent with what the admin picked.
      updates.track = deriveTrack(updates.categories);
      if (!Object.prototype.hasOwnProperty.call(updates, 'stack')) {
        updates.stack = deriveLegacyStack(updates.categories, updates.skills || []);
      }
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'sourceUrl')) {
      updates.sourceUrlNormalized = normalizeUrl(updates.sourceUrl);
    }

    const job = await Job.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!job) throw new ApiError(404, 'Job not found.');
    res.json(job);
  } catch (e) {
    next(e);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!JOB_STATUS_OPTIONS.includes(status)) {
      throw new ApiError(400, `status must be one of ${JOB_STATUS_OPTIONS.join(', ')}.`);
    }

    const job = await Job.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!job) throw new ApiError(404, 'Job not found.');
    res.json(job);
  } catch (e) {
    next(e);
  }
}

// Permanent delete of a single job (distinct from the soft-delete bulkClear below).
async function remove(req, res, next) {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) throw new ApiError(404, 'Job not found.');
    res.json({ error: false, message: 'Job deleted.' });
  } catch (e) {
    next(e);
  }
}

// Soft-deletes (deletedAt set, row kept) every active job older than N weeks.
async function bulkClear(req, res, next) {
  try {
    const weeks = parseFloat(req.query.olderThanWeeks);
    if (!weeks || weeks <= 0) {
      throw new ApiError(400, 'olderThanWeeks must be a positive number.');
    }

    const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
    const result = await Job.updateMany(
      { createdAt: { $lt: cutoff }, deletedAt: null },
      { deletedAt: new Date() },
    );

    res.json({
      error: false,
      message: `Cleared ${result.modifiedCount} job(s) older than ${weeks} week(s).`,
      count: result.modifiedCount,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, update, updateStatus, remove, bulkClear };
