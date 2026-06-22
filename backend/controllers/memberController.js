import Workspace from '../models/Workspace.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { logWorkspaceAction } from '../services/auditLogService.js';

// @desc    List all members in a workspace
// @route   GET /api/workspaces/:id/members
// @access  Private
export const listMembers = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;

    const members = await WorkspaceMember.find({ workspaceId })
      .populate('userId', 'name email avatar')
      .sort('roleJoined'); // sort standard

    const mappedMembers = members.map((m) => {
      let normalizedRole = m.role;
      if (normalizedRole === 'OWNER') normalizedRole = 'Owner';
      if (normalizedRole === 'ADMIN') normalizedRole = 'Admin';
      if (normalizedRole === 'MEMBER') normalizedRole = 'Member';
      return {
        user: m.userId,
        role: normalizedRole,
        joinedAt: m.joinedAt,
      };
    });

    return successResponse(res, 200, 'Members retrieved successfully', mappedMembers);
  } catch (error) {
    next(error);
  }
};

// @desc    Change role of a workspace member
// @route   PUT /api/workspaces/:id/members/:userId
// @access  Private (Owner or Admin only)
export const updateMemberRole = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;

    if (!role) {
      return errorResponse(res, 400, 'Role is required');
    }

    const upperRole = role.toUpperCase();
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(upperRole)) {
      return errorResponse(res, 400, 'Invalid role. Allowed values: Owner, Admin, Member');
    }

    // Get current user's membership role
    const currentMember = req.workspaceMember; // set by middleware
    const targetMember = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });

    if (!targetMember) {
      return errorResponse(res, 404, 'Member not found in this workspace');
    }

    const currentRole = currentMember.role ? currentMember.role.toUpperCase() : '';
    const targetRole = targetMember.role ? targetMember.role.toUpperCase() : '';

    // Enforce role policies
    if (currentRole === 'ADMIN') {
      // Admins cannot change Owners
      if (targetRole === 'OWNER') {
        return errorResponse(res, 403, 'Admins cannot change the Owner role');
      }
      // Admins cannot promote anyone to Owner
      if (upperRole === 'OWNER') {
        return errorResponse(res, 403, 'Admins cannot promote users to Owner');
      }
      // Admins cannot modify other Admins
      if (targetRole === 'ADMIN' && targetUserId !== req.user.id) {
        return errorResponse(res, 403, 'Admins cannot modify roles of other Admins');
      }
    }

    // Ownership Transfer Logic
    if (upperRole === 'OWNER') {
      if (currentRole !== 'OWNER') {
        return errorResponse(res, 403, 'Only the current Owner can transfer ownership');
      }

      // 1. Update workspace owner field
      await Workspace.findByIdAndUpdate(workspaceId, { owner: targetUserId });

      // 2. Demote current owner to Admin (preserving the case style)
      const useUpper = currentMember.role === 'OWNER' || role === 'OWNER';
      currentMember.role = useUpper ? 'ADMIN' : 'Admin';
      await currentMember.save();

      // 3. Promote target user to Owner
      targetMember.role = useUpper ? 'OWNER' : 'Owner';
      await targetMember.save();

      await logWorkspaceAction(workspaceId, req.user.id, 'Ownership transferred', { newOwnerId: targetUserId });
      return successResponse(res, 200, 'Ownership transferred successfully. Your role is now Admin.');
    }

    // Standard role change
    const oldRole = targetMember.role;
    targetMember.role = role;
    await targetMember.save();

    await logWorkspaceAction(workspaceId, req.user.id, 'Member role updated', { targetUserId, oldRole, newRole: role });

    return successResponse(res, 200, `Role updated from ${oldRole} to ${role} successfully`, targetMember);
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from workspace
// @route   DELETE /api/workspaces/:id/members/:userId
// @access  Private (Owner/Admin or self-leave)
export const removeMember = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const targetUserId = req.params.userId;

    const currentMember = req.workspaceMember; // set by middleware
    const targetMember = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });

    if (!targetMember) {
      return errorResponse(res, 404, 'Member not found in this workspace');
    }

    const isSelfLeave = targetUserId === req.user.id;
    const currentRole = currentMember.role ? currentMember.role.toUpperCase() : '';
    const targetRole = targetMember.role ? targetMember.role.toUpperCase() : '';

    // Enforce role policies
    if (targetRole === 'OWNER') {
      return errorResponse(res, 400, 'The Owner cannot be removed. Transfer ownership first.');
    }

    if (!isSelfLeave) {
      // Check privileges for kicking
      if (currentRole === 'ADMIN') {
        if (targetRole === 'ADMIN') {
          return errorResponse(res, 403, 'Admins cannot remove other Admins');
        }
      }
    }

    // Perform removal
    await targetMember.deleteOne();

    // Also remove from user workspace array for backward compatibility
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { workspaces: workspaceId },
    });

    const actionText = isSelfLeave ? 'Member left workspace' : 'Member removed';
    await logWorkspaceAction(workspaceId, req.user.id, actionText, { targetUserId });

    return successResponse(res, 200, isSelfLeave ? 'You left the workspace' : 'Member removed successfully');
  } catch (error) {
    next(error);
  }
};
