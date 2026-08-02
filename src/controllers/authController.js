const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new ApiError(400, 'email and password are required.');
    }

    const adminEmail = process.env.ADMIN_EMAIL || '';
    const adminPassword = process.env.ADMIN_PASSWORD || '';
    const matches =
      email.toLowerCase().trim() === adminEmail.toLowerCase().trim() && password === adminPassword;

    if (!matches) {
      throw new ApiError(401, 'Invalid credentials.');
    }

    const token = jwt.sign({ sub: 'admin', email: adminEmail }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({ token });
  } catch (e) {
    next(e);
  }
}

module.exports = { login };
