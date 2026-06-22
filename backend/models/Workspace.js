import mongoose from 'mongoose';

const WorkspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a workspace name'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  avatar: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const Workspace = mongoose.model('Workspace', WorkspaceSchema);
export default Workspace;
