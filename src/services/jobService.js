const Job = require('../models/Job');
const escapeRegex = require('../utils/escapeRegex');

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const stripped = url.trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
  return stripped || null;
}

function findDuplicateByUrl(sourceUrl) {
  const normalized = normalizeUrl(sourceUrl);
  if (!normalized) return Promise.resolve(null);
  return Job.findOne({ sourceUrlNormalized: normalized, deletedAt: null });
}

function findDuplicate(company, jobTitle) {
  return Job.findOne({
    company: new RegExp(`^${escapeRegex(company)}$`, 'i'),
    jobTitle: new RegExp(`^${escapeRegex(jobTitle)}$`, 'i'),
    deletedAt: null,
  });
}

module.exports = { normalizeUrl, findDuplicateByUrl, findDuplicate };
