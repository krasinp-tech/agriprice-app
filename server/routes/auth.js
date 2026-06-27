const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');

router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/firebase/verify-phone', authController.verifyFirebaseOtp);
router.post('/register/finish', authController.registerFinish);
router.post('/login', authController.login);

module.exports = router;
