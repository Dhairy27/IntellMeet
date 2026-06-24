import Task from '../models/Task.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

// @desc    Get all tasks for the logged in user
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res, next) => {
  try {
    const { workspaceId, page = 1, limit = 50 } = req.query;

    // Get user workspace memberships
    const memberships = await WorkspaceMember.find({ userId: req.user.id });
    const userWorkspaceIds = memberships.map(m => m.workspaceId.toString());

    let query = {};
    if (workspaceId) {
      if (!userWorkspaceIds.includes(workspaceId.toString())) {
        return errorResponse(res, 403, 'Access denied to this workspace.');
      }
      query.workspace = workspaceId;
    } else {
      query.workspace = { $in: memberships.map(m => m.workspaceId) };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Task.countDocuments(query);
    
    const tasks = await Task.find(query)
      .populate('assignee', 'name email avatar')
      .populate('workspace', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return successResponse(res, 200, 'Tasks retrieved successfully', {
      tasks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res, next) => {
  try {
    const { workspaceId, workspace, title, task, description, priority, assigneeId, dueDate, meetingId } = req.body;
    const targetWorkspaceId = workspaceId || workspace;

    if (!targetWorkspaceId) {
      return errorResponse(res, 400, 'Please provide a workspace ID');
    }

    const taskTitle = title || task;
    if (!taskTitle) {
      return errorResponse(res, 400, 'Please provide a task title or description');
    }

    // Verify membership
    const membership = await WorkspaceMember.findOne({ workspaceId: targetWorkspaceId, userId: req.user.id });
    if (!membership) {
      return errorResponse(res, 403, 'Access denied. You are not a member of this workspace.');
    }

    // All workspace members (Owner, Admin, Member) can create tasks.

    let assignee = null;
    if (assigneeId) {
      const isMember = await WorkspaceMember.findOne({ workspaceId: targetWorkspaceId, userId: assigneeId });
      if (!isMember) {
        return errorResponse(res, 400, 'Assignee must be a workspace member');
      }
      assignee = assigneeId;
    }

    const newTask = await Task.create({
      title: taskTitle,
      task: taskTitle,
      description: description || '',
      priority: priority || 'medium',
      workspace: targetWorkspaceId,
      creator: req.user.id,
      assignee,
      assignedTo: assignee,
      dueDate: dueDate || null,
      meetingId: meetingId || null,
    });

    const populated = await Task.findById(newTask._id)
      .populate('assignee', 'name email avatar')
      .populate('workspace', 'name');

    return successResponse(res, 201, 'Task created successfully', populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, task, description, status, priority, assigneeId, dueDate } = req.body;

    let existingTask = await Task.findById(id);
    if (!existingTask) {
      return errorResponse(res, 404, 'Task not found');
    }

    // Verify membership
    const membership = await WorkspaceMember.findOne({ workspaceId: existingTask.workspace, userId: req.user.id });
    if (!membership) {
      return errorResponse(res, 403, 'Access denied to this workspace.');
    }

    // All workspace members can modify task definitions.

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (task !== undefined) updateData.task = task || title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    if (assigneeId !== undefined) {
      if (assigneeId === null || assigneeId === '') {
        updateData.assignee = null;
        updateData.assignedTo = null;
      } else {
        const isMember = await WorkspaceMember.findOne({ workspaceId: existingTask.workspace, userId: assigneeId });
        if (!isMember) {
          return errorResponse(res, 400, 'Assignee must be a workspace member');
        }
        updateData.assignee = assigneeId;
        updateData.assignedTo = assigneeId;
      }
    }

    const updated = await Task.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    }).populate('assignee', 'name email avatar');

    return successResponse(res, 200, 'Task updated successfully', updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingTask = await Task.findById(id);
    if (!existingTask) {
      return errorResponse(res, 404, 'Task not found');
    }

    // Verify membership
    const membership = await WorkspaceMember.findOne({ workspaceId: existingTask.workspace, userId: req.user.id });
    if (!membership) {
      return errorResponse(res, 403, 'Access denied. Requires Workspace membership.');
    }

    await existingTask.deleteOne();

    return successResponse(res, 200, 'Task deleted successfully');
  } catch (error) {
    next(error);
  }
};
