import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
  },
  task: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'review', 'done'],
    default: 'todo',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dueDate: {
    type: Date,
  },
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    default: null,
    index: true,
  },
}, {
  timestamps: true,
});

// Sync assignedTo with assignee, and title/task fields
TaskSchema.pre('save', function (next) {
  this.assignedTo = this.assignee;
  if (this.task && !this.title) {
    this.title = this.task;
  } else if (this.title && !this.task) {
    this.task = this.title;
  }
  if (!this.title && !this.task) {
    this.title = 'Untitled Task';
    this.task = 'Untitled Task';
  }
  next();
});

const Task = mongoose.model('Task', TaskSchema);
export default Task;
