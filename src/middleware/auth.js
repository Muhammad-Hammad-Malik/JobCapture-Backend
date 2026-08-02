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

module.exports = { requireAuth };
