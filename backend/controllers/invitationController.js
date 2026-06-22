import crypto from 'crypto';
import Workspace from '../models/Workspace.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import WorkspaceInvitation from '../models/WorkspaceInvitation.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { logWorkspaceAction } from '../services/auditLogService.js';

// @desc    Invite a user by email
// @route   POST /api/workspaces/:id/invite
// @access  Private (Owner or Admin role required)
export const inviteUser = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 400, 'Please provide user email');
    }

    const emailNormalized = String(email).toLowerCase().trim();

    // Check if target user is already in workspace
    const alreadyMember = await WorkspaceMember.findOne({
      workspaceId,
      userId: { $in: await User.find({ email: emailNormalized }).distinct('_id') }
    });

    if (alreadyMember) {
      return errorResponse(res, 400, 'User is already a workspace member');
    }

    // Check if there is an active pending invitation
    const activeInvite = await WorkspaceInvitation.findOne({
      workspaceId,
      email: emailNormalized,
      status: 'pending',
      expiresAt: { $gt: Date.now() },
    });

    if (activeInvite) {
      return successResponse(res, 200, 'An active pending invitation already exists for this email', {
        token: activeInvite.token
      });
    }

    // Generate secure random invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await WorkspaceInvitation.create({
      workspaceId,
      email: emailNormalized,
      invitedBy: req.user.id,
      token,
      expiresAt,
    });

    // Write audit log
    await logWorkspaceAction(workspaceId, req.user.id, 'Member invited', { email: emailNormalized });

    console.log(`\n========================================\n[SECURITY LOG] Generated Workspace Invitation Token for ${emailNormalized}: ${token}\n========================================\n`);

    return successResponse(res, 201, 'Invitation created successfully', {
      invitationId: invitation._id,
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept workspace invitation
// @route   POST /api/workspaces/invitations/accept
// @access  Private (Requires login)
export const acceptInvitation = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return errorResponse(res, 400, 'Invitation token is required');
    }

    // Find invitation
    const invitation = await WorkspaceInvitation.findOne({
      token,
      status: 'pending',
      expiresAt: { $gt: Date.now() },
    });

    if (!invitation) {
      return errorResponse(res, 400, 'Invalid or expired invitation token');
    }

    // Verify email matches the logged-in user's email
    if (invitation.email !== req.user.email) {
      return errorResponse(res, 403, 'Permission denied. Email address mismatch.');
    }

    // Update invitation status
    invitation.status = 'accepted';
    await invitation.save();

    // Create membership record (default role: Member)
    await WorkspaceMember.create({
      workspaceId: invitation.workspaceId,
      userId: req.user.id,
      role: 'Member',
    });

    // Link workspace to user Model workspaces array for backwards compatibility
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { workspaces: invitation.workspaceId },
    });

    // Log action
    await logWorkspaceAction(invitation.workspaceId, req.user.id, 'Invitation accepted', { email: invitation.email });

    return successResponse(res, 200, 'Workspace invitation accepted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Reject workspace invitation
// @route   POST /api/workspaces/invitations/reject
// @access  Private (Requires login)
export const rejectInvitation = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return errorResponse(res, 400, 'Invitation token is required');
    }

    const invitation = await WorkspaceInvitation.findOne({
      token,
      status: 'pending',
      expiresAt: { $gt: Date.now() },
    });

    if (!invitation) {
      return errorResponse(res, 400, 'Invalid or expired invitation token');
    }

    if (invitation.email !== req.user.email) {
      return errorResponse(res, 403, 'Permission denied. Email address mismatch.');
    }

    // Update invitation status
    invitation.status = 'rejected';
    await invitation.save();

    // Log action
    await logWorkspaceAction(invitation.workspaceId, req.user.id, 'Invitation rejected', { email: invitation.email });

    return successResponse(res, 200, 'Workspace invitation rejected successfully');
  } catch (error) {
    next(error);
  }
};
