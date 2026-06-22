import mongoose from 'mongoose';

const MeetingSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Please add a meeting title'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  meetingCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  roomId: {
    type: String,
    unique: true,
    sparse: true,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  scheduledStartTime: {
    type: Date,
  },
  scheduledEndTime: {
    type: Date,
  },
  actualStartTime: {
    type: Date,
  },
  actualEndTime: {
    type: Date,
  },
  
  // Backward compatibility fields for active WebRTC transcript and summaries
  chatMessages: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      senderName: String,
      text: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  transcript: [
    {
      speaker: String,
      text: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  aiSummary: {
    type: String,
    default: '',
  },
  aiActionItems: [
    {
      task: {
        type: String,
        required: true,
      },
      suggestedAssignee: {
        type: String,
        default: '',
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
      },
      status: {
        type: String,
        enum: ['pending', 'converted'],
        default: 'pending',
      },
    },
  ],
  recordingUrl: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Compound/Specific Indexes
MeetingSchema.index({ workspaceId: 1, createdAt: -1 });

// Transform hook to maintain 100% frontend compatibility with old model properties
MeetingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.host = ret.hostId;
    ret.workspace = ret.workspaceId;
    ret.roomId = ret.roomId || ret.meetingCode;
    // Map backend active/completed statuses to frontend live/ended expectation
    if (ret.status === 'active') ret.status = 'live';
    if (ret.status === 'completed') ret.status = 'ended';
    return ret;
  }
});

MeetingSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.host = ret.hostId;
    ret.workspace = ret.workspaceId;
    ret.roomId = ret.roomId || ret.meetingCode;
    if (ret.status === 'active') ret.status = 'live';
    if (ret.status === 'completed') ret.status = 'ended';
    return ret;
  }
});

const Meeting = mongoose.model('Meeting', MeetingSchema);
export default Meeting;
