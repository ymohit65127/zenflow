// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const workflowRunsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      workflowId: z.string().optional(),
      status: z.enum(['running', 'completed', 'failed', 'cancelled', 'timed_out']).optional(),
      page: z.number().int().default(1),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pageSize = 20;
      const skip = (input.page - 1) * pageSize;

      const where = {
        workflow: { organization_id: orgId },
        ...(input.workflowId ? { workflow_id: input.workflowId } : {}),
        ...(input.status ? { status: input.status } : {}),
      };

      const [runs, total] = await Promise.all([
        ctx.prisma.workflowRun.findMany({
          where,
          orderBy: { started_at: 'desc' },
          skip,
          take: pageSize,
          include: {
            workflow: { select: { id: true, name: true, trigger_type: true } },
            _count: { select: { step_logs: true } },
          },
        }),
        ctx.prisma.workflowRun.count({ where }),
      ]);

      return { runs, total, page: input.page, pageSize };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const run = await ctx.prisma.workflowRun.findFirst({
        where: { id: input.id, workflow: { organization_id: orgId } },
        include: {
          workflow: { select: { id: true, name: true, nodes: true, edges: true } },
          step_logs: { orderBy: { started_at: 'asc' } },
        },
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND' });
      return run;
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const run = await ctx.prisma.workflowRun.findFirst({
        where: { id: input.id, workflow: { organization_id: orgId } },
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND' });
      if (run.status !== 'running') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Run is not in running state' });
      }
      return ctx.prisma.workflowRun.update({
        where: { id: input.id },
        data: { status: 'cancelled', completed_at: new Date() },
      });
    }),

  logs: protectedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const run = await ctx.prisma.workflowRun.findFirst({
        where: { id: input.runId, workflow: { organization_id: orgId } },
        select: { id: true },
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.prisma.workflowRunStep.findMany({
        where: { run_id: input.runId },
        orderBy: { started_at: 'asc' },
      });
    }),
});
