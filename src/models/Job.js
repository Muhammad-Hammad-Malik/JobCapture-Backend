const mongoose = require('mongoose');
const {
  STACK_OPTIONS,
  REMOTE_TYPE_OPTIONS,
  JOB_STATUS_OPTIONS,
  CATEGORIES,
  TRACKS,
  SKILLS,
} = require('../constants');

const jobSchema = new mongoose.Schema(
  {
    rawText: { type: String, required: true },
    jobTitle: { type: String, required: true },
    company: { type: String, required: true },
    isCompanyNameFallback: { type: Boolean, default: false },

    // --- Classification (multi-valued). `categories[0]` is the primary category.
    categories: { type: [{ type: String, enum: CATEGORIES }], default: [] },
    skills: { type: [{ type: String, enum: SKILLS }], default: [] },
    // Technologies the LLM saw that are not in the closed SKILLS list — a review queue.
    unknownSkills: { type: [String], default: [] },
    track: { type: String, enum: [...TRACKS, null], default: null },
    classificationVersion: { type: Number, default: null },
    classificationConfidence: { type: Number, default: null },

    // Legacy single-value field, derived from categories/skills, kept for older clients.
    stack: { type: String, enum: [...STACK_OPTIONS, null], default: null },

    experienceYears: { type: Number, default: null }, // null = not specified in the post
    cities: { type: [String], default: [] }, // city names only
    location: { type: String, default: null }, // legacy free-text location
    remoteType: { type: String, enum: [...REMOTE_TYPE_OPTIONS, null], default: null },
    description: { type: String, default: '' },
    contactEmail: { type: String, default: null },
    applicationLink: { type: String, default: null },
    posterName: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    sourceUrlNormalized: { type: String, default: null, index: true },
    status: { type: String, enum: JOB_STATUS_OPTIONS, default: 'open' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });
jobSchema.index({ categories: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ cities: 1 });

module.exports = mongoose.model('Job', jobSchema);
