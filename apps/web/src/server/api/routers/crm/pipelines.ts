import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const PipelineCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  is_default: z.boolean().default(false),
});

const PipelineUpdateSchema = PipelineCreateSchema.partial();

const DEFAULT_STAGES = [
  { name: 'Prospecting', color: '#6366f1', win_probability: 10, sort_order: 0, is_closed: false, is_won: false },
  { name: 'Qualification', color: '#8b5cf6', win_probability: 25, sort_order: 1, is_closed: false, is_won: false },
  { name: 'Proposal', color: '#06b6d4', win_probability: 50, sort_order: 2, is_closed: false, is_won: false },
  { name: 'Negotiation', color: '#f59e0b', win_probability: 75, sort_order: 3, is_closed: false, is_won: false },
  { name: 'Closed Won', color: '#22c55e', win_probability: 100, sort_order: 4, is_closed: true, is_won: true },
  { name: 'Closed Lost', color: '#ef4444', win_probability: 0, sort_order: 5, is_closed: true, is_won: false },
];

export const crmPipelinesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.crmPipeline.findMany({
      where: { organization_id: orgId },
      include: {
        stages: { orderBy: { sort_order: 'asc' } },
        _count: { select: { deals: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pipeline = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { stages: { orderBy: { sort_order: 'asc' } } },
      });
      if (!pipeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });
      return pipeline;
    }),

  create: protectedProcedure
    .input(PipelineCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      return ctx.prisma.crmPipeline.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          is_default: input.is_default,
          stages: {
            create: DEFAULT_STAGES.map((s) => ({
              name: s.name,
              color: s.color,
              win_probability: s.win_probability,
              sort_order: s.sort_order,
              is_closed: s.is_closed,
              is_won: s.is_won,
            })),
          },
        },
        include: { stages: { orderBy: { sort_order: 'asc' } } },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: PipelineUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      return ctx.prisma.crmPipeline.update({
        where: { id: input.id },
        data: {
          ...(input.data.name !== undefined && { name: input.data.name }),
          ...(input.data.description !== undefined && { description: input.data.description }),
          ...(input.data.is_default !== undefined && { is_default: input.data.is_default }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      const openDeals = await ctx.prisma.crmDeal.count({
        where: { pipeline_id: input.id, deleted_at: null, status: 'OPEN' },
      });
      if (openDeals > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Pipeline has ${openDeals} open deal(s). Close or move them first.`,
        });
      }

      // Hard delete pipeline (cascades to stages via DB)
      return ctx.prisma.crmPipeline.delete({ where: { id: input.id } });
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

  // Stage sub-procedures (use CrmPipelineStage)
  listStages: protectedProcedure
    .input(z.object({ pipelineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pipeline = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.pipelineId, organization_id: orgId },
      });
      if (!pipeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      return ctx.prisma.crmPipelineStage.findMany({
        where: { pipeline_id: input.pipelineId },
        orderBy: { sort_order: 'asc' },
      });
    }),

  createStage: protectedProcedure
    .input(
      z.object({
        pipelineId: z.string(),
        name: z.string().min(1).max(255),
        color: z.string().default('#6366f1'),
        win_probability: z.number().min(0).max(100).default(50),
        is_closed: z.boolean().default(false),
        is_won: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pipeline = await ctx.prisma.crmPipeline.findFirst({
        where: { id: input.pipelineId, organization_id: orgId },
      });
      if (!pipeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      const maxSort = await ctx.prisma.crmPipelineStage.aggregate({
        where: { pipeline_id: input.pipelineId },
        _max: { sort_order: true },
      });

      return ctx.prisma.crmPipelineStage.create({
        data: {
          pipeline_id: input.pipelineId,
          name: input.name,
          color: input.color,
          win_probability: input.win_probability,
          is_closed: input.is_closed,
          is_won: input.is_won,
          sort_order: (maxSort._max.sort_order ?? 0) + 1,
        },
      });
    }),

  updateStage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        color: z.string().optional(),
        win_probability: z.number().min(0).max(100).optional(),
        is_closed: z.boolean().optional(),
        is_won: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.crmPipelineStage.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.win_probability !== undefined && { win_probability: data.win_probability }),
          ...(data.is_closed !== undefined && { is_closed: data.is_closed }),
          ...(data.is_won !== undefined && { is_won: data.is_won }),
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
      return ctx.prisma.crmPipelineStage.delete({ where: { id: input.id } });
    }),

  reorderStages: protectedProcedure
    .input(z.object({ pipelineId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.orderedIds.map((id, idx) =>
          ctx.prisma.crmPipelineStage.update({ where: { id }, data: { sort_order: idx } })
        )
      );
      return { success: true };
    }),
});
