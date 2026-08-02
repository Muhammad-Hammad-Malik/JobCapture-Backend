const mongoose = require('mongoose');
const { STACK_OPTIONS, REMOTE_TYPE_OPTIONS, JOB_STATUS_OPTIONS } = require('../constants');

const jobSchema = new mongoose.Schema(
  {
    rawText: { type: String, required: true },
    jobTitle: { type: String, required: true },
    company: { type: String, required: true },
    isCompanyNameFallback: { type: Boolean, default: false },
    stack: { type: String, enum: STACK_OPTIONS, required: true },
    experienceYears: { type: Number, default: null },
    location: { type: String, default: null },
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

module.exports = mongoose.model('Job', jobSchema);
