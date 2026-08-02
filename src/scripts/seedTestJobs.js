require('dotenv').config();
const mongoose = require('mongoose');
const { connectDb } = require('../config/db');
const Job = require('../models/Job');

const DAY_MS = 24 * 60 * 60 * 1000;

const TEST_JOBS = [
  { ageDays: 3, jobTitle: 'Frontend Developer', company: 'FreshCo Labs', stack: 'Frontend' },
  { ageDays: 9, jobTitle: 'Backend Engineer', company: 'OneWeekAgo Inc', stack: 'Backend' },
  { ageDays: 16, jobTitle: 'MERN Stack Developer', company: 'TwoWeeksAgo Ltd', stack: 'MERN' },
  { ageDays: 23, jobTitle: '.NET Developer', company: 'ThreeWeeksAgo Corp', stack: '.NET' },
  { ageDays: 30, jobTitle: 'AI Engineer', company: 'FourWeeksAgo Group', stack: 'AI Engineer' },
];

async function main() {
  await connectDb();

  for (const { ageDays, jobTitle, company, stack } of TEST_JOBS) {
    const createdAt = new Date(Date.now() - ageDays * DAY_MS);
    const job = await Job.create({
      rawText: `[test data] ${jobTitle} at ${company}`,
      jobTitle,
      company,
      isCompanyNameFallback: false,
      stack,
      experienceYears: 2,
      location: 'Remote',
      remoteType: 'remote',
      description: `[Test data] Sample ${jobTitle} posting for bulk-clear testing, seeded ${ageDays} days old.`,
      contactEmail: null,
      applicationLink: null,
      posterName: null,
      sourceUrl: null,
      status: 'open',
      createdAt,
      updatedAt: createdAt,
    });
    console.log(`Created ${job._id}: ${jobTitle} @ ${company} (${ageDays} days old, createdAt=${createdAt.toISOString()})`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
