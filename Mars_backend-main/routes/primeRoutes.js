const express = require('express');
const router = express.Router();
const { primeAuth, requirePrimeRoles } = require('../middleware/primeAuth');
const prime = require('../controller/primeGovernanceController');
const mlController = require('../controller/mlController');

router.use(primeAuth);
router.get('/scopes', prime.scopes);
router.get('/hospitals', prime.hospitals);
router.get('/requests', prime.requests);
router.get('/all-requests', prime.requests);
router.get('/analytics/donors', prime.donorAnalytics);
router.get('/analytics/inventory', prime.inventoryAnalytics);
router.get('/analytics/donations/daily', prime.dailyDonations);
router.get('/geography/distribution', prime.geography);
router.get('/alerts', prime.alerts);
router.get('/audit-log', prime.auditLog);
router.put('/hospitals/:id/status', prime.updateHospitalStatus);
router.get('/gdra', prime.gdraStatus);
router.post('/gdra/activate', prime.changeGdra);
router.post('/gdra/deactivate', prime.changeGdra);
router.get('/authorities', requirePrimeRoles('super_admin'), prime.authorities);
router.post('/authorities', requirePrimeRoles('super_admin'), prime.createAuthority);
router.put('/authorities/:id/status', requirePrimeRoles('super_admin'), prime.updateAuthorityStatus);
router.get('/lambda-analytics', mlController.getLambdaAnalytics);
router.get('/flagged-donors', async (req, res) => {
    try {
        const { scope } = await require('../controller/primeGovernanceController').scopedContext(req);
        const donors = await req.primeDb.collection('donors').find({ status: { $in: ['flagged', 'suspended'] }, ...(scope.state ? { state: scope.state } : {}), ...(scope.district ? { district: scope.district } : {}) }).toArray();
        return res.json({ count: donors.length, flaggedCount: donors.filter((d) => d.status === 'flagged').length, suspendedCount: donors.filter((d) => d.status === 'suspended').length });
    } catch (error) { return res.status(error.status || 500).json({ message: error.message }); }
});

module.exports = router;
