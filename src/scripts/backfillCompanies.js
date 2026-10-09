/**
 * Links every job (live AND cleared) to a company, and creates the company records.
 *
 *   node src/scripts/backfillCompanies.js                       # dry run: prints what would happen
 *   node src/scripts/backfillCompanies.js --apply [--allow-remote]
 *
 * No LLM calls. Safe to re-run: it only sets job.companyKey and upserts companies.
 * Refuses a non-local database unless --allow-remote is given.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Company = require('../models/Company');
const { companyKey, looksLikePosterName } = require('../utils/companyKey');

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI || '';
  const local = /localhost|127\.0\.0\.1/.test(uri);
  if (apply && !local && !process.argv.includes('--allow-remote')) {
    throw new Error('Refusing to write to a non-local database without --allow-remote.');
  }
  await mongoose.connect(uri);
  console.log(`Database host: ${mongoose.connection.host} (${local ? 'local' : 'REMOTE'})`);

  const jobs = await Job.find({}).select('company isCompanyNameFallback posterName companyKey createdAt').sort({ createdAt: 1 }).lean();
  const mergedAliases = new Map((await Company.find({ keyAliases: { $ne: [] } }).select('key keyAliases').lean())
    .flatMap(c => c.keyAliases.map(a => [a, c.key])));

  const companies = new Map(); // key -> { name, variants:Set, jobs }
  const jobOps = [];
  let skipped = 0;
  for (const j of jobs) {
    const fallback = j.isCompanyNameFallback || looksLikePosterName(j.company, j.posterName);
    let key = fallback ? null : companyKey(j.company);
    if (key && mergedAliases.has(key)) key = mergedAliases.get(key);
    if (!key) skipped += 1;
    if (key) {
      const c = companies.get(key) || { name: j.company.trim(), variants: new Set(), jobs: 0 };
      c.variants.add(j.company.trim());
      c.jobs += 1;
      c.name = j.company.trim(); // newest spelling wins (jobs are sorted oldest -> newest)
      companies.set(key, c);
    }
    if ((j.companyKey || null) !== key) jobOps.push({ updateOne: { filter: { _id: j._id }, update: { $set: { companyKey: key } } } });
  }

  const merged = [...companies.entries()].filter(([, c]) => c.variants.size > 1);
  console.log(`${jobs.length} jobs -> ${companies.size} companies; ${skipped} jobs have no company (poster names).`);
  console.log(`${jobOps.length} jobs need their companyKey set/updated.`);
  console.log(`${merged.length} companies unify spelling variants:`);
  merged.slice(0, 15).forEach(([k, c]) => console.log(`  ${k}: ${[...c.variants].join('  |  ')}`));

  if (!apply) {
    console.log('\n(Dry run — nothing written. Re-run with --apply.)');
  } else {
    if (jobOps.length) await Job.bulkWrite(jobOps, { ordered: false });
    await Company.bulkWrite(
      [...companies.entries()].map(([key, c]) => ({
        updateOne: { filter: { key }, update: { $setOnInsert: { key, name: c.name } }, upsert: true },
      })),
      { ordered: false },
    );
    console.log(`\nApplied: ${jobOps.length} jobs updated, ${await Company.countDocuments()} companies in the collection.`);
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
