import express from 'express';
import { getProfile, updateProfile, changePassword, uploadAvatar } from '../controllers/profileController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All profile routes require authentication
router.use(protect);

// GET  /api/profile          → get logged-in user profile
router.get('/', getProfile);

// PUT  /api/profile          → update name, bio, phone, avatar
router.put('/', updateProfile);

// PUT  /api/profile/password → change password (verify old first)
router.put('/password', changePassword);

// PUT  /api/profile/avatar   → upload avatar image to Cloudinary
// upload.single('avatar') tells multer to expect one file with field name "avatar"
router.put('/avatar', upload.single('avatar'), uploadAvatar);

export default router;
