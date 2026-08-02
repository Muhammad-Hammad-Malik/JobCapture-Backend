const Job = require('../models/Job');
const { deriveCompanyFromEmail } = require('../utils/deriveCompanyFromEmail');

async function list(req, res, next) {
  try {
    // Includes soft-deleted (cleared) jobs on purpose — this is a full historical contact list.
    const jobs = await Job.find({ contactEmail: { $ne: null } })
      .sort({ createdAt: -1 })
      .select('contactEmail company isCompanyNameFallback jobTitle status deletedAt createdAt');

    const byEmail = new Map();
    for (const job of jobs) {
      const email = job.contactEmail?.trim().toLowerCase();
      if (!email) continue;

      if (!byEmail.has(email)) {
        byEmail.set(email, { email, realCompany: null, jobs: [] });
      }
      const entry = byEmail.get(email);

      // job.company is already the best available value as of ingest time (real company, or
      // email-domain-derived, with isCompanyNameFallback true only in the rare case neither was
      // available). This re-derivation is just a safety net for older records ingested before
      // that logic existed.
      if (!entry.realCompany && job.company && !job.isCompanyNameFallback) {
        entry.realCompany = job.company;
      }

      entry.jobs.push({
        _id: job._id,
        jobTitle: job.jobTitle,
        company: job.company,
        status: job.status,
        cleared: !!job.deletedAt,
        createdAt: job.createdAt,
      });
    }

    const data = Array.from(byEmail.values())
      .map(({ email, realCompany, jobs: jobRefs }) => ({
        email,
        company: realCompany || deriveCompanyFromEmail(email),
        jobs: jobRefs,
      }))
      .sort((a, b) => b.jobs.length - a.jobs.length);

    res.json({ data, total: data.length });
  } catch (e) {
    next(e);
  }
}

module.exports = { list };
