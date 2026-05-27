import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const approvalsRouter = createTRPCRouter({
  /** List approval steps for a form */
  listSteps: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formApprovalStep.findMany({
        where: { form_id: input.formId },
        orderBy: { position: 'asc' },
      });
    }),

  /** Add an approval step */
  addStep: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        position: z.number().int().min(1),
        approver_type: z.enum(['user', 'role', 'manager']),
        approver_id: z.string().optional(),
        approver_role: z.string().max(50).optional(),
        notification_email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formApprovalStep.create({
        data: {
          form_id: input.formId,
          position: input.position,
          approver_type: input.approver_type,
          approver_id: input.approver_id ?? null,
          approver_role: input.approver_role ?? null,
          notification_email: input.notification_email ?? null,
        },
      });
    }),

  /** Update an approval step */
  updateStep: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        position: z.number().int().min(1).optional(),
        approver_type: z.enum(['user', 'role', 'manager']).optional(),
        approver_id: z.string().optional(),
        approver_role: z.string().max(50).optional(),
        notification_email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const step = await (ctx.prisma as any).formApprovalStep.findFirst({
        where: { id: input.id },
        include: { form: { select: { organization_id: true } } },
      });
      if (!step || step.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      const { id, ...data } = input;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formApprovalStep.update({
        where: { id },
        data: {
          ...(data.position !== undefined ? { position: data.position } : {}),
          ...(data.approver_type !== undefined ? { approver_type: data.approver_type } : {}),
          approver_id: data.approver_id ?? null,
          approver_role: data.approver_role ?? null,
          notification_email: data.notification_email ?? null,
        },
      });
    }),

  /** Delete an approval step */
  deleteStep: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const step = await (ctx.prisma as any).formApprovalStep.findFirst({
        where: { id: input.id },
        include: { form: { select: { organization_id: true } } },
      });
      if (!step || step.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formApprovalStep.delete({ where: { id: input.id } });
    }),

  /** Approve a submission (advance approval workflow) */
  approve: protectedProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        remarks: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const actorId = ctx.session.user.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const submission = await (ctx.prisma as any).formSubmission.findFirst({
        where: { id: input.submissionId },
        include: {
          form: {
            select: { organization_id: true, enable_approval: true },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        },
      });
      if (!submission || submission.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (submission.approval_status === 'approved') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Submission already approved' });
      }

      // Get current approval logs to determine step position
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs = await (ctx.prisma as any).formApprovalLog.findMany({
        where: { submission_id: input.submissionId, action: 'approved' },
        orderBy: { created_at: 'asc' },
      });
      const nextStep = (logs?.length ?? 0) + 1;

      // Get total steps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const steps = await (ctx.prisma as any).formApprovalStep.findMany({
        where: { form_id: submission.form_id },
        orderBy: { position: 'asc' },
      });
      const totalSteps = steps?.length ?? 0;

      // Log approval action
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.prisma as any).formApprovalLog.create({
        data: {
          submission_id: input.submissionId,
          step_position: nextStep,
          approver_id: actorId,
          action: 'approved',
          remarks: input.remarks ?? null,
        },
      });

      // Determine final status
      const isFinalStep = nextStep >= totalSteps;
      const newStatus = isFinalStep ? 'approved' : 'pending';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formSubmission.update({
        where: { id: input.submissionId },
        data: {
          approval_status: newStatus,
          ...(isFinalStep ? { approved_by: actorId, approved_at: new Date() } : {}),
        },
      });
    }),

  /** Reject a submission */
  reject: protectedProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        remarks: z.string().min(1, 'Rejection reason is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const actorId = ctx.session.user.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const submission = await (ctx.prisma as any).formSubmission.findFirst({
        where: { id: input.submissionId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        include: { form: { select: { organization_id: true } } as any },
      });
      if (!submission || submission.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (submission.approval_status === 'rejected') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Submission already rejected' });
      }

      // Get current step count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs = await (ctx.prisma as any).formApprovalLog.findMany({
        where: { submission_id: input.submissionId },
      });
      const stepPos = (logs?.length ?? 0) + 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.prisma as any).formApprovalLog.create({
        data: {
          submission_id: input.submissionId,
          step_position: stepPos,
          approver_id: actorId,
          action: 'rejected',
          remarks: input.remarks,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formSubmission.update({
        where: { id: input.submissionId },
        data: {
          approval_status: 'rejected',
          approval_remarks: input.remarks,
        },
      });
    }),

  /** Get approval timeline for a submission */
  timeline: protectedProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const submission = await (ctx.prisma as any).formSubmission.findFirst({
        where: { id: input.submissionId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        include: { form: { select: { organization_id: true } } as any },
      });
      if (!submission || submission.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formApprovalLog.findMany({
        where: { submission_id: input.submissionId },
        orderBy: { created_at: 'asc' },
      });
    }),
});
