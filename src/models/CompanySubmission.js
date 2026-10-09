const mongoose = require('mongoose');

// Community-suggested company details. Nothing is public until an admin approves it.
const submissionSchema = new mongoose.Schema(
  {
    companyKey: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    type: { type: String, enum: ['email', 'size'], required: true },
    value: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    source: { type: String, enum: ['community', 'research'], default: 'community' },
    note: { type: String, default: null }, // e.g. where a researched value came from
    ipHash: String,
    decidedAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.models.CompanySubmission || mongoose.model('CompanySubmission', submissionSchema);
