import mongoose from 'mongoose';

const MeetingNoteSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
  },
  type: {
    type: String,
    enum: ['personal', 'shared'],
    default: 'personal',
  },
}, {
  timestamps: true,
});

const MeetingNote = mongoose.model('MeetingNote', MeetingNoteSchema);
export default MeetingNote;
