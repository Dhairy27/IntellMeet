import express from 'express';
import { getDashboardStats, getDashboardAnalytics } from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', protect, getDashboardStats);
router.get('/analytics', protect, getDashboardAnalytics);

export default router;
