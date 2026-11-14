const express = require('express');
const router = express.Router();
const validator = require('../middleware/validator');
const authController = require('../controller/authController');
const primeAuthController = require('../controller/primeAuthController');
const { primeAuth } = require('../middleware/primeAuth');

router.post('/signup', validator.validateBody(validator.registerSchema), authController.signUp);
router.get('/login', validator.validateQuery(validator.loginSchema), authController.login);
router.post('/prime/login', primeAuthController.login);
router.post('/prime/bootstrap', primeAuthController.bootstrap);
router.get('/prime/session', primeAuth, primeAuthController.session);
router.post('/prime/logout', primeAuth, primeAuthController.logout);
module.exports = router;
