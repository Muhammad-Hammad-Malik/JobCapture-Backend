const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header.'));
  }

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
}

// Constant-time string comparison (hash first so lengths always match).
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Submit-only access: the mobile app's "submitter" identity sends a shared key in X-Submit-Key and
// needs no login. It is accepted ONLY on routes that use this middleware (job submission) — it
// grants no access to the admin API. An admin JWT is accepted too.
function allowSubmitterOrAdmin(req, res, next) {
  const provided = req.headers['x-submit-key'];
  const expected = process.env.SUBMIT_API_KEY;
  if (provided && expected && safeEqual(provided, expected)) {
    req.submitter = true;
    return next();
  }
  return requireAuth(req, res, next);
}

module.exports = { requireAuth, allowSubmitterOrAdmin };
