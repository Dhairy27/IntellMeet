import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Meeting title is required').trim(),
  description: z.string().optional().default(''),
  workspaceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid workspace ID format'),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional().default('scheduled'),
  scheduledStartTime: z.coerce.date().optional(),
  scheduledEndTime: z.coerce.date().optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1, 'Meeting title is required').trim().optional(),
  description: z.string().optional(),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional(),
  scheduledStartTime: z.coerce.date().optional(),
  scheduledEndTime: z.coerce.date().optional(),
  actualStartTime: z.coerce.date().optional(),
  actualEndTime: z.coerce.date().optional(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').trim(),
  type: z.enum(['personal', 'shared']).optional().default('personal'),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').trim(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['HOST', 'CO_HOST', 'PARTICIPANT']),
});
