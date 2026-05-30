// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const DealCreateSchema = z.object({
  pipeline_id: z.string(),
  stage_id: z.string(),
  name: z.string().min(1).max(255),
  amount: z.number().optional(),
  currency: z.string().length(3).default('USD'),
  probability: z.number().min(0).max(100).optional(),
  expected_close_date: z.date().optional(),
  deal_type: z.enum(['new_business', 'renewal', 'upsell', 'expansion', 'other']).default('new_business'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  owner_id: z.string().optional(),
  contact_id: z.string().optional(),
  account_id: z.string().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
});

const DealUpdateSchema = DealCreateSchema.partial().omit({ pipeline_id: true, stage_id: true });

const DealFilterSchema = z.object({
  search: z.string().optional(),
  owner_id: z.string().optional(),
  stage_id: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  rotting: z.boolean().optional(),
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
        ...(filters.owner_id && { owner_id: filters.owner_id }),
        ...(filters.stage_id && { stage_id: filters.stage_id }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.rotting !== undefined && { rotting: filters.rotting }),
        ...(filters.search && { name: { contains: filters.search, mode: 'insensitive' } }),
        ...(cursor && { id: { lt: cursor } }),
      };

      const deals = await ctx.prisma.crmDeal.findMany({
        where,
        take: limit + 1,
        orderBy: { [sort.field]: sort.dir },
        include: {
          stage: { select: { id: true, name: true, color: true, stage_type: true } },
          pipeline: { select: { id: true, name: true } },
          contact: { select: { id: true, first_name: true, last_name: true, email: true } },
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, avatar_url: true } },
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
          where: { id: input.pipelineId, organization_id: orgId, deleted_at: null },
          include: { stages: { orderBy: { position: 'asc' } } },
        }),
        ctx.prisma.crmDeal.findMany({
          where: { pipeline_id: input.pipelineId, organization_id: orgId, deleted_at: null },
          include: {
            contact: { select: { id: true, first_name: true, last_name: true } },
            account: { select: { id: true, name: true } },
            owner: { select: { id: true, name: true, avatar_url: true } },
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
          byStage[deal.stage_id].push(deal);
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
          pipeline: { include: { stages: { orderBy: { position: 'asc' } } } },
          contact: true,
          account: true,
          owner: { select: { id: true, name: true, avatar_url: true } },
          products: { include: { product: true }, orderBy: { position: 'asc' } },
          quotes: { orderBy: { created_at: 'desc' }, take: 5 },
          notes: { where: { deleted_at: null }, orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }], take: 10 },
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

      const stage = await ctx.prisma.crmStage.findUnique({ where: { id: input.stage_id } });
      const probability = input.probability ?? (stage ? Number(stage.probability) : 0);
      const weightedAmount = input.amount ? input.amount * probability / 100 : null;

      return ctx.prisma.crmDeal.create({
        data: {
          organization_id: orgId,
          pipeline_id: input.pipeline_id,
          stage_id: input.stage_id,
          name: input.name,
          amount: input.amount ?? null,
          currency: input.currency,
          probability: probability,
          weighted_amount: weightedAmount,
          expected_close_date: input.expected_close_date ?? null,
          deal_type: input.deal_type,
          priority: input.priority,
          owner_id: input.owner_id ?? null,
          contact_id: input.contact_id ?? null,
          account_id: input.account_id ?? null,
          source: input.source ?? null,
          description: input.description ?? null,
          stage_changed_at: new Date(),
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

      const amount = input.data.amount ?? (existing.amount ? Number(existing.amount) : null);
      const prob = input.data.probability ?? (existing.probability ? Number(existing.probability) : null);
      const weightedAmount = amount && prob ? amount * prob / 100 : null;

      return ctx.prisma.crmDeal.update({
        where: { id: input.id },
        data: {
          ...input.data,
          amount: amount ?? null,
          probability: prob ?? null,
          weighted_amount: weightedAmount,
          expected_close_date: input.data.expected_close_date ?? null,
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

      const stage = await ctx.prisma.crmStage.findFirst({
        where: { id: input.stageId, pipeline: { organization_id: orgId } },
      });
      if (!stage) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Stage not found or belongs to different organization' });

      return ctx.prisma.crmDeal.update({
        where: { id: input.dealId },
        data: {
          stage_id: input.stageId,
          pipeline_id: input.pipelineId,
          stage_changed_at: new Date(),
          last_activity_at: new Date(),
          rotting: false,
        },
      });
    }),

  markWon: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        wonAt: z.date().optional(),
        winReason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId, deleted_at: null },
        include: { pipeline: { include: { stages: true } } },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const wonStage = deal.pipeline.stages.find((s) => s.stage_type === 'won');
      const wonAt = input.wonAt ?? new Date();

      return ctx.prisma.crmDeal.update({
        where: { id: input.dealId },
        data: {
          won_at: wonAt,
          actual_close_date: wonAt,
          win_reason: input.winReason ?? null,
          stage_id: wonStage?.id ?? deal.stage_id,
          rotting: false,
        },
      });
    }),

  markLost: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        lostReasonId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId, deleted_at: null },
        include: { pipeline: { include: { stages: true } } },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const lostStage = deal.pipeline.stages.find((s) => s.stage_type === 'lost');
      const lostAt = new Date();

      return ctx.prisma.crmDeal.update({
        where: { id: input.dealId },
        data: {
          lost_at: lostAt,
          actual_close_date: lostAt,
          lost_reason_id: input.lostReasonId ?? null,
          description: input.notes ? `${deal.description ?? ''}\n\nLost reason notes: ${input.notes}` : deal.description,
          stage_id: lostStage?.id ?? deal.stage_id,
          rotting: false,
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
        data: { stage_id: input.stageId, stage_changed_at: new Date() },
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
          where: { entity_type: 'deal', entity_id: input.dealId, organization_id: orgId },
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
      ].sort((a, b) => b.date.getTime() - a.date.getTime());

      return timeline;
    }),

  // Products on a deal
  addProduct: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        productId: z.string().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.number().min(0.001).default(1),
        unit_price: z.number().min(0),
        discount_type: z.enum(['percent', 'amount']).optional(),
        discount_value: z.number().default(0),
        tax_rate: z.number().default(0),
        currency: z.string().length(3).default('USD'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const deal = await ctx.prisma.crmDeal.findFirst({
        where: { id: input.dealId, organization_id: orgId, deleted_at: null },
      });
      if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const maxPos = await ctx.prisma.crmDealProduct.aggregate({
        where: { deal_id: input.dealId },
        _max: { position: true },
      });

      const discountAmt =
        input.discount_type === 'percent'
          ? input.quantity * input.unit_price * (input.discount_value / 100)
          : (input.discount_value ?? 0);
      const subtotal = input.quantity * input.unit_price - discountAmt;
      const lineTotal = subtotal * (1 + input.tax_rate);

      return ctx.prisma.crmDealProduct.create({
        data: {
          deal_id: input.dealId,
          product_id: input.productId ?? null,
          name: input.name,
          description: input.description ?? null,
          quantity: input.quantity,
          unit_price: input.unit_price,
          discount_type: input.discount_type ?? null,
          discount_value: input.discount_value,
          tax_rate: input.tax_rate,
          line_total: lineTotal,
          currency: input.currency,
          position: (maxPos._max.position ?? 0) + 1,
        },
      });
    }),

  removeProduct: protectedProcedure
    .input(z.object({ dealProductId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // Verify ownership
      const dp = await ctx.prisma.crmDealProduct.findFirst({
        where: { id: input.dealProductId, deal: { organization_id: orgId } },
      });
      if (!dp) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not found or access denied' });
      return ctx.prisma.crmDealProduct.delete({ where: { id: input.dealProductId } });
    }),
});
