const express = require('express');
const { allowSubmitterOrAdmin } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { ingest } = require('../controllers/ingestController');
const publicJobsController = require('../controllers/publicJobsController');

const router = express.Router();

// Admins are not throttled; the no-login submitter is (each submission costs an LLM call).
const submissionLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, skip: req => !req.submitter, message: 'Too many submissions.' });

router.get('/', publicJobsController.list);
router.get('/facets', publicJobsController.facets);
router.post('/ingest', allowSubmitterOrAdmin, submissionLimiter, ingest);

module.exports = router;
