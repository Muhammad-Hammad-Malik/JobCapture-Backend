const { LEGACY_STACKS, CATEGORIES, TRACKS, SKILLS } = require('./taxonomy');

// Legacy single-value field (kept for older clients). New code should use categories + skills.
const STACK_OPTIONS = LEGACY_STACKS;

const REMOTE_TYPE_OPTIONS = ['remote', 'hybrid', 'onsite'];

const JOB_STATUS_OPTIONS = ['open', 'closed'];

// Buckets filter on the lowest years-of-experience bound. "unspecified" = the post didn't say.
const EXPERIENCE_BUCKETS = {
  unspecified: { experienceYears: null },
  '0-1': { experienceYears: { $gte: 0, $lte: 1 } },
  '2-3': { experienceYears: { $gte: 2, $lte: 3 } },
  '4-6': { experienceYears: { $gte: 4, $lte: 6 } },
  '7+': { experienceYears: { $gte: 7 } },
};

module.exports = {
  STACK_OPTIONS,
  REMOTE_TYPE_OPTIONS,
  JOB_STATUS_OPTIONS,
  CATEGORIES,
  TRACKS,
  SKILLS,
  EXPERIENCE_BUCKETS,
};
