// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const taskStatusesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.taskStatus.findMany({
        where: { project_id: input.projectId },
        include: { _count: { select: { tasks: true } } },
        orderBy: { position: 'asc' },
      });
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

      const lastStatus = await ctx.prisma.taskStatus.findFirst({
        where: { project_id: input.projectId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      // If setting as default, unset others
      if (input.isDefault) {
        await ctx.prisma.taskStatus.updateMany({
          where: { project_id: input.projectId, is_default: true },
          data: { is_default: false },
        });
      }

      return ctx.prisma.taskStatus.create({
        data: {
          project_id: input.projectId,
          name: input.name,
          color: input.color,
          status_type: input.statusType,
          is_default: input.isDefault,
          position: (lastStatus?.position ?? 0) + 1,
        },
      });
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
      const status = await ctx.prisma.taskStatus.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
      });
      if (!status) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task status not found' });

      if (input.isDefault) {
        await ctx.prisma.taskStatus.updateMany({
          where: { project_id: status.project_id, is_default: true, id: { not: input.id } },
          data: { is_default: false },
        });
      }

      return ctx.prisma.taskStatus.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.statusType !== undefined ? { status_type: input.statusType } : {}),
          ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), migrateToId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const status = await ctx.prisma.taskStatus.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
        include: { _count: { select: { tasks: true } } },
      });
      if (!status) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task status not found' });

      if (status._count.tasks > 0 && !input.migrateToId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `This status has ${status._count.tasks} tasks. Provide migrateToId to reassign them.`,
        });
      }

      if (input.migrateToId) {
        await ctx.prisma.task.updateMany({
          where: { status_id: input.id },
          data: { status_id: input.migrateToId },
        });
      }

      return ctx.prisma.taskStatus.delete({ where: { id: input.id } });
    }),

  reorder: protectedProcedure
    .input(z.object({ projectId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      await Promise.all(
        input.orderedIds.map((id, index) =>
          ctx.prisma.taskStatus.update({ where: { id }, data: { position: index + 1 } })
        )
      );
      return { success: true };
    }),
});
