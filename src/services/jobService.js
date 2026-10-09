const Job = require('../models/Job');
const escapeRegex = require('../utils/escapeRegex');
const { companyKey } = require('../utils/companyKey');

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

// Same role at the same company: matches the exact name, or any spelling that normalises to the
// same company key (e.g. "Acme Pvt Ltd" vs "ACME").
function findDuplicate(company, jobTitle) {
  const key = companyKey(company);
  const title = new RegExp(`^${escapeRegex(jobTitle)}$`, 'i');
  return Job.findOne({
    $or: [{ company: new RegExp(`^${escapeRegex(company)}$`, 'i') }, ...(key ? [{ companyKey: key }] : [])],
    jobTitle: title,
    deletedAt: null,
  });
}

module.exports = { normalizeUrl, findDuplicateByUrl, findDuplicate };
