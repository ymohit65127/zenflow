import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

export const workflowWebhooksRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      // Verify workflow belongs to org
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.workflowId, organization_id: orgId },
        select: { id: true },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.prisma.workflowWebhookEndpoint.findMany({
        where: { workflow_id: input.workflowId, organization_id: orgId },
        orderBy: { created_at: 'desc' },
      });
    }),

  listAll: protectedProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.workflowWebhookEndpoint.findMany({
        where: { organization_id: orgId },
        include: {
          workflow: { select: { id: true, name: true, status: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      description: z.string().optional(),
      method: z.enum(['POST', 'GET', 'PUT']).default('POST'),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.workflowId, organization_id: orgId },
        select: { id: true },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND' });

      const path = crypto.randomBytes(24).toString('hex');
      const secret = crypto.randomBytes(32).toString('hex');

      return ctx.prisma.workflowWebhookEndpoint.create({
        data: {
          organization_id: orgId,
          workflow_id: input.workflowId,
          path,
          description: input.description ?? null,
          method: input.method,
          secret,
          is_active: true,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.workflowWebhookEndpoint.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.workflowWebhookEndpoint.delete({ where: { id: input.id } });
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.workflowWebhookEndpoint.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.workflowWebhookEndpoint.update({
        where: { id: input.id },
        data: { is_active: input.active },
      });
    }),

  regenerateSecret: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.workflowWebhookEndpoint.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      const newSecret = crypto.randomBytes(32).toString('hex');
      return ctx.prisma.workflowWebhookEndpoint.update({
        where: { id: input.id },
        data: { secret: newSecret },
      });
    }),
});
