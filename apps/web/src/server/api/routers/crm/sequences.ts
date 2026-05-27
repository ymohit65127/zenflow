// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const SequenceStepSchema = z.object({
  position: z.number().int().min(0),
  type: z.enum(['email', 'sms', 'call', 'task', 'wait']),
  wait_days: z.number().int().min(0).default(0),
  wait_hours: z.number().int().min(0).default(0),
  wait_until_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().optional(),
  task_title: z.string().max(255).optional(),
  task_type: z.enum(['call', 'email', 'meeting', 'task', 'note', 'deadline']).optional(),
});

export const crmSequencesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmSequence.findMany({
        where: {
          organization_id: orgId,
          ...(input.status && { status: input.status }),
        },
        include: {
          _count: { select: { steps: true, enrollments: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const seq = await ctx.prisma.crmSequence.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          steps: { orderBy: { position: 'asc' } },
          creator: { select: { id: true, name: true } },
          _count: { select: { enrollments: true } },
        },
      });
      if (!seq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });

      const [activeCount, completedCount, exitedCount] = await Promise.all([
        ctx.prisma.crmSequenceEnrollment.count({ where: { sequence_id: input.id, status: 'active' } }),
        ctx.prisma.crmSequenceEnrollment.count({ where: { sequence_id: input.id, status: 'completed' } }),
        ctx.prisma.crmSequenceEnrollment.count({ where: { sequence_id: input.id, status: 'exited' } }),
      ]);

      return { ...seq, stats: { active: activeCount, completed: completedCount, exited: exitedCount } };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        goal: z.string().max(500).optional(),
        trigger_type: z.enum(['manual', 'lead_created', 'lead_score', 'deal_stage']).default('manual'),
        trigger_config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      return ctx.prisma.crmSequence.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          name: input.name,
          description: input.description ?? null,
          goal: input.goal ?? null,
          trigger_type: input.trigger_type,
          trigger_config: input.trigger_config ?? null,
          status: 'draft',
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          goal: z.string().max(500).optional(),
          trigger_type: z.enum(['manual', 'lead_created', 'lead_score', 'deal_stage']).optional(),
          trigger_config: z.record(z.unknown()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmSequence.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });

      return ctx.prisma.crmSequence.update({
        where: { id: input.id },
        data: {
          ...(input.data.name !== undefined && { name: input.data.name }),
          ...(input.data.description !== undefined && { description: input.data.description ?? null }),
          ...(input.data.goal !== undefined && { goal: input.data.goal ?? null }),
          ...(input.data.trigger_type !== undefined && { trigger_type: input.data.trigger_type }),
          ...(input.data.trigger_config !== undefined && { trigger_config: input.data.trigger_config ?? null }),
        },
      });
    }),

  updateSteps: protectedProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        steps: z.array(SequenceStepSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const seq = await ctx.prisma.crmSequence.findFirst({
        where: { id: input.sequenceId, organization_id: orgId },
      });
      if (!seq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });

      await ctx.prisma.$transaction([
        ctx.prisma.crmSequenceStep.deleteMany({ where: { sequence_id: input.sequenceId } }),
        ctx.prisma.crmSequenceStep.createMany({
          data: input.steps.map((step) => ({
            sequence_id: input.sequenceId,
            position: step.position,
            type: step.type,
            wait_days: step.wait_days,
            wait_hours: step.wait_hours,
            wait_until_time: step.wait_until_time ?? null,
            subject: step.subject ?? null,
            body: step.body ?? null,
            task_title: step.task_title ?? null,
            task_type: step.task_type ?? null,
          })),
        }),
        ctx.prisma.crmSequence.update({
          where: { id: input.sequenceId },
          data: { step_count: input.steps.length },
        }),
      ]);

      return ctx.prisma.crmSequence.findFirst({
        where: { id: input.sequenceId },
        include: { steps: { orderBy: { position: 'asc' } } },
      });
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const seq = await ctx.prisma.crmSequence.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { _count: { select: { steps: true } } },
      });
      if (!seq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });
      if (seq._count.steps === 0) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Sequence must have at least one step' });
      }

      return ctx.prisma.crmSequence.update({
        where: { id: input.id },
        data: { status: 'active' },
      });
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      await ctx.prisma.crmSequenceEnrollment.updateMany({
        where: { sequence_id: input.id, status: 'active' },
        data: { status: 'paused' },
      });
      return ctx.prisma.crmSequence.update({
        where: { id: input.id, organization_id: orgId },
        data: { status: 'paused' },
      });
    }),

  enroll: protectedProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        contactIds: z.array(z.string()),
        dealId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const seq = await ctx.prisma.crmSequence.findFirst({
        where: { id: input.sequenceId, organization_id: orgId, status: 'active' },
      });
      if (!seq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Active sequence not found' });

      // Check for unsubscribed or already enrolled
      const [unsubscribed, alreadyEnrolled] = await Promise.all([
        ctx.prisma.crmContact.findMany({
          where: { id: { in: input.contactIds }, unsubscribed: true },
          select: { id: true },
        }),
        ctx.prisma.crmSequenceEnrollment.findMany({
          where: { sequence_id: input.sequenceId, contact_id: { in: input.contactIds }, status: 'active' },
          select: { contact_id: true },
        }),
      ]);

      const skipIds = new Set([
        ...unsubscribed.map((c) => c.id),
        ...alreadyEnrolled.map((e) => e.contact_id),
      ]);

      const eligible = input.contactIds.filter((id) => !skipIds.has(id));

      if (eligible.length === 0) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'All contacts are already enrolled or unsubscribed' });
      }

      await ctx.prisma.crmSequenceEnrollment.createMany({
        data: eligible.map((contactId) => ({
          sequence_id: input.sequenceId,
          contact_id: contactId,
          deal_id: input.dealId ?? null,
          enrolled_by: userId,
          status: 'active',
          current_step_position: 0,
          next_step_at: new Date(),
        })),
        skipDuplicates: true,
      });

      await ctx.prisma.crmSequence.update({
        where: { id: input.sequenceId },
        data: { enrolled_count: { increment: eligible.length } },
      });

      return { enrolled: eligible.length, skipped: skipIds.size };
    }),

  exit: protectedProcedure
    .input(z.object({ enrollmentId: z.string(), reason: z.string().max(255) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.crmSequenceEnrollment.update({
        where: { id: input.enrollmentId },
        data: { status: 'exited', exited_at: new Date(), exit_reason: input.reason },
      });
    }),

  getEnrollments: protectedProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        status: z.enum(['active', 'paused', 'completed', 'exited', 'bounced']).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const enrollments = await ctx.prisma.crmSequenceEnrollment.findMany({
        where: {
          sequence_id: input.sequenceId,
          ...(input.status && { status: input.status }),
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        take: (input.limit ?? 25) + 1,
        orderBy: { enrolled_at: 'desc' },
        include: {
          contact: { select: { id: true, first_name: true, last_name: true, email: true } },
          enrolled_by_user: { select: { id: true, name: true } },
        },
      });

      let nextCursor: string | undefined;
      if (enrollments.length > (input.limit ?? 25)) {
        const next = enrollments.pop();
        nextCursor = next?.id;
      }

      return { enrollments, nextCursor };
    }),
});
