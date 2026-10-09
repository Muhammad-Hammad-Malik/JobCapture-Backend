const express = require('express');
const { requireAuth } = require('../middleware/auth');
const adminJobsController = require('../controllers/adminJobsController');
const emailsController = require('../controllers/emailsController');
const analyticsController = require('../controllers/analyticsController');
const adminCompanies = require('../controllers/adminCompaniesController');

const router = express.Router();
router.use(requireAuth);

router.get('/jobs', adminJobsController.list);
router.delete('/jobs/bulk', adminJobsController.bulkClear); // must precede /jobs/:id
router.get('/jobs/:id', adminJobsController.getOne);
router.put('/jobs/:id', adminJobsController.update);
router.patch('/jobs/:id/status', adminJobsController.updateStatus);
router.delete('/jobs/:id', adminJobsController.remove);

router.get('/emails', emailsController.list);
router.get('/analytics', analyticsController.dashboard);
router.get('/company-submissions', adminCompanies.listSubmissions);
router.patch('/company-submissions/:id', adminCompanies.decide);
router.post('/companies/merge', adminCompanies.merge);

module.exports = router;
