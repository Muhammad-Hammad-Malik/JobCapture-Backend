const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { ingest } = require('../controllers/ingestController');
const publicJobsController = require('../controllers/publicJobsController');

const router = express.Router();

router.get('/', publicJobsController.list);
router.post('/ingest', requireAuth, ingest);

module.exports = router;
