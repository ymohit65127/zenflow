import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const milestonesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.projectMilestone.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        orderBy: { due_date: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        phaseId: z.string().optional(),
        name: z.string().min(1).max(255),
        dueDate: z.date(),
        description: z.string().optional(),
        color: z.string().optional(),
        notifyOnDue: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.projectMilestone.create({
        data: {
          project_id: input.projectId,
          organization_id: orgId,
          phase_id: input.phaseId ?? null,
          name: input.name,
          due_date: input.dueDate,
          description: input.description ?? null,
          status: 'pending',
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        dueDate: z.date().optional(),
        description: z.string().nullable().optional(),
        color: z.string().optional(),
        phaseId: z.string().nullable().optional(),
        notifyOnDue: z.boolean().optional(),
        status: z.enum(['pending', 'achieved', 'missed', 'cancelled']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const milestone = await ctx.prisma.projectMilestone.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!milestone) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' });

      const { id, ...data } = input;
      return ctx.prisma.projectMilestone.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.dueDate !== undefined ? { due_date: data.dueDate } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.phaseId !== undefined ? { phase_id: data.phaseId } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
      });
    }),

  achieve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const milestone = await ctx.prisma.projectMilestone.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!milestone) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' });

      return ctx.prisma.projectMilestone.update({
        where: { id: input.id },
        data: { status: 'achieved', achieved_at: new Date() },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const milestone = await ctx.prisma.projectMilestone.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!milestone) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' });

      return ctx.prisma.projectMilestone.delete({ where: { id: input.id } });
    }),
});
