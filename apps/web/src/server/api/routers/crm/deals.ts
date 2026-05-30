import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { CrmDiscountType } from '@prisma/client';

const DealCreateSchema = z.object({
  pipeline_id: z.string(),
  stage_id: z.string(),
  name: z.string().min(1).max(255),
  value: z.number().optional(),
  currency: z.string().length(3).default('USD'),
  probability: z.number().min(0).max(100).optional(),
  expected_close: z.date().optional(),
  assignee_id: z.string().optional(),
  contact_id: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const DealUpdateSchema = DealCreateSchema.partial().omit({ pipeline_id: true, stage_id: true });

const DealFilterSchema = z.object({
  search: z.string().optional(),
  assignee_id: z.string().optional(),
  stage_id: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export const crmDealsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        pipelineId: z.string().optional(),
        filters: DealFilterSchema.default({}),
        sort: z.object({
          field: z.enum(['name', 'created_at', 'amount', 'expected_close_date']).default('created_at'),
          dir: z.enum(['asc', 'desc']).default('desc'),
        }).default({ field: 'created_at', dir: 'desc' }),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { filters, sort, limit, cursor, pipelineId } = input;

      const where: Record<string, unknown> = {
        organization_id: orgId,
        deleted_at: null,
        ...(pipelineId && { pipeline_id: pipelineId }),
        ...(filters.assignee_id && { assignee_id: filters.assignee_id }),
        ...(filters.stage_id && { stage_id: filters.stage_id }),
        ...(filters.search && { name: { contains: filters.search, mode: 'insensitive' } }),
        ...(cursor && { id: { lt: cursor } }),
      };

      const sortField =
        sort.field === 'amount' ? 'value'
        : sort.field === 'expected_close_date' ? 'expected_close'
        : sort.field;

      const deals = await ctx.prisma.crmDeal.findMany({
        where,
        take: limit + 1,
        orderBy: { [sortField]: sort.dir } as Record<string, 'asc' | 'desc'>,
        include: {
          stage: { select: { id: true, name: true, color: true, sort_order: true } },
          pipeline: { select: { id: true, name: true } },
          contact: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, name: true, avatar_url: true } },
        },
      });

      let nextCursor: string | undefined;
      if (deals.length > limit) {
        const next = deals.pop();
        nextCursor = next?.id;
      }

      return { deals, nextCursor };
    }),

  getKanbanData: protectedProcedure
    .input(z.object({ pipelineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const [pipeline, deals] = await Promise.all([
        ctx.prisma.crmPipeline.findFirst({
          where: { id: input.pipelineId, organization_id: orgId },
          include: { stages: { orderBy: { sort_order: 'asc' } } },
        }),
        ctx.prisma.crmDeal.findMany({
          where: { pipeline_id: input.pipelineId, organization_id: orgId, deleted_at: null },
          include: {
            contact: { select: { id: true, first_name: true, last_name: true } },
            assignee: { select: { id: true, name: true, avatar_url: true } },
          },
          orderBy: { created_at: 'asc' },
        }),
      ]);

      if (!pipeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found' });

      const byStage: Record<string, typeof deals> = {};
      for (const stage of pipeline.stages) {
        byStage[stage.id] = [];
      }
      for (const deal of deals) {
        if (byStage[deal.stage_id]) {
          byStage[deal.stage_id]!.push(deal);
        }
      }

      return { pipeline, stages: pipeline.stages, dealsByStage: byStage };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          stage: true,
          pipeline: { include: { stages: { orderBy: { sort_order: 'asc' } } } },
          contact: true,
          assignee: { select: { id: true, name: true, avatar_url: true } },
          activities: { orderBy: { created_at: 'desc' }, take: 10 },
        },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      return deal;
    }),

  create: protectedProcedure
    .input(DealCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const stage = await ctx.prisma.crmPipelineStage.findUnique({ where: { id: input.stage_id } });
      const probability = input.probability ?? (stage ? Number(stage.win_probability) : 0);

      return ctx.prisma.crmDeal.create({
        data: {
          organization_id: orgId,
          pipeline_id: input.pipeline_id,
          stage_id: input.stage_id,
          name: input.name,
          value: input.value ?? null,
          currency: input.currency,
          probability: probability,
          expected_close: input.expected_close ?? null,
          assignee_id: input.assignee_id ?? null,
          contact_id: input.contact_id ?? null,
          notes: input.notes ?? null,
          tags: input.tags ?? [],
          status: 'OPEN',
        },
        include: { stage: true, contact: true },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: DealUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      return ctx.prisma.crmDeal.update({
        where: { id: input.id },
        data: {
          ...(input.data.name !== undefined && { name: input.data.name }),
          ...(input.data.value !== undefined && { value: input.data.value ?? null }),
          ...(input.data.currency !== undefined && { currency: input.data.currency }),
          ...(input.data.probability !== undefined && { probability: input.data.probability ?? null }),
          ...(input.data.expected_close !== undefined && { expected_close: input.data.expected_close ?? null }),
          ...(input.data.assignee_id !== undefined && { assignee_id: input.data.assignee_id ?? null }),
          ...(input.data.contact_id !== undefined && { contact_id: input.data.contact_id ?? null }),
          ...(input.data.notes !== undefined && { notes: input.data.notes ?? null }),
          ...(input.data.tags !== undefined && { tags: input.data.tags }),
        },
      });
    }),

  moveStage: protectedProcedure
    .input(z.object({ dealId: z.string(), stageId: z.string(), pipelineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const stage = await ctx.prisma.crmPipelineStage.findFirst({
        where: { id: input.stageId, pipeline: { organization_id: orgId } },
      });
      if (!stage) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Stage not found or belongs to different organization' });

      return ctx.prisma.crmDeal.update({
        where: { id: input.dealId },
        data: {
          stage_id: input.stageId,
          pipeline_id: input.pipelineId,
        },
      });
    }),

  markWon: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        winReason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId, deleted_at: null },
        include: { pipeline: { include: { stages: { orderBy: { sort_order: 'asc' } } } } },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const wonStage = deal.pipeline.stages.find((s) => s.is_won);

      return ctx.prisma.crmDeal.update({
        where: { id: input.dealId },
        data: {
          status: 'WON',
          closed_at: new Date(),
          stage_id: wonStage?.id ?? deal.stage_id,
        },
      });
    }),

  markLost: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        lostReason: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId, deleted_at: null },
        include: { pipeline: { include: { stages: { orderBy: { sort_order: 'asc' } } } } },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const lostStage = deal.pipeline.stages.find((s) => s.is_closed && !s.is_won);

      return ctx.prisma.crmDeal.update({
        where: { id: input.dealId },
        data: {
          status: 'LOST',
          closed_at: new Date(),
          lost_reason: input.lostReason ?? (input.notes ?? null),
          stage_id: lostStage?.id ?? deal.stage_id,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      return ctx.prisma.crmDeal.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  bulkMove: protectedProcedure
    .input(z.object({ dealIds: z.array(z.string()), stageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmDeal.updateMany({
        where: { id: { in: input.dealIds }, organization_id: orgId, deleted_at: null },
        data: { stage_id: input.stageId },
      });
    }),

  getTimeline: protectedProcedure
    .input(z.object({ dealId: z.string(), cursor: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const [activities, notes, emails] = await Promise.all([
        ctx.prisma.crmActivity.findMany({
          where: { deal_id: input.dealId, organization_id: orgId },
          orderBy: { created_at: 'desc' },
          take: input.limit,
        }),
        ctx.prisma.crmNote.findMany({
          where: { entity_type: 'deal', entity_id: input.dealId, organization_id: orgId, deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: input.limit,
        }),
        ctx.prisma.crmEmailLog.findMany({
          where: { entity_type: 'deal', entity_id: input.dealId, organization_id: orgId },
          orderBy: { sent_at: 'desc' },
          take: input.limit,
        }),
      ]);

      const timeline = [
        ...activities.map((a) => ({ type: 'activity' as const, date: a.created_at, data: a })),
        ...notes.map((n) => ({ type: 'note' as const, date: n.created_at, data: n })),
        ...emails.map((e) => ({ type: 'email' as const, date: e.sent_at, data: e })),
      ].sort((a, b) => (b.date ?? new Date(0)).getTime() - (a.date ?? new Date(0)).getTime());

      return timeline;
    }),

  // Products on a deal
  addProduct: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        productId: z.string(),
        quantity: z.number().min(0.001).default(1),
        unit_price: z.number().min(0),
        discount_type: z.enum(['percent', 'amount']).default('percent'),
        discount: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId, deleted_at: null },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const discountAmt =
        input.discount_type === 'percent'
          ? input.quantity * input.unit_price * (input.discount / 100)
          : input.discount;
      const total = input.quantity * input.unit_price - discountAmt;

      return ctx.prisma.crmDealProduct.create({
        data: {
          deal_id: input.dealId,
          product_id: input.productId,
          quantity: input.quantity,
          unit_price: input.unit_price,
          discount_type: input.discount_type as unknown as CrmDiscountType,
          discount: input.discount,
          total,
        },
      });
    }),

  removeProduct: protectedProcedure
    .input(z.object({ dealProductId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const dp = await ctx.prisma.crmDealProduct.findFirst({
        where: { id: input.dealProductId },
        include: { product: { select: { organization_id: true } } },
      });
      if (!dp || dp.product.organization_id !== orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not found or access denied' });
      }
      return ctx.prisma.crmDealProduct.delete({ where: { id: input.dealProductId } });
    }),
});
