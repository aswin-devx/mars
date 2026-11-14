const express = require('express');
const router = express.Router();
const donorController = require('../controller/donorController');
const mlController = require('../controller/mlController');
const validator = require('../middleware/validator');

// MARS Pulse: Get stored lambda score breakdown
router.get('/lambda-score', mlController.getLambdaScore);

// MARS Pulse: View pending request alerts
router.get('/alerts', donorController.getPendingAlerts);
router.get('/booked', donorController.getBookedAppointments);

// MARS Pulse: Accept or decline a request
router.post(
    '/respond', 
    validator.validateBody(validator.donorResponseSchema),
    donorController.respondToRequest
);

// MARS Pulse: Submit a reason for a no-show (to mitigate flagging)
router.post(
    '/submit-failure-reason', 
    validator.validateBody(validator.updateDonationStatusSchema), // Reusing this schema for simplicity
    donorController.submitFailureReason
);

// MARS Pulse: Mock confirmation of successful donation (usually done by hospital)
router.post(
    '/confirm-donation', 
    donorController.confirmDonation
);

module.exports = router;