import express from 'express';
import { updateNote, deleteNote } from '../controllers/noteController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateNoteSchema } from '../validations/meeting.js';

const router = express.Router();

router.put('/:id', protect, validate(updateNoteSchema), updateNote);
router.delete('/:id', protect, deleteNote);

export default router;
