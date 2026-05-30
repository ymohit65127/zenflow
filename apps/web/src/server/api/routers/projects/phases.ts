import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const phasesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.projectPhase.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        orderBy: { position: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        color: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const lastPhase = await ctx.prisma.projectPhase.findFirst({
        where: { project_id: input.projectId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return ctx.prisma.projectPhase.create({
        data: {
          project_id: input.projectId,
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? '#6B7280',
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          position: (lastPhase?.position ?? 0) + 1,
          status: 'not_started',
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        color: z.string().optional(),
        startDate: z.date().nullable().optional(),
        endDate: z.date().nullable().optional(),
        status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const phase = await ctx.prisma.projectPhase.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!phase) throw new TRPCError({ code: 'NOT_FOUND', message: 'Phase not found' });

      const { id, ...data } = input;
      return ctx.prisma.projectPhase.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.startDate !== undefined ? { start_date: data.startDate } : {}),
          ...(data.endDate !== undefined ? { end_date: data.endDate } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const phase = await ctx.prisma.projectPhase.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!phase) throw new TRPCError({ code: 'NOT_FOUND', message: 'Phase not found' });

      return ctx.prisma.projectPhase.delete({ where: { id: input.id } });
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        orderedIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      await Promise.all(
        input.orderedIds.map((id, index) =>
          ctx.prisma.projectPhase.update({ where: { id }, data: { position: index + 1 } })
        )
      );
      return { success: true };
    }),
});
