import express from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  googleLogin,
  getGoogleConfig,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validations/auth.js';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.get('/me', protect, getMe);
router.post('/google', googleLogin);
router.get('/google/config', getGoogleConfig);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetotp', resetPassword);

export default router;
