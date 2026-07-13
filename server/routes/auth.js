const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');

router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/firebase/verify-phone', authController.verifyFirebaseOtp);
router.post('/register/finish', authController.registerFinish);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/password/reset', authController.passwordReset);
router.post('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
