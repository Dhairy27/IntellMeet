import WorkspaceMember from '../models/WorkspaceMember.js';
import { errorResponse } from '../utils/apiResponse.js';

export const requireWorkspaceRole = (allowedRoles) => async (req, res, next) => {
  try {
    const workspaceId = req.params.id || req.params.workspaceId || req.body.workspaceId || req.query.workspaceId || req.headers['x-workspace-id'];
    
    if (!workspaceId) {
      return errorResponse(res, 400, 'Workspace ID is required for access validation');
    }

    const membership = await WorkspaceMember.findOne({
      workspaceId,
      userId: req.user.id,
    });

    if (!membership) {
      return errorResponse(res, 403, 'Access denied. You are not a member of this workspace.');
    }

    const membershipRole = membership.role ? membership.role.toUpperCase() : '';
    const uppercaseAllowedRoles = allowedRoles.map(r => r.toUpperCase());

    if (!uppercaseAllowedRoles.includes(membershipRole)) {
      return errorResponse(res, 403, `Access denied. Requires role: ${allowedRoles.join(' or ')}`);
    }

    // Attach membership details to request for controllers
    req.workspaceMember = membership;
    next();
  } catch (err) {
    next(err);
  }
};
