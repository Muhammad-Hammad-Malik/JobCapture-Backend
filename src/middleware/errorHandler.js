const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: true, message: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    const body = { error: true, message: err.message };
    if (err.extra) Object.assign(body, err.extra);
    return res.status(err.status).json(body);
  }
  console.error(err);
  res.status(500).json({ error: true, message: 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
