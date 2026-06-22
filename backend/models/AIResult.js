import mongoose from 'mongoose';

const AIResultSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    unique: true,
    index: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
  },
  transcript: {
    type: String,
    default: '',
  },
  summary: {
    type: String,
    required: true,
  },
  actionItems: [
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
  decisions: {
    type: [String],
    default: [],
  },
  keyTopics: {
    type: [String],
    default: [],
  },
  risks: {
    type: [String],
    default: [],
  },
  followUps: {
    type: [String],
    default: [],
  },
  sentiment: {
    type: String,
    default: 'Neutral',
  },
}, {
  timestamps: true,
});

const AIResult = mongoose.model('AIResult', AIResultSchema);
export default AIResult;
