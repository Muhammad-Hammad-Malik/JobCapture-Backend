const Company = require('../models/Company');
const CompanySubmission = require('../models/CompanySubmission');
const Job = require('../models/Job');
const ApiError = require('../utils/ApiError');

async function listSubmissions(req, res, next) {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const items = await CompanySubmission.find({ status }).sort({ createdAt: -1 }).limit(600).select('-ipHash').lean();
    res.json({ error: false, items });
  } catch (e) { next(e); }
}

async function applySubmission(sub) {
  if (sub.type === 'size') {
    await Company.updateOne({ key: sub.companyKey }, { size: sub.value });
  } else {
    await Company.updateOne(
      { key: sub.companyKey, 'communityEmails.email': { $ne: sub.value } },
      { $push: { communityEmails: { email: sub.value, addedAt: new Date() } } },
    );
  }
}

// Approves every pending suggestion of one kind (used for batches of researched company sizes).
async function approveAll(req, res, next) {
  try {
    const { type, source } = req.body || {};
    if (type !== 'size') throw new ApiError(400, 'Only type "size" can be approved in bulk.');
    const filter = { status: 'pending', type: 'size', ...(source ? { source } : {}) };
    const subs = await CompanySubmission.find(filter);
    for (const sub of subs) {
      await applySubmission(sub);
      sub.status = 'approved';
      sub.decidedAt = new Date();
      await sub.save();
    }
    res.json({ error: false, approved: subs.length });
  } catch (e) { next(e); }
}

async function decide(req, res, next) {
  try {
    const { action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) throw new ApiError(400, 'action must be "approve" or "reject".');
    const sub = await CompanySubmission.findById(req.params.id);
    if (!sub) throw new ApiError(404, 'Submission not found.');
    if (sub.status !== 'pending') throw new ApiError(409, `Already ${sub.status}.`);

    if (action === 'approve') await applySubmission(sub);
    sub.status = action === 'approve' ? 'approved' : 'rejected';
    sub.decidedAt = new Date();
    await sub.save();
    res.json({ error: false, item: sub });
  } catch (e) { next(e); }
}

// Merge a duplicate company into another: its jobs move over and its key becomes an alias.
async function merge(req, res, next) {
  try {
    const { from, to } = req.body || {};
    if (!from || !to || from === to) throw new ApiError(400, 'Provide two different company keys: from and to.');
    const [source, target] = await Promise.all([Company.findOne({ key: from }), Company.findOne({ key: to })]);
    if (!source || !target) throw new ApiError(404, 'Company not found.');

    const moved = await Job.updateMany({ companyKey: source.key }, { companyKey: target.key });
    target.keyAliases = [...new Set([...target.keyAliases, source.key, ...source.keyAliases])];
    target.size = target.size || source.size;
    for (const c of source.communityEmails) {
      if (!target.communityEmails.some(t => t.email === c.email)) target.communityEmails.push(c);
    }
    await target.save();
    await CompanySubmission.updateMany({ companyKey: source.key }, { companyKey: target.key, companyName: target.name });
    await Company.deleteOne({ _id: source._id });
    res.json({ error: false, movedJobs: moved.modifiedCount, into: target.key });
  } catch (e) { next(e); }
}

module.exports = { listSubmissions, decide, approveAll, merge };
