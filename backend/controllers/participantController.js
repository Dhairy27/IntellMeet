import MeetingParticipant from '../models/MeetingParticipant.js';
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

// @desc    Get participants for a meeting
// @route   GET /api/meetings/:id/participants
// @access  Private
export const getParticipants = async (req, res) => {
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

    // Check workspace membership
    const isMember = await isWorkspaceMember(meeting.workspaceId, req.user.id);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a member of this workspace',
        error: { message: 'Forbidden: You are not a member of this workspace' }
      });
    }

    const participants = await MeetingParticipant.find({ meetingId: id })
      .populate('userId', 'name email avatar')
      .sort('joinedAt');

    res.status(200).json({
      success: true,
      message: 'Participants list retrieved successfully',
      data: participants,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Remove a participant from meeting (kick)
// @route   DELETE /api/meetings/:id/participants/:userId
// @access  Private
export const removeParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Identify requesting user's role in the meeting
    const requesterParticipant = await MeetingParticipant.findOne({ meetingId: id, userId: req.user.id });
    if (!requesterParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a participant in this meeting',
        error: { message: 'Forbidden: You are not a participant in this meeting' }
      });
    }

    // Check privileges
    const isHost = meeting.hostId.toString() === req.user.id.toString() || requesterParticipant.role === 'HOST';
    const isCoHost = requesterParticipant.role === 'CO_HOST';

    if (!isHost && !isCoHost) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Host or Co-Host can remove participants',
        error: { message: 'Forbidden: Only Host or Co-Host can remove participants' }
      });
    }

    // Get the target participant's record
    const targetParticipant = await MeetingParticipant.findOne({ meetingId: id, userId });
    if (!targetParticipant) {
      return res.status(404).json({
        success: false,
        message: 'Target participant not found in this meeting',
        error: { message: 'Target participant not found in this meeting' }
      });
    }

    // Prevent removing HOST
    if (targetParticipant.role === 'HOST' || meeting.hostId.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Bad Request: Host cannot be removed from the meeting',
        error: { message: 'Bad Request: Host cannot be removed from the meeting' }
      });
    }

    // Co-host cannot remove co-hosts
    if (isCoHost && targetParticipant.role === 'CO_HOST') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Co-Hosts cannot remove other Co-Hosts',
        error: { message: 'Forbidden: Co-Hosts cannot remove other Co-Hosts' }
      });
    }

    // Update left time and calculate duration
    if (!targetParticipant.leftAt) {
      targetParticipant.leftAt = new Date();
      const durationSeconds = Math.round((targetParticipant.leftAt.getTime() - targetParticipant.joinedAt.getTime()) / 1000);
      targetParticipant.attendanceDuration = Math.max(0, durationSeconds);
      await targetParticipant.save();
    }

    res.status(200).json({
      success: true,
      message: 'Participant removed successfully',
      data: targetParticipant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};

// @desc    Change participant role (promote/demote)
// @route   PUT /api/meetings/:id/participants/:userId/role
// @access  Private
export const changeParticipantRole = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: { message: 'Meeting not found' }
      });
    }

    // Only host can change roles
    const isHost = meeting.hostId.toString() === req.user.id.toString();
    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the Host can modify participant roles',
        error: { message: 'Forbidden: Only the Host can modify participant roles' }
      });
    }

    // Get the target participant's record
    const targetParticipant = await MeetingParticipant.findOne({ meetingId: id, userId });
    if (!targetParticipant) {
      return res.status(404).json({
        success: false,
        message: 'Target participant not found in this meeting',
        error: { message: 'Target participant not found in this meeting' }
      });
    }

    // Host role cannot be demoted or set on others directly via this endpoint
    if (targetParticipant.role === 'HOST' || role === 'HOST') {
      return res.status(400).json({
        success: false,
        message: 'Bad Request: Host role changes are not allowed',
        error: { message: 'Bad Request: Host role changes are not allowed' }
      });
    }

    targetParticipant.role = role;
    await targetParticipant.save();

    res.status(200).json({
      success: true,
      message: `Role updated to ${role} successfully`,
      data: targetParticipant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: { message: error.message }
    });
  }
};
