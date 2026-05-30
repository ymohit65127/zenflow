import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

const SequenceStepSchema = z.object({
  position: z.number().int().min(0),
  type: z.enum(['email', 'sms', 'call', 'task', 'wait']),
  delay_days: z.number().int().min(0).default(0),
  delay_hours: z.number().int().min(0).default(0),
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
          _count: { select: { enrollments: true } },
        },
      });
      if (!seq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });

      const [activeCount, completedCount, unenrolledCount] = await Promise.all([
        ctx.prisma.crmSequenceEnrollment.count({ where: { sequence_id: input.id, status: 'active' } }),
        ctx.prisma.crmSequenceEnrollment.count({ where: { sequence_id: input.id, status: 'completed' } }),
        ctx.prisma.crmSequenceEnrollment.count({ where: { sequence_id: input.id, status: 'unenrolled' } }),
      ]);

      return { ...seq, stats: { active: activeCount, completed: completedCount, exited: unenrolledCount } };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        trigger_type: z.enum(['manual', 'deal_stage_change', 'lead_status_change', 'form_submission']).default('manual'),
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
          trigger_type: input.trigger_type,
          trigger_config: input.trigger_config !== undefined ? input.trigger_config as Prisma.InputJsonValue : Prisma.JsonNull,
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
          trigger_type: z.enum(['manual', 'deal_stage_change', 'lead_status_change', 'form_submission']).optional(),
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
          ...(input.data.trigger_type !== undefined && { trigger_type: input.data.trigger_type }),
          ...(input.data.trigger_config !== undefined && { trigger_config: input.data.trigger_config !== undefined ? input.data.trigger_config as Prisma.InputJsonValue : Prisma.JsonNull }),
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
            step_type: step.type,
            delay_days: step.delay_days,
            delay_hours: step.delay_hours,
            config: {
              subject: step.subject ?? null,
              body: step.body ?? null,
              task_title: step.task_title ?? null,
              task_type: step.task_type ?? null,
            },
          })),
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
      return ctx.prisma.crmSequence.update({
        where: { id: input.id, organization_id: orgId },
        data: { status: 'paused' },
      });
    }),

  enroll: protectedProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        entityType: z.enum(['contact', 'lead', 'deal', 'account']).default('contact'),
        entityIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const seq = await ctx.prisma.crmSequence.findFirst({
        where: { id: input.sequenceId, organization_id: orgId, status: 'active' },
      });
      if (!seq) throw new TRPCError({ code: 'NOT_FOUND', message: 'Active sequence not found' });

      // Check for already enrolled entities
      const alreadyEnrolled = await ctx.prisma.crmSequenceEnrollment.findMany({
        where: {
          sequence_id: input.sequenceId,
          entity_type: input.entityType,
          entity_id: { in: input.entityIds },
          status: 'active',
        },
        select: { entity_id: true },
      });

      const enrolledIds = new Set(alreadyEnrolled.map((e) => e.entity_id));
      const eligible = input.entityIds.filter((id) => !enrolledIds.has(id));

      if (eligible.length === 0) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'All entities are already enrolled' });
      }

      await ctx.prisma.crmSequenceEnrollment.createMany({
        data: eligible.map((entityId) => ({
          sequence_id: input.sequenceId,
          entity_type: input.entityType,
          entity_id: entityId,
          enrolled_by: userId,
          status: 'active',
          current_step: 0,
        })),
        skipDuplicates: true,
      });

      return { enrolled: eligible.length, skipped: enrolledIds.size };
    }),

  exit: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.crmSequenceEnrollment.update({
        where: { id: input.enrollmentId },
        data: { status: 'unenrolled', unenrolled_at: new Date() },
      });
    }),

  getEnrollments: protectedProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        status: z.enum(['active', 'completed', 'unenrolled', 'bounced', 'replied']).optional(),
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
      });

      let nextCursor: string | undefined;
      if (enrollments.length > (input.limit ?? 25)) {
        const next = enrollments.pop();
        nextCursor = next?.id;
      }

      return { enrollments, nextCursor };
    }),
});
