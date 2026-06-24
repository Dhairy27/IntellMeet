import crypto from 'crypto';
import nodemailer from 'nodemailer';
import Workspace from '../models/Workspace.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import WorkspaceInvitation from '../models/WorkspaceInvitation.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { logWorkspaceAction } from '../services/auditLogService.js';
import { createDefaultWorkspaceForUser } from './authController.js';

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

    // Set up SMTP email transporter
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT || 587;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailHost && emailUser && emailPass) {
      try {
        const transportConfig = emailHost.includes('gmail')
          ? {
              service: 'gmail',
              auth: {
                user: emailUser,
                pass: emailPass,
              },
            }
          : {
              host: emailHost,
              port: parseInt(emailPort),
              secure: parseInt(emailPort) === 465,
              auth: {
                user: emailUser,
                pass: emailPass,
              },
            };

        const transporter = nodemailer.createTransport(transportConfig);

        const workspace = await Workspace.findById(workspaceId);
        const inviter = await User.findById(req.user.id);
        const workspaceName = workspace ? workspace.name : 'IntellMeet Workspace';
        const inviterName = inviter ? inviter.name : 'A team member';

        const frontendUrl = req.headers.origin || 'http://localhost:3000';
        const acceptUrl = `${frontendUrl}/?inviteToken=${token}`;

        const emailSubject = `Invitation to join ${workspaceName} on IntellMeet`;
        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">IntellMeet</h1>
              <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">AI-Powered Enterprise Collaboration</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 24px;" />
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviterName}</strong> has invited you to collaborate in their workspace, <strong>${workspaceName}</strong>, on the IntellMeet platform.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${acceptUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 32px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1); font-size: 14px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 16px;">
              If the button above does not work, copy and paste the following URL into your browser:
              <br />
              <a href="${acceptUrl}" style="color: #4f46e5; word-break: break-all;">${acceptUrl}</a>
            </p>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px; margin-bottom: 16px;" />
            
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
              This invitation was sent to ${emailNormalized} and will expire in 7 days.
            </p>
          </div>
        `;

        await transporter.sendMail({
          from: `"IntellMeet Collaborations" <${emailUser}>`,
          to: emailNormalized,
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`[Email] Workspace invitation sent to ${emailNormalized} via SMTP.`);
      } catch (mailErr) {
        console.error('[Email SMTP Error] Failed to send invitation email:', mailErr.message);
      }
    }

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

    // Verify email matches the logged-in user's email (case-insensitive and trimmed)
    if (invitation.email.toLowerCase().trim() !== req.user.email.toLowerCase().trim()) {
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

    // Fetch and populate workspace details to send back to frontend
    const workspace = await Workspace.findById(invitation.workspaceId).populate('owner', 'name email avatar');
    let wsObj = {};
    if (workspace) {
      wsObj = workspace.toObject();
      wsObj.role = 'Member';
    }

    return successResponse(res, 200, 'Workspace invitation accepted successfully', {
      workspaceId: invitation.workspaceId,
      workspace: wsObj,
    });
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

    if (invitation.email.toLowerCase().trim() !== req.user.email.toLowerCase().trim()) {
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

// @desc    Get pending invitations for a workspace
// @route   GET /api/workspaces/:id/invitations
// @access  Private (Owner, Admin, Member role required)
export const getPendingInvitations = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;

    const invitations = await WorkspaceInvitation.find({
      workspaceId,
      status: 'pending',
      expiresAt: { $gt: Date.now() },
    }).sort({ createdAt: -1 });

    return successResponse(res, 200, 'Pending invitations retrieved successfully', invitations);
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke/delete a pending workspace invitation
// @route   DELETE /api/workspaces/:id/invitations/:invitationId
// @access  Private (Owner or Admin role required)
export const revokeInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;

    const invitation = await WorkspaceInvitation.findById(invitationId);
    if (!invitation) {
      return errorResponse(res, 404, 'Invitation not found');
    }

    // Verify invitation belongs to this workspace
    if (invitation.workspaceId.toString() !== req.params.id) {
      return errorResponse(res, 400, 'Invitation does not belong to this workspace');
    }

    // Delete/Revoke invitation
    await invitation.deleteOne();

    // Log action
    await logWorkspaceAction(req.params.id, req.user.id, 'Invitation revoked', { email: invitation.email });

    return successResponse(res, 200, 'Workspace invitation revoked successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Admin/Owner directly accepts a pending invitation on behalf of the invited user
// @route   POST /api/workspaces/:id/invitations/:invitationId/accept
// @access  Private (Owner or Admin role required)
export const adminAcceptInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;

    const invitation = await WorkspaceInvitation.findById(invitationId);
    if (!invitation) {
      return errorResponse(res, 404, 'Invitation not found');
    }

    if (invitation.workspaceId.toString() !== req.params.id) {
      return errorResponse(res, 400, 'Invitation does not belong to this workspace');
    }

    if (invitation.status !== 'pending') {
      return errorResponse(res, 400, 'Invitation is not pending');
    }

    // Find or create the target user
    let targetUser = await User.findOne({ email: invitation.email });
    if (!targetUser) {
      // Auto-create user account if not registered yet
      const colors = ['#E11D48', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const emailPrefix = invitation.email.split('@')[0];
      const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      
      targetUser = await User.create({
        name: displayName,
        email: invitation.email,
        password: crypto.randomBytes(16).toString('hex'), // random password
        avatar: randomColor,
      });

      await createDefaultWorkspaceForUser(targetUser);
    }

    // Check if already a member (safety check)
    const alreadyMember = await WorkspaceMember.findOne({
      workspaceId: invitation.workspaceId,
      userId: targetUser._id,
    });

    if (!alreadyMember) {
      // Create membership record (default role: Member)
      await WorkspaceMember.create({
        workspaceId: invitation.workspaceId,
        userId: targetUser._id,
        role: 'Member',
      });

      // Link workspace to user Model workspaces array for backwards compatibility
      await User.findByIdAndUpdate(targetUser._id, {
        $addToSet: { workspaces: invitation.workspaceId },
      });
    }

    // Update invitation status
    invitation.status = 'accepted';
    await invitation.save();

    // Log action
    await logWorkspaceAction(invitation.workspaceId, req.user.id, 'Invitation accepted by admin', { email: invitation.email, targetUserId: targetUser._id });

    return successResponse(res, 200, 'Invitation accepted and user joined workspace successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending invitations for the logged-in user
// @route   GET /api/workspaces/invitations/pending
// @access  Private (Requires login)
export const getMyPendingInvitations = async (req, res, next) => {
  try {
    const invitations = await WorkspaceInvitation.find({
      email: req.user.email.toLowerCase().trim(),
      status: 'pending',
      expiresAt: { $gt: Date.now() },
    })
      .populate('workspaceId', 'name description')
      .populate('invitedBy', 'name email avatar');

    return successResponse(res, 200, 'Pending invitations retrieved successfully', invitations);
  } catch (error) {
    next(error);
  }
};



