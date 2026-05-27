// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const PipelineCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  currency: z.string().length(3).default('USD'),
  winProbabilityEnabled: z.boolean().default(true),
  rottingEnabled: z.boolean().default(false),
  rottingDays: z.number().int().min(1).max(365).default(14),
});

const PipelineUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  currency: z.string().length(3).optional(),
  winProbabilityEnabled: z.boolean().optional(),
  rottingEnabled: z.boolean().optional(),
  rottingDays: z.number().int().min(1).max(365).optional(),
});

const DEFAULT_STAGES = [
  { name: 'Prospecting', color: '#6366f1', probability: 10, position: 0, stage_type: 'active' as const },
  { name: 'Qualification', color: '#8b5cf6', probability: 25, position: 1, stage_type: 'active' as const },
  { name: 'Proposal', color: '#06b6d4', probability: 50, position: 2, stage_type: 'active' as const },
  { name: 'Negotiation', color: '#f59e0b', probability: 75, position: 3, stage_type: 'active' as const },
  { name: 'Closed Won', color: '#22c55e', probability: 100, position: 4, stage_type: 'won' as const, rottable: false },
  { name: 'Closed Lost', color: '#ef4444', probability: 0, position: 5, stage_type: 'lost' as const, rottable: false },
];

export const crmPipelinesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.crmPipeline.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: {
        stages: { orderBy: { position: 'asc' } },
        _count: { select: { deals: true } },
      },
      orderBy: { position: 'asc' },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pipeline = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: { stages: { orderBy: { position: 'asc' } } },
      });
      if (!pipeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });
      return pipeline;
    }),

  create: protectedProcedure
    .input(PipelineCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const maxPosition = await ctx.prisma.crmPipeline.aggregate({
        where: { organization_id: orgId, deleted_at: null },
        _max: { position: true },
      });

      return ctx.prisma.crmPipeline.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          name: input.name,
          description: input.description ?? null,
          color: input.color,
          currency: input.currency,
          win_probability_enabled: input.winProbabilityEnabled,
          rotting_enabled: input.rottingEnabled,
          rotting_days: input.rottingDays,
          position: (maxPosition._max.position ?? 0) + 1,
          stages: {
            create: DEFAULT_STAGES.map((s) => ({
              name: s.name,
              color: s.color,
              probability: s.probability,
              position: s.position,
              stage_type: s.stage_type,
              rottable: s.rottable ?? true,
            })),
          },
        },
        include: { stages: { orderBy: { position: 'asc' } } },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: PipelineUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      return ctx.prisma.crmPipeline.update({
        where: { id: input.id },
        data: {
          ...(input.data.name !== undefined && { name: input.data.name }),
          ...(input.data.description !== undefined && { description: input.data.description }),
          ...(input.data.color !== undefined && { color: input.data.color }),
          ...(input.data.currency !== undefined && { currency: input.data.currency }),
          ...(input.data.winProbabilityEnabled !== undefined && { win_probability_enabled: input.data.winProbabilityEnabled }),
          ...(input.data.rottingEnabled !== undefined && { rotting_enabled: input.data.rottingEnabled }),
          ...(input.data.rottingDays !== undefined && { rotting_days: input.data.rottingDays }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: { _count: { select: { deals: true } } },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      const openDeals = await ctx.prisma.crmDeal.count({
        where: { pipeline_id: input.id, deleted_at: null, won_at: null, lost_at: null },
      });
      if (openDeals > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Pipeline has ${openDeals} open deal(s). Close or move them first.`,
        });
      }

      return ctx.prisma.crmPipeline.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  reorder: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      await Promise.all(
        input.orderedIds.map((id, idx) =>
          ctx.prisma.crmPipeline.updateMany({
            where: { id, organization_id: orgId },
            data: { position: idx },
          })
        )
      );
      return { success: true };
    }),

  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      await ctx.prisma.crmPipeline.updateMany({
        where: { organization_id: orgId },
        data: { is_default: false },
      });
      return ctx.prisma.crmPipeline.update({
        where: { id: input.id },
        data: { is_default: true },
      });
    }),

  // Stages sub-procedures
  listStages: protectedProcedure
    .input(z.object({ pipelineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pipeline = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.pipelineId, organization_id: orgId, deleted_at: null },
      });
      if (!pipeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      return ctx.prisma.crmStage.findMany({
        where: { pipeline_id: input.pipelineId },
        orderBy: { position: 'asc' },
      });
    }),

  createStage: protectedProcedure
    .input(
      z.object({
        pipelineId: z.string(),
        name: z.string().min(1).max(255),
        color: z.string().default('#6366f1'),
        probability: z.number().min(0).max(100).default(50),
        stageType: z.enum(['active', 'won', 'lost']).default('active'),
        rottable: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pipeline = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.pipelineId, organization_id: orgId, deleted_at: null },
      });
      if (!pipeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      const maxPos = await ctx.prisma.crmStage.aggregate({
        where: { pipeline_id: input.pipelineId },
        _max: { position: true },
      });

      return ctx.prisma.crmStage.create({
        data: {
          pipeline_id: input.pipelineId,
          name: input.name,
          color: input.color,
          probability: input.probability,
          stage_type: input.stageType,
          rottable: input.rottable,
          position: (maxPos._max.position ?? 0) + 1,
        },
      });
    }),

  updateStage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        color: z.string().optional(),
        probability: z.number().min(0).max(100).optional(),
        stageType: z.enum(['active', 'won', 'lost']).optional(),
        rottable: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.crmStage.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.probability !== undefined && { probability: data.probability }),
          ...(data.stageType !== undefined && { stage_type: data.stageType }),
          ...(data.rottable !== undefined && { rottable: data.rottable }),
        },
      });
    }),

  deleteStage: protectedProcedure
    .input(z.object({ id: z.string(), moveTo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.moveTo) {
        await ctx.prisma.crmDeal.updateMany({
          where: { stage_id: input.id, deleted_at: null },
          data: { stage_id: input.moveTo },
        });
      }
      return ctx.prisma.crmStage.delete({ where: { id: input.id } });
    }),

  reorderStages: protectedProcedure
    .input(z.object({ pipelineId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.orderedIds.map((id, idx) =>
          ctx.prisma.crmStage.update({ where: { id }, data: { position: idx } })
        )
      );
      return { success: true };
    }),
});
