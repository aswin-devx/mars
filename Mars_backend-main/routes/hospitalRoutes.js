const express = require('express');
const router = express.Router();
const hospitalController = require('../controller/hospitalController');
const validator = require('../middleware/validator');

// All hospital routes require authentication and hospital_admin role
// MARS Link: Create a new blood request
router.post(
    '/request', 
    validator.validateBody(validator.bloodRequestSchema),
    hospitalController.createBloodRequest
);

// MARS Link: Flag a donor for no-show/non-compliance
router.post(
    '/flag-donor', 
    validator.validateBody(validator.flagDonorSchema),
    hospitalController.flagDonor
);

// MARS Link: View dashboard (requests and inventory)
router.get('/dashboard', hospitalController.getHospitalDashboard);

// MARS Link: Get all donors with lambda scores (Donor Management page)
router.get('/donors', hospitalController.getAllDonors);


module.exports = router;