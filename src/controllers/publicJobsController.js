const Job = require('../models/Job');
const { STACK_OPTIONS, REMOTE_TYPE_OPTIONS, JOB_STATUS_OPTIONS } = require('../constants');

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);

    const filter = { deletedAt: null };

    filter.status = JOB_STATUS_OPTIONS.includes(req.query.status) ? req.query.status : 'open';

    if (STACK_OPTIONS.includes(req.query.stack)) {
      filter.stack = req.query.stack;
    }

    if (REMOTE_TYPE_OPTIONS.includes(req.query.remoteType)) {
      filter.remoteType = req.query.remoteType;
    }

    const minExperience = parseInt(req.query.minExperience, 10);
    const maxExperience = parseInt(req.query.maxExperience, 10);
    if (!Number.isNaN(minExperience) || !Number.isNaN(maxExperience)) {
      filter.experienceYears = {};
      if (!Number.isNaN(minExperience)) filter.experienceYears.$gte = minExperience;
      if (!Number.isNaN(maxExperience)) filter.experienceYears.$lte = maxExperience;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ jobTitle: searchRegex }, { company: searchRegex }, { description: searchRegex }];
    }

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

module.exports = { list };
