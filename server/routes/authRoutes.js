import express from 'express';
import { register, login, refresh, forgotPassword, resetPassword, getMe, sendOtp, verifyOtp } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Passwordless OTP routes
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);

// Protected routes
router.get('/me', protect, getMe);

export default router;
