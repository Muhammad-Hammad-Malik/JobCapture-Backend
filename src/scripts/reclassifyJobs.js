/**
 * One-off re-classification of existing jobs into the multi-valued taxonomy
 * (categories[], skills[], cities[], track, ...).
 *
 *   DRY RUN (default) — calls the LLM, writes a reviewable report, changes NOTHING in the DB:
 *     node src/scripts/reclassifyJobs.js [--limit 30] [--concurrency 4] [--model google/gemini-2.5-flash]
 *                                        [--ids id1,id2] [--include-cleared]
 *     node src/scripts/reclassifyJobs.js --resume reports/<report>.json   # redo only the failed entries
 *   Uses the FREE model by default and never falls back to a paid one unless --paid-fallback is given.
 *
 *   APPLY — writes exactly what a (reviewed / hand-edited) report says. No LLM calls:
 *     node src/scripts/reclassifyJobs.js --apply --from reports/reclassify-<ts>.json [--allow-remote]
 *
 * In a report, set "skip": true on an entry to leave that job untouched, or edit its "after".
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDb } = require('../config/db');
const Job = require('../models/Job');
const { CLASSIFY_PROMPT } = require('../prompts/classifyPrompt');
const { callLlmJson } = require('../services/llmClient');

// Migrations default to a FREE model so nothing spends credits implicitly; pass --model to change.
const DEFAULT_PRIMARY_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const { buildClassification } = require('../services/classificationService');
const { titleHints } = require('../taxonomy/titleRules');
const { CLASSIFICATION_VERSION } = require('../taxonomy');

const REPORT_DIR = path.join(__dirname, '..', '..', 'reports');
const LOW_CONFIDENCE = 0.6;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

function describeTarget() {
  const uri = process.env.MONGODB_URI || '';
  const host = (uri.match(/@([^/?]+)/) || uri.match(/\/\/([^/?]+)/) || [])[1] || 'unknown';
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  return { host, isLocal };
}

function csvCell(v) {
  const s = Array.isArray(v) ? v.join(' | ') : v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

async function classifyOne(job, model, allowPaidFallback = false) {
  const prompt = CLASSIFY_PROMPT
    .replace('{{TITLE}}', () => job.jobTitle)
    .replace('{{COMPANY}}', () => job.company)
    .replace('{{LOCATION}}', () => job.location || 'none')
    .replace('{{EXPERIENCE}}', () => (job.experienceYears == null ? 'not specified' : String(job.experienceYears)))
    .replace('{{DESCRIPTION}}', () => job.description || '')
    .replace('{{RAW_TEXT}}', () => (job.rawText || '').slice(0, 6000));

  const llm = await callLlmJson(prompt, {
    model,
    fallback: allowPaidFallback, // never spend credits implicitly; pass --paid-fallback to allow it
    maxTokens: 2048,
    validate: p => { if (!p || !Array.isArray(p.categories)) throw new Error('missing categories'); },
  });

  const c = buildClassification(llm);
  const confidence = typeof llm.confidence === 'number' ? llm.confidence : null;
  const flags = [...c.warnings];

  if (confidence != null && confidence < LOW_CONFIDENCE) flags.push(`low confidence (${confidence})`);
  const hints = titleHints(job.jobTitle).filter(h => !c.categories.includes(h));
  if (hints.length) flags.push(`title suggests ${hints.join(' / ')} but not assigned`);
  if (c.unknownSkills.length) flags.push(`unknown skills: ${c.unknownSkills.join(', ')}`);

  const llmExp = Number.isFinite(llm.experienceYears) ? llm.experienceYears : null;
  const fillExperience = job.experienceYears == null && llmExp != null;
  if (fillExperience) flags.push(`experience filled from post: ${llmExp}`);
  if (job.experienceYears != null && llmExp != null && llmExp !== job.experienceYears) {
    flags.push(`experience differs (stored ${job.experienceYears}, post says ${llmExp}) — kept stored`);
  }

  return {
    _id: String(job._id),
    jobTitle: job.jobTitle,
    company: job.company,
    before: { stack: job.stack, location: job.location, experienceYears: job.experienceYears },
    after: {
      categories: c.categories,
      skills: c.skills,
      unknownSkills: c.unknownSkills,
      cities: c.cities,
      track: c.track,
      stack: c.stack,
      experienceYears: fillExperience ? llmExp : job.experienceYears ?? null,
      confidence,
    },
    reasoning: llm.reasoning || null,
    flags,
    skip: false,
  };
}

async function runPool(items, concurrency, worker) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i], i);
      }
    }),
  );
  return results;
}

async function dryRun(args) {
  const filter = { deletedAt: null };
  if (args.ids) filter._id = { $in: String(args.ids).split(',') };
  if (args['include-cleared']) delete filter.deletedAt;

  let previous = null;
  if (args.resume && args.resume !== true) {
    previous = JSON.parse(fs.readFileSync(path.resolve(args.resume), 'utf8'));
    const failedIds = previous.entries.filter(e => e.error).map(e => e._id);
    console.log(`Resuming: ${failedIds.length} failed entr${failedIds.length === 1 ? 'y' : 'ies'} to redo.`);
    filter._id = { $in: failedIds };
  }

  let jobs = await Job.find(filter).sort({ createdAt: -1 });
  if (args.limit) jobs = jobs.slice(0, parseInt(args.limit, 10));

  const model = args.model || (previous && previous.model) || process.env.MIGRATION_MODEL || DEFAULT_PRIMARY_MODEL;
  const concurrency = parseInt(args.concurrency, 10) || 4;
  console.log(`Classifying ${jobs.length} job(s) with ${model} (concurrency ${concurrency})...`);

  let done = 0;
  let entries = await runPool(jobs, concurrency, async job => {
    try {
      return await classifyOne(job, model, !!args['paid-fallback']);
    } catch (e) {
      return {
        _id: String(job._id),
        jobTitle: job.jobTitle,
        company: job.company,
        error: e.message,
        flags: ['LLM call failed'],
        skip: true,
      };
    } finally {
      if (++done % 25 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length}`);
    }
  });

  if (previous) {
    const redone = new Map(entries.map(e => [e._id, e]));
    entries = previous.entries.map(e => redone.get(e._id) || e);
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(REPORT_DIR, `reclassify-${stamp}`);
  fs.writeFileSync(
    `${base}.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), model, classificationVersion: CLASSIFICATION_VERSION, entries }, null, 2),
  );

  const header = ['id', 'title', 'company', 'old_stack', 'categories', 'skills', 'cities', 'old_location', 'experience', 'confidence', 'flags'];
  const rows = entries.map(e => [
    e._id, e.jobTitle, e.company, e.before?.stack, e.after?.categories, e.after?.skills, e.after?.cities,
    e.before?.location, e.after?.experienceYears, e.after?.confidence, e.flags,
  ]);
  fs.writeFileSync(`${base}.csv`, [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n'));

  // Console summary
  const ok = entries.filter(e => !e.error);
  const count = (fn) => ok.reduce((acc, e) => { fn(e).forEach(k => { acc[k] = (acc[k] || 0) + 1; }); return acc; }, {});
  const sorted = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]);
  console.log(`\nDone. ${ok.length} classified, ${entries.length - ok.length} failed, ${ok.filter(e => e.flags.length).length} flagged for review.`);
  console.log('\nPrimary categories:');
  sorted(count(e => [e.after.categories[0]])).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
  console.log(`\nMulti-category jobs: ${ok.filter(e => e.after.categories.length > 1).length}`);
  console.log(`Jobs with a city: ${ok.filter(e => e.after.cities.length).length}  |  without: ${ok.filter(e => !e.after.cities.length).length}`);
  console.log(`Experience unspecified: ${ok.filter(e => e.after.experienceYears == null).length}`);
  console.log('\nTop skills:');
  sorted(count(e => e.after.skills)).slice(0, 25).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
  console.log(`\nReport:  ${base}.json\nSpreadsheet:  ${base}.csv\n(Nothing was written to the database.)`);
}

async function apply(args) {
  if (!args.from || args.from === true) throw new Error('--apply requires --from <report.json>');
  const target = describeTarget();
  if (!target.isLocal && !args['allow-remote']) {
    throw new Error(`Refusing to write to non-local database "${target.host}". Pass --allow-remote if you really mean it.`);
  }

  const report = JSON.parse(fs.readFileSync(path.resolve(args.from), 'utf8'));
  const ops = [];
  let skipped = 0;
  for (const e of report.entries) {
    if (e.skip || e.error || !e.after) { skipped++; continue; }
    // Re-validate: the report may have been hand-edited.
    const c = buildClassification({ categories: e.after.categories, skills: e.after.skills, unknownSkills: e.after.unknownSkills, cities: e.after.cities });
    const $set = {
      categories: c.categories,
      skills: c.skills,
      unknownSkills: c.unknownSkills,
      cities: c.cities,
      track: c.track,
      stack: c.stack,
      classificationVersion: CLASSIFICATION_VERSION,
      classificationConfidence: e.after.confidence ?? null,
    };
    ops.push({ updateOne: { filter: { _id: e._id }, update: { $set } } });
    // Fill experience only where the live value is still empty, so an edit made since the report
    // was generated can never be overwritten.
    if (e.before?.experienceYears == null && Number.isFinite(e.after.experienceYears)) {
      ops.push({
        updateOne: { filter: { _id: e._id, experienceYears: null }, update: { $set: { experienceYears: e.after.experienceYears } } },
      });
    }
  }

  console.log(`Applying ${ops.length} update(s) to ${target.host} (${skipped} skipped)...`);
  const result = await Job.bulkWrite(ops, { ordered: false });
  console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = describeTarget();
  console.log(`Database host: ${target.host}${target.isLocal ? ' (local)' : ' (REMOTE)'}`);
  await connectDb();
  try {
    if (args.apply) await apply(args);
    else await dryRun(args);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(e => {
  console.error(`\nError: ${e.message}`);
  process.exit(1);
});
