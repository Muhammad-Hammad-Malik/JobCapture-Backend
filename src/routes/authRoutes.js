const express = require('express');
const { login } = require('../controllers/authController');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Brake against password guessing (best-effort: counters are per warm serverless instance).
router.post('/login', rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Too many login attempts.' }), login);

module.exports = router;
