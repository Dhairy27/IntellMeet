import mongoose from 'mongoose';

const MeetingRecordingSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    index: true,
  },
  recordingUrl: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number, // in bytes
    default: 0,
  },
  duration: {
    type: Number, // in seconds
    default: 0,
  },
}, {
  timestamps: true,
});

const MeetingRecording = mongoose.model('MeetingRecording', MeetingRecordingSchema);
export default MeetingRecording;
