const express = require('express');
const { rateLimit } = require('../middleware/rateLimit');
const { list, detail, submit } = require('../controllers/companiesController');

const router = express.Router();

router.get('/', list);
router.get('/:key', detail);
router.post('/:key/submissions', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many suggestions.' }), submit);

module.exports = router;
