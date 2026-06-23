import Meeting from '../models/Meeting.js';
import MeetingParticipant from '../models/MeetingParticipant.js';
import MeetingRecording from '../models/MeetingRecording.js';
import MeetingNote from '../models/MeetingNote.js';
import Workspace from '../models/Workspace.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { generateMeetingIntelligence } from '../services/ai.service.js';

// Helper to check workspace membership
const isWorkspaceMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return false;
  if (workspace.owner.toString() === userId.toString()) return true;
  
  const membership = await WorkspaceMember.findOne({ workspaceId, userId });
  return !!membership;
};

// Helper to generate a unique 6-character alphanumeric uppercase code
const generateUniqueMeetingCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let isUnique = false;
  let code = '';
  while (!isUnique) {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const existing = await Meeting.findOne({ meetingCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

// @desc    Create a meeting
// @route   POST /api/meetings
// @access  Private
export const createMeeting = async (req, res) => {
  try {
    const { title, description, workspaceId, status, scheduledStartTime, scheduledEndTime } = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required',
        error: { message: 'Workspace ID is required' }
      });
    }

    // Validate workspace existence and member access
    const isMember = await isWorkspaceMember(workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    const meetingCode = await generateUniqueMeetingCode();

    const meeting = await Meeting.create({
      workspaceId,
      title,
      description: description || '',
      meetingCode,
      roomId: meetingCode, // maintain WebRTC compatibility
      hostId: req.user.id,
      status: status || 'scheduled',
      scheduledStartTime: scheduledStartTime || null,
      scheduledEndTime: scheduledEndTime || null,
    });

    // Create participant entry for host
    await MeetingParticipant.create({
      meetingId: meeting._id,
      userId: req.user.id,
      role: 'HOST',
      joinedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Get meetings in a workspace
// @route   GET /api/meetings
// @access  Private
export const getMeetings = async (req, res) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID query parameter is required',
        error: { message: 'Workspace ID query parameter is required' }
      });
    }

    // Check workspace membership
    const isMember = await isWorkspaceMember(workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    const meetings = await Meeting.find({ workspaceId })
      .populate('hostId', 'name email avatar')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      message: 'Meetings retrieved successfully',
      data: meetings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Get details of a single meeting by ID or Code
// @route   GET /api/meetings/:id
// @access  Private
export const getMeetingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Search by ID, meetingCode, or roomId
    let meeting = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(id);
    }
    if (!meeting) {
      meeting = await Meeting.findOne({
        $or: [{ meetingCode: id.toUpperCase() }, { roomId: id }]
      });
    }

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

    // Populate fields
    const populated = await Meeting.findById(meeting._id)
      .populate('hostId', 'name email avatar')
      .populate('workspaceId', 'name');

    res.status(200).json({
      success: true,
      message: 'Meeting details retrieved successfully',
      data: populated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Update a meeting
// @route   PUT /api/meetings/:id
// @access  Private
export const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Host validation
    if (meeting.hostId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the host can modify this meeting',
        error: { message: 'Forbidden: Only the host can modify this meeting' }
      });
    }

    // Perform updates
    Object.keys(updates).forEach((key) => {
      meeting[key] = updates[key];
    });

    await meeting.save();

    res.status(200).json({
      success: true,
      message: 'Meeting updated successfully',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Delete a meeting (with cascade cleanups)
// @route   DELETE /api/meetings/:id
// @access  Private
export const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Host validation
    if (meeting.hostId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the host can delete this meeting',
        error: { message: 'Forbidden: Only the host can delete this meeting' }
      });
    }

    // Cascade Cleanup
    await MeetingParticipant.deleteMany({ meetingId: meeting._id });
    await MeetingRecording.deleteMany({ meetingId: meeting._id });
    await MeetingNote.deleteMany({ meetingId: meeting._id });

    await meeting.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Meeting and associated notes/logs deleted successfully',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Join a meeting
// @route   POST /api/meetings/:id/join
// @access  Private
export const joinMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    // Search by ID, meetingCode, or roomId
    let meeting = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(id);
    }
    if (!meeting) {
      meeting = await Meeting.findOne({
        $or: [{ meetingCode: id.toUpperCase() }, { roomId: id }]
      });
    }

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
      // Automatically add user to workspace when they join a meeting via code
      await WorkspaceMember.create({
        workspaceId: meeting.workspaceId,
        userId: req.user.id,
        role: 'MEMBER'
      });
      // Link workspace to user
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { workspaces: meeting.workspaceId }
      });
    }

    // Transition status to active if scheduled/cancelled
    if (meeting.status === 'scheduled' || meeting.status === 'cancelled') {
      meeting.status = 'active';
      meeting.actualStartTime = new Date();
      await meeting.save();
    }

    // Determine role: if they are the creator, they are HOST. Otherwise PARTICIPANT
    const role = meeting.hostId.toString() === req.user.id.toString() ? 'HOST' : 'PARTICIPANT';

    // Look for an existing active participant session (leftAt is null)
    let participantLog = await MeetingParticipant.findOne({
      meetingId: meeting._id,
      userId: req.user.id,
      leftAt: null
    });

    if (!participantLog) {
      participantLog = await MeetingParticipant.create({
        meetingId: meeting._id,
        userId: req.user.id,
        role,
        joinedAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: 'Joined meeting successfully',
      data: {
        meeting,
        participant: participantLog
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Leave a meeting
// @route   POST /api/meetings/:id/leave
// @access  Private
export const leaveMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    let meeting = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(id);
    }
    if (!meeting) {
      meeting = await Meeting.findOne({
        $or: [{ meetingCode: id.toUpperCase() }, { roomId: id }]
      });
    }

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Look for active participant session
    const participantLog = await MeetingParticipant.findOne({
      meetingId: meeting._id,
      userId: req.user.id,
      leftAt: null
    });

    if (!participantLog) {
      return res.status(400).json({
        success: false,
        message: 'You have not joined this meeting or have already left',
        error: { message: 'You have not joined this meeting or have already left' }
      });
    }

    participantLog.leftAt = new Date();
    const durationSeconds = Math.round((participantLog.leftAt.getTime() - participantLog.joinedAt.getTime()) / 1000);
    participantLog.attendanceDuration = Math.max(0, durationSeconds);
    await participantLog.save();

    res.status(200).json({
      success: true,
      message: 'Left meeting successfully',
      data: participantLog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Join a meeting by code
// @route   POST /api/meetings/join-by-code
// @access  Private
export const joinByCode = async (req, res) => {
  try {
    const { meetingCode } = req.body;

    if (!meetingCode) {
      return res.status(400).json({
        success: false,
        message: 'Meeting code is required',
        error: { message: 'Meeting code is required' }
      });
    }

    const cleanCode = meetingCode.toUpperCase().trim();
    const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;
    if (!ROOM_CODE_REGEX.test(cleanCode)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-character meeting code.',
        error: { message: 'Please enter a valid 6-character meeting code.' }
      });
    }

    // Resolve meetingCode (case-insensitive) or roomId
    const meeting = await Meeting.findOne({
      $or: [
        { meetingCode: cleanCode },
        { roomId: cleanCode }
      ]
    });

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
      // Automatically add user to workspace when they join a meeting via code
      await WorkspaceMember.create({
        workspaceId: meeting.workspaceId,
        userId: req.user.id,
        role: 'MEMBER'
      });
      // Link workspace to user
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { workspaces: meeting.workspaceId }
      });
    }

    // Transition status to active if scheduled/cancelled
    if (meeting.status === 'scheduled' || meeting.status === 'cancelled') {
      meeting.status = 'active';
      meeting.actualStartTime = new Date();
      await meeting.save();
    }

    const role = meeting.hostId.toString() === req.user.id.toString() ? 'HOST' : 'PARTICIPANT';

    let participantLog = await MeetingParticipant.findOne({
      meetingId: meeting._id,
      userId: req.user.id,
      leftAt: null
    });

    if (!participantLog) {
      participantLog = await MeetingParticipant.create({
        meetingId: meeting._id,
        userId: req.user.id,
        role,
        joinedAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: 'Joined meeting successfully',
      data: {
        meeting,
        participant: participantLog
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Get meeting history for a workspace
// @route   GET /api/meetings/history
// @access  Private
export const getHistory = async (req, res) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required to fetch history',
        error: { message: 'Workspace ID is required to fetch history' }
      });
    }

    // Check workspace membership
    const isMember = await isWorkspaceMember(workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    // Fetch meetings in workspace that are completed/ended or active/scheduled
    // But sort them with most recent first
    const meetings = await Meeting.find({ workspaceId })
      .populate('hostId', 'name email avatar')
      .sort('-createdAt');

    // For each meeting, query the participants list to show on history page
    const historyData = await Promise.all(meetings.map(async (m) => {
      const parts = await MeetingParticipant.find({ meetingId: m._id })
        .populate('userId', 'name email avatar');

      // Calculate total duration or actual duration
      let duration = 0;
      if (m.actualStartTime && m.actualEndTime) {
        duration = Math.round((m.actualEndTime.getTime() - m.actualStartTime.getTime()) / 1000);
      } else if (m.actualStartTime) {
        duration = Math.round((new Date().getTime() - m.actualStartTime.getTime()) / 1000);
      }

      return {
        _id: m._id,
        title: m.title,
        description: m.description,
        meetingCode: m.meetingCode,
        roomId: m.roomId,
        host: m.hostId,
        status: m.status,
        date: m.actualStartTime || m.scheduledStartTime || m.createdAt,
        duration,
        participantsCount: parts.length,
        participants: parts,
      };
    }));

    res.status(200).json({
      success: true,
      message: 'Meeting history retrieved successfully',
      data: historyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Start / Start Call transition
// @route   PUT /api/meetings/:id/start
// @access  Private
export const startMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    let meeting = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(id);
    }
    if (!meeting) {
      meeting = await Meeting.findOne({
        $or: [{ meetingCode: id.toUpperCase() }, { roomId: id }]
      });
    }

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Verify requesting user is the host
    if (meeting.hostId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the host can start this meeting',
        error: { message: 'Forbidden: Only the host can start this meeting' }
      });
    }

    meeting.status = 'active';
    meeting.actualStartTime = new Date();
    await meeting.save();

    res.status(200).json({
      success: true,
      message: 'Meeting started successfully',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    End meeting & generate AI summary/action items
// @route   PUT /api/meetings/:id/end
// @access  Private
export const endMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    let meeting = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(id);
    }
    if (!meeting) {
      meeting = await Meeting.findOne({
        $or: [{ meetingCode: id.toUpperCase() }, { roomId: id }]
      });
    }

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Verify requesting user is the host
    if (meeting.hostId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the host can end this meeting',
        error: { message: 'Forbidden: Only the host can end this meeting' }
      });
    }

    meeting.status = 'completed';
    meeting.actualEndTime = new Date();

    // Mark any active participant sessions as left
    const activeParticipants = await MeetingParticipant.find({
      meetingId: meeting._id,
      leftAt: null
    });

    const now = new Date();
    await Promise.all(activeParticipants.map(async (part) => {
      part.leftAt = now;
      part.attendanceDuration = Math.max(0, Math.round((now.getTime() - part.joinedAt.getTime()) / 1000));
      await part.save();
    }));

    // Trigger AI summarization and action items extraction
    console.log(`[AI Trigger] Meeting ${meeting.title} ended. Extracting summary...`);
    const aiResults = await generateMeetingIntelligence(meeting);
    
    meeting.aiSummary = aiResults.summary;
    meeting.aiActionItems = aiResults.actionItems;
    
    // No mock recordings are created by default anymore. Real recordings must be uploaded.
    meeting.recordingUrl = '';

    await meeting.save();

    // Notify other active participants in the socket room
    const io = req.app.get('io');
    if (io) {
      io.to(meeting.roomId).emit('meeting-ended', { meetingId: meeting._id });
    }

    res.status(200).json({
      success: true,
      message: 'Meeting ended successfully',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Convert an AI action item into a workspace task
// @route   POST /api/meetings/:meetingId/convert-action
// @access  Private
export const convertActionToTask = async (req, res) => {
  try {
    const { actionItemId, workspaceId } = req.body;

    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    const actionItem = meeting.aiActionItems.id(actionItemId);
    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: 'Action item not found',
        error: { message: 'Action item not found' }
      });
    }

    if (actionItem.status === 'converted') {
      return res.status(400).json({
        success: false,
        message: 'Action item already converted to task',
        error: { message: 'Action item already converted to task' }
      });
    }

    // Find workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
        error: { message: 'Workspace not found' }
      });
    }

    // Look for matching user to assign
    let assigneeId = null;
    if (actionItem.suggestedAssignee) {
      // Find workspace member whose name matches suggestedAssignee
      const memberRecords = await WorkspaceMember.find({ workspaceId });
      const memberUserIds = memberRecords.map(m => m.userId);
      const membersList = await User.find({ _id: { $in: memberUserIds } });
      const matchedUser = membersList.find(u => 
        u.name.toLowerCase().includes(actionItem.suggestedAssignee.toLowerCase()) || 
        actionItem.suggestedAssignee.toLowerCase().includes(u.name.toLowerCase())
      );
      if (matchedUser) {
        assigneeId = matchedUser._id;
      }
    }

    // Create task
    const task = await Task.create({
      title: actionItem.task,
      description: `Converted automatically from action item in meeting: "${meeting.title}"`,
      priority: actionItem.priority,
      workspace: workspace._id,
      creator: req.user.id,
      assignee: assigneeId,
      meetingId: meeting._id,
      status: 'todo',
    });

    // Mark action item as converted
    actionItem.status = 'converted';
    await meeting.save();

    res.status(201).json({
      success: true,
      message: 'Action item converted to task successfully',
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Get recordings for a meeting
// @route   GET /api/meetings/:meetingId/recordings
// @access  Private
export const getMeetingRecordings = async (req, res) => {
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

    const isMember = await isWorkspaceMember(meeting.workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    const recordings = await MeetingRecording.find({ meetingId });

    res.status(200).json({
      success: true,
      message: 'Recordings retrieved successfully',
      data: recordings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Add a recording to a meeting
// @route   POST /api/meetings/:meetingId/recordings
// @access  Private
export const createMeetingRecording = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { recordingUrl, fileSize, duration } = req.body;

    if (!recordingUrl) {
      return res.status(400).json({
        success: false,
        message: 'Recording URL is required',
        error: { message: 'Recording URL is required' }
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    const isMember = await isWorkspaceMember(meeting.workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    const recording = await MeetingRecording.create({
      meetingId: meeting._id,
      recordingUrl,
      fileSize: fileSize || 0,
      duration: duration || 0,
    });

    meeting.recordingUrl = recordingUrl;
    await meeting.save();

    res.status(201).json({
      success: true,
      message: 'Recording added successfully',
      data: recording
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};
