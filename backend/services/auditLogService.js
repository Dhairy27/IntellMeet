import WorkspaceLog from '../models/WorkspaceLog.js';

/**
 * Log a user action inside a workspace for auditing.
 * @param {string} workspaceId - The Workspace ID
 * @param {string} userId - The User ID executing the action
 * @param {string} action - Action description string
 * @param {object} details - Metadata details object
 */
export const logWorkspaceAction = async (workspaceId, userId, action, details = {}) => {
  try {
    await WorkspaceLog.create({
      workspaceId,
      userId,
      action,
      details,
    });
    console.log(`[AuditLog] logged action: "${action}" for workspace: ${workspaceId}`);
  } catch (err) {
    console.error(`[AuditLog Error] failed to log action: ${err.message}`);
  }
};
