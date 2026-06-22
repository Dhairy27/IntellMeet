import express from 'express';
import { getAIResult, analyzeMeetingFromBody, testOpenAIConnection } from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/analyze', protect, analyzeMeetingFromBody);
router.get('/results/:meetingId', protect, getAIResult);
router.get('/test', protect, testOpenAIConnection);

export default router;
