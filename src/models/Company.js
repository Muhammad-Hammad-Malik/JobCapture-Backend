const mongoose = require('mongoose');

const SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

// One document per company (identified by the normalised `key`). Jobs link to it via job.companyKey.
// Only things that are NOT derivable from jobs live here: size, and community-approved emails.
const companySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    keyAliases: { type: [String], default: [], index: true }, // keys merged into this company
    size: { type: String, enum: [...SIZE_OPTIONS, null], default: null },
    communityEmails: { type: [{ email: String, addedAt: Date, _id: false }], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
module.exports.SIZE_OPTIONS = SIZE_OPTIONS;
