const express = require('express');
const router = express.Router();
const mlController = require('../controller/mlController');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001';

/**
 * POST /ml/predict
 * Calls the Python Flask ML API to predict a donor's lambda score.
 * Body: { donor features object }
 */
router.post('/predict', async (req, res) => {
    try {
        const response = await fetch(`${ML_API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error calling ML API:', error.message);
        return res.status(503).json({
            error: 'ML service unavailable. Make sure ml_api.py is running on port 5001.'
        });
    }
});

/**
 * POST /ml/compute-lambda
 * Gathers donor features from DB, calls ML API, stores the result.
 * Body: { userId: string }
 */
router.post('/compute-lambda', mlController.computeLambdaScore);

/**
 * GET /ml/health
 * Check if the Python ML API is reachable.
 */
router.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${ML_API_URL}/`);
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(503).json({ status: 'ML API unreachable', error: error.message });
    }
});

module.exports = router;
