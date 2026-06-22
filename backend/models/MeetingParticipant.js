import mongoose from 'mongoose';

const MeetingParticipantSchema = new mongoose.Schema({
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
  role: {
    type: String,
    enum: ['HOST', 'CO_HOST', 'PARTICIPANT'],
    default: 'PARTICIPANT',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  leftAt: {
    type: Date,
  },
  attendanceDuration: {
    type: Number, // in seconds
    default: 0,
  },
}, {
  timestamps: true,
});

// Ensure a user has unique participant logs per join session
MeetingParticipantSchema.index({ meetingId: 1, userId: 1 });

const MeetingParticipant = mongoose.model('MeetingParticipant', MeetingParticipantSchema);
export default MeetingParticipant;
