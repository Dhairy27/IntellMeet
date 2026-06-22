import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';
import AIResult from '../models/AIResult.js';
import Workspace from '../models/Workspace.js';
import { successResponse } from '../utils/apiResponse.js';

// @desc    Get dashboard metrics stats
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMeetings = await Meeting.countDocuments();
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'done' });
    const pendingTasks = await Task.countDocuments({ status: { $ne: 'done' } });
    const aiSummariesGenerated = await AIResult.countDocuments();
    const workspaceCount = await Workspace.countDocuments();

    // Calculate total meeting duration in minutes
    const finishedMeetings = await Meeting.find({
      actualStartTime: { $ne: null },
      actualEndTime: { $ne: null }
    });
    
    let totalDurationMinutes = 0;
    finishedMeetings.forEach((m) => {
      const diffMs = new Date(m.actualEndTime).getTime() - new Date(m.actualStartTime).getTime();
      if (diffMs > 0) {
        totalDurationMinutes += Math.floor(diffMs / 60000);
      }
    });

    return successResponse(res, 200, 'Dashboard statistics compiled successfully', {
      totalUsers,
      totalMeetings,
      totalMeetingDuration: totalDurationMinutes,
      totalTasks,
      completedTasks,
      pendingTasks,
      aiSummariesGenerated,
      workspaceCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard analytics trends
// @route   GET /api/dashboard/analytics
// @access  Private
export const getDashboardAnalytics = async (req, res, next) => {
  try {
    // 1. Meetings per day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const meetingsPerDay = await Meeting.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 2. Tasks completed per day
    const tasksCompletedPerDay = await Task.aggregate([
      {
        $match: {
          status: 'done',
          updatedAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. AI Usage trends
    const aiUsagePerDay = await AIResult.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 4. Meeting duration trend (average duration of meetings ended per day)
    const durationTrendPerDay = await Meeting.aggregate([
      {
        $match: {
          actualStartTime: { $ne: null },
          actualEndTime: { $ne: null },
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          durationMinutes: {
            $divide: [
              { $subtract: ["$actualEndTime", "$actualStartTime"] },
              60000
            ]
          }
        }
      },
      {
        $group: {
          _id: "$day",
          averageDuration: { $avg: "$durationMinutes" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return successResponse(res, 200, 'Dashboard analytics data compiled successfully', {
      meetingsPerDay,
      tasksCompletedPerDay,
      aiUsagePerDay,
      durationTrendPerDay
    });
  } catch (error) {
    next(error);
  }
};
