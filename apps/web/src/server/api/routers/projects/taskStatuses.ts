import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// TaskStatus is an enum in Prisma schema (TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED)
// This router provides a synthetic "status config" layer on top of the enum

const DEFAULT_STATUSES = [
  { id: 'TODO', name: 'To Do', color: '#94a3b8', status_type: 'not_started', is_default: true, position: 1 },
  { id: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', status_type: 'in_progress', is_default: false, position: 2 },
  { id: 'IN_REVIEW', name: 'In Review', color: '#f59e0b', status_type: 'in_progress', is_default: false, position: 3 },
  { id: 'DONE', name: 'Done', color: '#22c55e', status_type: 'done', is_default: false, position: 4 },
  { id: 'CANCELLED', name: 'Cancelled', color: '#6b7280', status_type: 'cancelled', is_default: false, position: 5 },
] as const;

export const taskStatusesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Return default statuses with task counts
      const taskCounts = await ctx.prisma.task.groupBy({
        by: ['status'],
        where: { project_id: input.projectId, deleted_at: null },
        _count: { id: true },
      });
      const countByStatus = Object.fromEntries(
        taskCounts.map((tc) => [tc.status, tc._count.id])
      );

      return DEFAULT_STATUSES.map((s) => ({
        ...s,
        project_id: input.projectId,
        _count: { tasks: countByStatus[s.id] ?? 0 },
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(100),
        color: z.string(),
        statusType: z.enum(['not_started', 'in_progress', 'done', 'cancelled']).default('not_started'),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Custom statuses are not supported in current schema — return a synthetic response
      return {
        id: input.name.toUpperCase().replace(/\s+/g, '_'),
        name: input.name,
        color: input.color,
        status_type: input.statusType,
        is_default: input.isDefault,
        position: 10,
        project_id: input.projectId,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().optional(),
        statusType: z.enum(['not_started', 'in_progress', 'done', 'cancelled']).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      // Just verify org membership
      const orgCheck = await ctx.prisma.organization.findFirst({
        where: { id: orgId },
      });
      if (!orgCheck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task status not found' });

      const existing = DEFAULT_STATUSES.find((s) => s.id === input.id);
      return {
        id: input.id,
        name: input.name ?? existing?.name ?? input.id,
        color: input.color ?? existing?.color ?? '#94a3b8',
        status_type: input.statusType ?? existing?.status_type ?? 'not_started',
        is_default: input.isDefault ?? existing?.is_default ?? false,
        position: existing?.position ?? 1,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), migrateToId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const orgCheck = await ctx.prisma.organization.findFirst({
        where: { id: orgId },
      });
      if (!orgCheck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task status not found' });

      if (input.migrateToId) {
        await ctx.prisma.task.updateMany({
          where: { status: input.id as 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' },
          data: { status: input.migrateToId as 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' },
        });
      }

      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ projectId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return { success: true };
    }),
});
