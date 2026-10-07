const Job = require('../models/Job');
const ApiError = require('../utils/ApiError');
const { structureJobPost } = require('../services/geminiService');
const { normalizeUrl, findDuplicateByUrl, findDuplicate } = require('../services/jobService');
const { buildClassification } = require('../services/classificationService');
const { CLASSIFICATION_VERSION } = require('../taxonomy');

const MAX_RAW_TEXT_CHARS = 30000;

async function ingest(req, res, next) {
  try {
    const { rawText, sourceUrl } = req.body || {};
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      throw new ApiError(400, 'rawText is required.');
    }
    if (rawText.length > MAX_RAW_TEXT_CHARS) {
      throw new ApiError(413, `rawText is too long (max ${MAX_RAW_TEXT_CHARS} characters).`);
    }

    // Fast path: if this exact post URL was already ingested, skip the LLM call entirely.
    const urlDuplicate = await findDuplicateByUrl(sourceUrl);
    if (urlDuplicate) {
      console.log(`[ingest] duplicate of ${urlDuplicate._id} (matched by sourceUrl)`);
      throw new ApiError(409, 'A job from this LinkedIn post URL already exists.', {
        _id: urlDuplicate._id,
      });
    }

    console.log(`[ingest] structuring ${rawText.length} chars of raw text`);
    const structured = await structureJobPost(rawText);

    if (!structured) {
      console.log('[ingest] rejected: not recognized as a job post');
      throw new ApiError(422, 'This does not look like a job post.');
    }

    const sourceUrlNormalized = normalizeUrl(sourceUrl);
    const results = [];

    for (const role of structured.jobs) {
      const existing = await findDuplicate(structured.company, role.jobTitle);
      if (existing) {
        console.log(`[ingest] duplicate of ${existing._id} (matched by company + title: ${role.jobTitle})`);
        results.push({ status: 'duplicate', jobTitle: role.jobTitle, _id: existing._id });
        continue;
      }

      const classification = buildClassification(role);
      if (classification.warnings.length) {
        console.warn(`[ingest] classification warnings for "${role.jobTitle}": ${classification.warnings.join('; ')}`);
      }

      const job = await Job.create({
        rawText,
        sourceUrl: sourceUrl || null,
        sourceUrlNormalized,
        jobTitle: role.jobTitle,
        company: structured.company,
        isCompanyNameFallback: !!structured.isCompanyNameFallback,
        categories: classification.categories,
        skills: classification.skills,
        unknownSkills: classification.unknownSkills,
        track: classification.track,
        stack: classification.stack,
        classificationVersion: CLASSIFICATION_VERSION,
        experienceYears: Number.isFinite(role.experienceYears) ? role.experienceYears : null,
        cities: classification.cities,
        location: classification.cities.join(', ') || null,
        remoteType: role.remoteType ?? null,
        description: role.description ?? '',
        contactEmail: structured.contactEmail ?? null,
        applicationLink: structured.applicationLink ?? null,
        posterName: structured.posterName ?? null,
      });

      console.log(`[ingest] saved ${job._id} (${job.company} / ${job.jobTitle})`);
      results.push({ status: 'created', job });
    }

    const createdCount = results.filter(r => r.status === 'created').length;
    const duplicateCount = results.length - createdCount;
    res.json({ error: false, results, createdCount, duplicateCount });
  } catch (e) {
    next(e);
  }
}

module.exports = { ingest };
