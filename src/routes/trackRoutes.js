const express = require('express');
const { rateLimit } = require('../middleware/rateLimit');
const { track } = require('../controllers/trackController');

const router = express.Router();

// sendBeacon posts text/plain (avoids a CORS preflight), so parse any content type here.
router.post(
  '/',
  express.json({ type: () => true, limit: '24kb' }),
  rateLimit({ windowMs: 60 * 1000, max: 90, message: 'Slow down.' }),
  track,
);

module.exports = router;
