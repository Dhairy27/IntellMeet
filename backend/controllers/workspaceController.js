import Workspace from '../models/Workspace.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import WorkspaceInvitation from '../models/WorkspaceInvitation.js';
import WorkspaceLog from '../models/WorkspaceLog.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import ChatLog from '../models/ChatLog.js';
import AIResult from '../models/AIResult.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { logWorkspaceAction } from '../services/auditLogService.js';

// @desc    Create a new workspace
// @route   POST /api/workspaces
// @access  Private
export const createWorkspace = async (req, res, next) => {
  try {
    const { name, description, avatar } = req.body;

    const workspace = await Workspace.create({
      name,
      description,
      owner: req.user.id,
      avatar: avatar || '',
    });

    // Create owner membership record
    await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId: req.user.id,
      role: 'Owner',
    });

    // Link workspace to owner user model (for backwards compatibility if needed)
    await User.findByIdAndUpdate(req.user.id, {
      $push: { workspaces: workspace._id },
    });

    // Log action
    await logWorkspaceAction(workspace._id, req.user.id, 'Workspace created', { name });

    return successResponse(res, 201, 'Workspace created successfully', workspace);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all workspaces for the logged in user
// @route   GET /api/workspaces
// @access  Private
export const getWorkspaces = async (req, res, next) => {
  try {
    // Find all memberships for this user
    const memberships = await WorkspaceMember.find({ userId: req.user.id })
      .populate({
        path: 'workspaceId',
        populate: { path: 'owner', select: 'name email avatar' }
      });

    // Map memberships to standard workspace objects
    const workspaces = memberships
      .map((m) => {
        if (!m.workspaceId) return null;
        const ws = m.workspaceId.toObject();
        let normalizedRole = m.role;
        if (normalizedRole === 'OWNER') normalizedRole = 'Owner';
        if (normalizedRole === 'ADMIN') normalizedRole = 'Admin';
        if (normalizedRole === 'MEMBER') normalizedRole = 'Member';
        ws.role = normalizedRole; // attach member's role for UI checks
        return ws;
      })
      .filter(Boolean);

    return successResponse(res, 200, 'Workspaces retrieved successfully', workspaces);
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed workspace info, including tasks and members (formatted for frontend compatibility)
// @route   GET /api/workspaces/:id
// @access  Private
export const getWorkspaceDetails = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;

    // Check membership
    const membership = await WorkspaceMember.findOne({ workspaceId, userId: req.user.id });
    if (!membership) {
      return errorResponse(res, 403, 'Access denied. You are not a member of this workspace.');
    }

    const workspace = await Workspace.findById(workspaceId).populate('owner', 'name email avatar');
    if (!workspace) {
      return errorResponse(res, 404, 'Workspace not found');
    }

    // Fetch members and map to frontend-compatible members array shape: [{ user: { ... }, role }]
    const memberRecords = await WorkspaceMember.find({ workspaceId })
      .populate('userId', 'name email avatar');

    const mappedMembers = memberRecords.map((m) => {
      let normalizedRole = m.role;
      if (normalizedRole === 'OWNER') normalizedRole = 'Owner';
      if (normalizedRole === 'ADMIN') normalizedRole = 'Admin';
      if (normalizedRole === 'MEMBER') normalizedRole = 'Member';
      return {
        user: m.userId,
        role: normalizedRole,
      };
    });

    // Construct plain object that mimics the old Workspace model structure
    const workspaceObj = workspace.toObject();
    workspaceObj.creator = workspace.owner; // creator mapping
    workspaceObj.members = mappedMembers;   // members array mapping
    
    let userRole = membership.role;
    if (userRole === 'OWNER') userRole = 'Owner';
    if (userRole === 'ADMIN') userRole = 'Admin';
    if (userRole === 'MEMBER') userRole = 'Member';
    workspaceObj.userRole = userRole; // current user role flag

    // Fetch tasks
    const tasks = await Task.find({ workspace: workspaceId })
      .populate('assignee', 'name email avatar');

    return successResponse(res, 200, 'Workspace details retrieved successfully', {
      workspace: workspaceObj,
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update workspace details
// @route   PUT /api/workspaces/:id
// @access  Private (Owner or Admin role required)
export const updateWorkspace = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { name, description, avatar } = req.body;

    const workspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      { name, description, avatar },
      { new: true, runValidators: true }
    );

    if (!workspace) {
      return errorResponse(res, 404, 'Workspace not found');
    }

    // Log action
    await logWorkspaceAction(workspaceId, req.user.id, 'Workspace updated', { name, description });

    return successResponse(res, 200, 'Workspace updated successfully', workspace);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete workspace and all related items cascade
// @route   DELETE /api/workspaces/:id
// @access  Private (Owner only)
export const deleteWorkspace = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return errorResponse(res, 404, 'Workspace not found');
    }

    // Cascade delete memberships, invitations, tasks, meetings, logs
    await WorkspaceMember.deleteMany({ workspaceId });
    await WorkspaceInvitation.deleteMany({ workspaceId });
    await WorkspaceLog.deleteMany({ workspaceId });
    
    // Find and delete tasks
    await Task.deleteMany({ workspace: workspaceId });

    // Find meetings and clear their logs
    const meetings = await Meeting.find({ workspace: workspaceId });
    for (const meeting of meetings) {
      await ChatLog.deleteMany({ meeting: meeting._id });
      await AIResult.deleteMany({ meetingId: meeting._id });
      await meeting.deleteOne();
    }

    await workspace.deleteOne();

    // Remove workspace from user list
    await User.updateMany(
      { workspaces: workspaceId },
      { $pull: { workspaces: workspaceId } }
    );

    return successResponse(res, 200, 'Workspace and all associated records cascaded deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ==========================================
// TASKS OPERATIONS FOR ROUTE MOUNT COMPATIBILITY
// ==========================================

// @desc    Create a task inside a workspace
// @route   POST /api/workspaces/:id/tasks
// @access  Private
export const createTask = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { title, description, priority, assigneeId, dueDate, meetingId } = req.body;

    if (!title) {
      return errorResponse(res, 400, 'Please provide a task title');
    }

    // Validate membership
    const membership = await WorkspaceMember.findOne({ workspaceId, userId: req.user.id });
    if (!membership) {
      return errorResponse(res, 403, 'Unauthorized. You are not a member of this workspace.');
    }

    // All workspace members (Owner, Admin, Member) can create tasks.

    let assignee = null;
    if (assigneeId) {
      // Validate assignee is in workspace
      const isMember = await WorkspaceMember.findOne({ workspaceId, userId: assigneeId });
      if (!isMember) {
        return errorResponse(res, 400, 'Assignee must be a workspace member');
      }
      assignee = assigneeId;
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || 'medium',
      workspace: workspaceId,
      creator: req.user.id,
      assignee,
      assignedTo: assignee, // indexed field sync
      dueDate: dueDate || null,
      meetingId: meetingId || null,
    });

    const populatedTask = await Task.findById(task._id).populate('assignee', 'name email avatar');

    // Log action
    await logWorkspaceAction(workspaceId, req.user.id, 'Task created', { title, taskId: task._id });

    return successResponse(res, 201, 'Task created successfully', populatedTask);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a task
// @route   PUT /api/workspaces/tasks/:taskId
// @access  Private
export const updateTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, assigneeId, dueDate } = req.body;

    let task = await Task.findById(req.params.taskId);
    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }

    // Verify user membership & role
    const membership = await WorkspaceMember.findOne({ workspaceId: task.workspace, userId: req.user.id });
    if (!membership) {
      return errorResponse(res, 403, 'Unauthorized to modify tasks in this workspace');
    }

    // All workspace members can modify task definitions.

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    if (assigneeId !== undefined) {
      if (assigneeId === null) {
        updateData.assignee = null;
        updateData.assignedTo = null;
      } else {
        const isMember = await WorkspaceMember.findOne({ workspaceId: task.workspace, userId: assigneeId });
        if (!isMember) {
          return errorResponse(res, 400, 'Assignee must be a workspace member');
        }
        updateData.assignee = assigneeId;
        updateData.assignedTo = assigneeId; // indexed field sync
      }
    }

    task = await Task.findByIdAndUpdate(req.params.taskId, updateData, {
      new: true,
      runValidators: true,
    }).populate('assignee', 'name email avatar');

    // Log action
    await logWorkspaceAction(task.workspace, req.user.id, 'Task updated', { taskId: task._id, status });

    return successResponse(res, 200, 'Task updated successfully', task);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a task
// @route   DELETE /api/workspaces/tasks/:taskId
// @access  Private
export const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }

    // Verify membership
    const membership = await WorkspaceMember.findOne({ workspaceId: task.workspace, userId: req.user.id });
    if (!membership) {
      return errorResponse(res, 403, 'Access denied. You are not a member of this workspace.');
    }

    await task.deleteOne();

    // Log action
    await logWorkspaceAction(task.workspace, req.user.id, 'Task deleted', { taskId: task._id, title: task.title });

    return successResponse(res, 200, 'Task deleted successfully');
  } catch (error) {
    next(error);
  }
};
