import MeetingNote from '../models/MeetingNote.js';
import Meeting from '../models/Meeting.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import Workspace from '../models/Workspace.js';

// Helper to check workspace membership
const isWorkspaceMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return false;
  if (workspace.owner.toString() === userId.toString()) return true;
  
  const membership = await WorkspaceMember.findOne({ workspaceId, userId });
  return !!membership;
};

// @desc    Create a meeting note
// @route   POST /api/meetings/:meetingId/notes
// @access  Private
export const createNote = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { content, type } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Check workspace membership
    const isMember = await isWorkspaceMember(meeting.workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    const note = await MeetingNote.create({
      meetingId,
      userId: req.user.id,
      content,
      type: type || 'personal',
    });

    const populatedNote = await MeetingNote.findById(note._id).populate('userId', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      data: populatedNote,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Get notes for a meeting
// @route   GET /api/meetings/:meetingId/notes
// @access  Private
export const listNotes = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Check workspace membership
    const isMember = await isWorkspaceMember(meeting.workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    // User can see all shared notes, and their own personal notes
    const notes = await MeetingNote.find({
      meetingId,
      $or: [
        { type: 'shared' },
        { type: 'personal', userId: req.user.id }
      ]
    }).populate('userId', 'name email avatar').sort('createdAt');

    res.status(200).json({
      success: true,
      message: 'Notes retrieved successfully',
      data: notes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Update a note
// @route   PUT /api/notes/:id
// @access  Private
export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const note = await MeetingNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
        error: { message: 'Note not found' }
      });
    }

    // Only note owner can update
    if (note.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the author can update this note',
        error: { message: 'Forbidden: Only the author can update this note' }
      });
    }

    note.content = content;
    await note.save();

    const populatedNote = await MeetingNote.findById(note._id).populate('userId', 'name email avatar');

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      data: populatedNote,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Delete a note
// @route   DELETE /api/notes/:id
// @access  Private
export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    const note = await MeetingNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
        error: { message: 'Note not found' }
      });
    }

    // Only note owner can delete
    if (note.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the author can delete this note',
        error: { message: 'Forbidden: Only the author can delete this note' }
      });
    }

    await note.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully',
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};
