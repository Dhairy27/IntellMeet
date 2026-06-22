import mongoose from 'mongoose';

const WorkspaceInvitationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
    trim: true,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
}, {
  timestamps: true,
});

// Ensure a single pending invite per email per workspace
WorkspaceInvitationSchema.index({ workspaceId: 1, email: 1 });

const WorkspaceInvitation = mongoose.model('WorkspaceInvitation', WorkspaceInvitationSchema);
export default WorkspaceInvitation;
