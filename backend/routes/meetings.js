import express from 'express';
import {
  createMeeting,
  getMeetings,
  getMeetingDetails,
  updateMeeting,
  deleteMeeting,
  joinMeeting,
  leaveMeeting,
  joinByCode,
  getHistory,
  startMeeting,
  endMeeting,
  convertActionToTask,
  getMeetingRecordings,
  createMeetingRecording
} from '../controllers/meetingController.js';
import {
  getAIResult,
  reAnalyzeMeeting
} from '../controllers/ai.controller.js';
import {
  getParticipants,
  removeParticipant,
  changeParticipantRole
} from '../controllers/participantController.js';
import {
  createNote,
  listNotes
} from '../controllers/noteController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createMeetingSchema,
  updateMeetingSchema,
  createNoteSchema,
  updateRoleSchema
} from '../validations/meeting.js';

const router = express.Router();

// Static routes first to avoid route parameter collision
router.get('/history', protect, getHistory);
router.post('/join-by-code', protect, joinByCode);

// Standard meeting CRUD routes
router.post('/', protect, validate(createMeetingSchema), createMeeting);
router.get('/', protect, getMeetings);
router.get('/:id', protect, getMeetingDetails);
router.put('/:id', protect, validate(updateMeetingSchema), updateMeeting);
router.delete('/:id', protect, deleteMeeting);

// Start/End, Join/Leave
router.put('/:id/start', protect, startMeeting);
router.put('/:id/end', protect, endMeeting);
router.post('/:id/join', protect, joinMeeting);
router.post('/:id/leave', protect, leaveMeeting);

// Action items conversion
router.post('/:meetingId/convert-action', protect, convertActionToTask);

// AI Assistant intelligence results
router.get('/:meetingId/ai-result', protect, getAIResult);
router.post('/:meetingId/ai-analyze', protect, reAnalyzeMeeting);

// Participant management
router.get('/:id/participants', protect, getParticipants);
router.delete('/:id/participants/:userId', protect, removeParticipant);
router.put('/:id/participants/:userId/role', protect, validate(updateRoleSchema), changeParticipantRole);

// Note taking within meetings
router.post('/:meetingId/notes', protect, validate(createNoteSchema), createNote);
router.get('/:meetingId/notes', protect, listNotes);

// Meeting recordings endpoints
router.get('/:meetingId/recordings', protect, getMeetingRecordings);
router.post('/:meetingId/recordings', protect, createMeetingRecording);

export default router;
