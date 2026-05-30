import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const workflowApprovalsRouter = createTRPCRouter({
  myPending: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id as string;
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.workflowApprovalRequest.findMany({
        where: {
          status: 'pending',
          approver_ids: { has: userId },
          run: { workflow: { organization_id: orgId } },
        },
        include: {
          run: {
            include: {
              workflow: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  list: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'timed_out']).optional(),
      page: z.number().int().default(1),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pageSize = 20;
      const skip = (input.page - 1) * pageSize;

      const where = {
        run: { workflow: { organization_id: orgId } },
        ...(input.status ? { status: input.status } : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.workflowApprovalRequest.findMany({
          where,
          include: {
            run: {
              include: { workflow: { select: { id: true, name: true } } },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
        ctx.prisma.workflowApprovalRequest.count({ where }),
      ]);

      return { items, total, page: input.page, pageSize };
    }),

  approve: protectedProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      remarks: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const orgId = ctx.session.user.organizationId as string;

      const request = await ctx.prisma.workflowApprovalRequest.findFirst({
        where: {
          id: input.requestId,
          status: 'pending',
          approver_ids: { has: userId },
          run: { workflow: { organization_id: orgId } },
        },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Approval request not found or already resolved' });

      const updated = await ctx.prisma.workflowApprovalRequest.update({
        where: { id: input.requestId },
        data: {
          status: 'approved',
          approved_by: userId,
          approved_at: new Date(),
          ...(input.remarks ? { rejected_reason: input.remarks } : {}),
        },
      });

      // Update run status back to running so the engine can continue
      await ctx.prisma.workflowV2Run.update({
        where: { id: request.run_id },
        data: { status: 'running' },
      });

      return updated;
    }),

  reject: protectedProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const orgId = ctx.session.user.organizationId as string;

      const request = await ctx.prisma.workflowApprovalRequest.findFirst({
        where: {
          id: input.requestId,
          status: 'pending',
          approver_ids: { has: userId },
          run: { workflow: { organization_id: orgId } },
        },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Approval request not found or already resolved' });

      const updated = await ctx.prisma.workflowApprovalRequest.update({
        where: { id: input.requestId },
        data: {
          status: 'rejected',
          approved_by: userId,
          approved_at: new Date(),
          rejected_reason: input.reason,
        },
      });

      // Mark run as failed
      await ctx.prisma.workflowV2Run.update({
        where: { id: request.run_id },
        data: {
          status: 'failed',
          error_message: `Approval rejected: ${input.reason}`,
          completed_at: new Date(),
        },
      });

      return updated;
    }),

  // Public route for email-link approvals
  approvePublic: publicProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      token: z.string(),
      remarks: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Token format: base64(requestId:userId:hmac)
      let userId: string;
      try {
        const decoded = Buffer.from(input.token, 'base64').toString('utf8');
        const parts = decoded.split(':');
        if (parts.length < 2 || parts[0] !== input.requestId) {
          throw new Error('Invalid token');
        }
        userId = parts[1]!;
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid approval token' });
      }

      const request = await ctx.prisma.workflowApprovalRequest.findFirst({
        where: { id: input.requestId, status: 'pending', approver_ids: { has: userId } },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.prisma.workflowApprovalRequest.update({
        where: { id: input.requestId },
        data: { status: 'approved', approved_by: userId, approved_at: new Date() },
      });
    }),

  rejectPublic: publicProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      token: z.string(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      let userId: string;
      try {
        const decoded = Buffer.from(input.token, 'base64').toString('utf8');
        const parts = decoded.split(':');
        if (parts.length < 2 || parts[0] !== input.requestId) {
          throw new Error('Invalid token');
        }
        userId = parts[1]!;
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid approval token' });
      }

      const request = await ctx.prisma.workflowApprovalRequest.findFirst({
        where: { id: input.requestId, status: 'pending', approver_ids: { has: userId } },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND' });

      const updated = await ctx.prisma.workflowApprovalRequest.update({
        where: { id: input.requestId },
        data: { status: 'rejected', approved_by: userId, approved_at: new Date(), rejected_reason: input.reason },
      });

      await ctx.prisma.workflowV2Run.update({
        where: { id: request.run_id },
        data: {
          status: 'failed',
          error_message: `Approval rejected: ${input.reason}`,
          completed_at: new Date(),
        },
      });

      return updated;
    }),
});
