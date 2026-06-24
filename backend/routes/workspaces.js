import express from 'express';
import {
  createWorkspace,
  getWorkspaces,
  getWorkspaceDetails,
  updateWorkspace,
  deleteWorkspace,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/workspaceController.js';
import {
  listMembers,
  updateMemberRole,
  removeMember,
} from '../controllers/memberController.js';
import {
  inviteUser,
  acceptInvitation,
  rejectInvitation,
  getPendingInvitations,
  revokeInvitation,
  getMyPendingInvitations,
} from '../controllers/invitationController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createWorkspaceSchema } from '../validations/workspace.js';
import { requireWorkspaceRole } from '../middleware/role.js';

const router = express.Router();

// General workspace routes
router.post('/', protect, validate(createWorkspaceSchema), createWorkspace);
router.get('/', protect, getWorkspaces);

// Invitation routes (unscoped to workspace ID in URL)
router.get('/invitations/pending', protect, getMyPendingInvitations);
router.post('/invitations/accept', protect, acceptInvitation);
router.post('/invitations/reject', protect, rejectInvitation);

// Workspace specific routes
router.get('/:id', protect, requireWorkspaceRole(['Owner', 'Admin', 'Member']), getWorkspaceDetails);
router.put('/:id', protect, requireWorkspaceRole(['Owner', 'Admin']), updateWorkspace);
router.delete('/:id', protect, requireWorkspaceRole(['Owner']), deleteWorkspace);

// Member management routes
router.post('/:id/invite', protect, requireWorkspaceRole(['Owner', 'Admin']), inviteUser);
router.get('/:id/members', protect, requireWorkspaceRole(['Owner', 'Admin', 'Member']), listMembers);
router.put('/:id/members/:userId', protect, requireWorkspaceRole(['Owner', 'Admin']), updateMemberRole);
router.delete('/:id/members/:userId', protect, requireWorkspaceRole(['Owner', 'Admin', 'Member']), removeMember);

// Invitation management routes
router.get('/:id/invitations', protect, requireWorkspaceRole(['Owner', 'Admin', 'Member']), getPendingInvitations);
router.delete('/:id/invitations/:invitationId', protect, requireWorkspaceRole(['Owner', 'Admin']), revokeInvitation);

// Task routes nested or independent
router.post('/:id/tasks', protect, requireWorkspaceRole(['Owner', 'Admin']), createTask);
router.put('/tasks/:taskId', protect, updateTask);
router.delete('/tasks/:taskId', protect, deleteTask);

export default router;
