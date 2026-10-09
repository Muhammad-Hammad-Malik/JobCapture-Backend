const Company = require('../models/Company');
const CompanySubmission = require('../models/CompanySubmission');
const ApiError = require('../utils/ApiError');
const { listCompanies, getCompanyDetail } = require('../services/companyService');
const { hashIp } = require('../services/analyticsCollector');

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

async function list(req, res, next) {
  try {
    res.json({ error: false, ...(await listCompanies(req.query)) });
  } catch (e) { next(e); }
}

async function detail(req, res, next) {
  try {
    const data = await getCompanyDetail(req.params.key);
    if (!data) throw new ApiError(404, 'Company not found.');
    res.json({ error: false, ...data });
  } catch (e) { next(e); }
}

// Anyone can suggest a company email or size; it stays hidden until an admin approves it.
async function submit(req, res, next) {
  try {
    const { type, value, website } = req.body || {};
    if (website) return res.status(201).json({ error: false, message: 'Thanks!' }); // honeypot: pretend success
    const company = await Company.findOne({ key: String(req.params.key || '').toLowerCase() }).lean();
    if (!company) throw new ApiError(404, 'Company not found.');

    let clean;
    if (type === 'email') {
      clean = String(value || '').trim().toLowerCase();
      if (!EMAIL_RE.test(clean) || clean.length > 120) throw new ApiError(400, 'Please enter a valid email address.');
      if ((company.communityEmails || []).some(c => c.email === clean)) throw new ApiError(409, 'We already have that email.');
    } else if (type === 'size') {
      clean = String(value || '').trim();
      if (!Company.SIZE_OPTIONS.includes(clean)) throw new ApiError(400, 'Please choose one of the listed sizes.');
    } else {
      throw new ApiError(400, 'type must be "email" or "size".');
    }

    const ipHash = hashIp((req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim());
    const dayAgo = new Date(Date.now() - 86400000);
    const recent = await CompanySubmission.countDocuments({ ipHash, createdAt: { $gte: dayAgo } });
    if (recent >= 15) throw new ApiError(429, 'Too many suggestions today. Please try again tomorrow.');
    const dup = await CompanySubmission.findOne({ companyKey: company.key, type, value: clean, status: 'pending' }).lean();
    if (!dup) {
      await CompanySubmission.create({ companyKey: company.key, companyName: company.name, type, value: clean, ipHash });
    }
    res.status(201).json({ error: false, message: 'Thanks! Your suggestion will appear once it has been reviewed.' });
  } catch (e) { next(e); }
}

module.exports = { list, detail, submit };
