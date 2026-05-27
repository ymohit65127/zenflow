import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ─── CRM v2 sub-routers ───────────────────────────────────────────────────────
import { crmPipelinesRouter } from './crm/pipelines';
import { crmAccountsRouter } from './crm/accounts';
import { crmDealsRouter } from './crm/deals';
import { crmContactsV2Router } from './crm/contacts_v2';
import { crmQuotesRouter } from './crm/quotes';
import { crmSequencesRouter } from './crm/sequences';
import { crmEmailRouter } from './crm/email';
import { crmProductsRouter } from './crm/products';
import { crmWebformsRouter } from './crm/webforms';
import { crmTerritoriesRouter } from './crm/territories';
import { crmNotesRouter } from './crm/notes';
import { crmReportsRouter } from './crm/reports';

// ─────────────────────────────────────────────────────────────────────────────
// Shared input schemas
// ─────────────────────────────────────────────────────────────────────────────

const paginationInput = z.object({
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// Contacts router
// ─────────────────────────────────────────────────────────────────────────────

const contactsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmContact.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          ...(input.status ? { status: input.status } : {}),
          ...(input.search
            ? {
                OR: [
                  { first_name: { contains: input.search, mode: 'insensitive' } },
                  { last_name: { contains: input.search, mode: 'insensitive' } },
                  { email: { contains: input.search, mode: 'insensitive' } },
                  { company: { contains: input.search, mode: 'insensitive' } },
                  { phone: { contains: input.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        take: input.limit,
        skip: input.offset,
        orderBy: { created_at: 'desc' },
      });
    }),

  count: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [total, active, inactive, blocked] = await Promise.all([
        ctx.prisma.crmContact.count({ where: { organization_id: orgId, deleted_at: null } }),
        ctx.prisma.crmContact.count({ where: { organization_id: orgId, deleted_at: null, status: 'ACTIVE' } }),
        ctx.prisma.crmContact.count({ where: { organization_id: orgId, deleted_at: null, status: 'INACTIVE' } }),
        ctx.prisma.crmContact.count({ where: { organization_id: orgId, deleted_at: null, status: 'BLOCKED' } }),
      ]);
      return { total, active, inactive, blocked };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const contact = await ctx.prisma.crmContact.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: { activities: { orderBy: { created_at: 'desc' }, take: 10 }, leads: true, deals: true },
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      return contact;
    }),

  create: protectedProcedure
    .input(
      z.object({
        first_name: z.string().min(1, 'First name is required'),
        last_name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        department: z.string().optional(),
        website: z.string().optional(),
        tags: z.array(z.string()).default([]),
        notes: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).default('ACTIVE'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmContact.create({
        data: {
          ...input,
          email: input.email || null,
          organization_id: orgId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        first_name: z.string().min(1).optional(),
        last_name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        department: z.string().optional(),
        website: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.crmContact.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      return ctx.prisma.crmContact.update({ where: { id }, data: { ...data, email: data.email || null } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmContact.findFirst({ where: { id: input.id, organization_id: orgId, deleted_at: null } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      return ctx.prisma.crmContact.update({ where: { id: input.id }, data: { deleted_at: new Date() } });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Leads router
// ─────────────────────────────────────────────────────────────────────────────

const leadsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).optional(),
        assignee_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmLead.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          ...(input.status ? { status: input.status } : {}),
          ...(input.assignee_id ? { assignee_id: input.assignee_id } : {}),
          ...(input.search
            ? {
                OR: [
                  { title: { contains: input.search, mode: 'insensitive' } },
                  { company: { contains: input.search, mode: 'insensitive' } },
                  { email: { contains: input.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          contact: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, name: true, avatar_url: true } },
        },
        take: input.limit,
        skip: input.offset,
        orderBy: { created_at: 'desc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const lead = await ctx.prisma.crmLead.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          contact: true,
          assignee: { select: { id: true, name: true, avatar_url: true } },
          activities: { orderBy: { created_at: 'desc' }, take: 10 },
        },
      });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });
      return lead;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        company: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        source: z.enum(['WEBSITE', 'SOCIAL_MEDIA', 'REFERRAL', 'EMAIL_CAMPAIGN', 'COLD_CALL', 'TRADE_SHOW', 'PARTNER', 'OTHER']).optional(),
        status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).default('NEW'),
        score: z.number().min(0).max(100).default(0),
        estimated_value: z.number().optional(),
        notes: z.string().optional(),
        contact_id: z.string().optional(),
        assignee_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmLead.create({
        data: {
          ...input,
          email: input.email || null,
          estimated_value: input.estimated_value ?? null,
          organization_id: orgId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        company: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        source: z.enum(['WEBSITE', 'SOCIAL_MEDIA', 'REFERRAL', 'EMAIL_CAMPAIGN', 'COLD_CALL', 'TRADE_SHOW', 'PARTNER', 'OTHER']).optional(),
        status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).optional(),
        score: z.number().min(0).max(100).optional(),
        estimated_value: z.number().optional(),
        notes: z.string().optional(),
        assignee_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.crmLead.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });
      return ctx.prisma.crmLead.update({ where: { id }, data: { ...data, email: data.email || null } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmLead.findFirst({ where: { id: input.id, organization_id: orgId, deleted_at: null } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });
      return ctx.prisma.crmLead.update({ where: { id: input.id }, data: { deleted_at: new Date() } });
    }),

  convert: protectedProcedure
    .input(
      z.object({
        lead_id: z.string(),
        pipeline_id: z.string(),
        stage_id: z.string(),
        deal_name: z.string().min(1),
        deal_value: z.number().optional(),
        expected_close: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const lead = await ctx.prisma.crmLead.findFirst({ where: { id: input.lead_id, organization_id: orgId, deleted_at: null } });
      if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });

      const deal = await ctx.prisma.crmDeal.create({
        data: {
          organization_id: orgId,
          pipeline_id: input.pipeline_id,
          stage_id: input.stage_id,
          contact_id: lead.contact_id,
          assignee_id: lead.assignee_id,
          name: input.deal_name,
          value: input.deal_value ?? null,
          expected_close: input.expected_close ? new Date(input.expected_close) : null,
          status: 'OPEN',
          notes: lead.notes,
        },
      });

      await ctx.prisma.crmLead.update({
        where: { id: input.lead_id },
        data: { status: 'CONVERTED', converted_at: new Date(), converted_deal_id: deal.id },
      });

      return deal;
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Deals router
// ─────────────────────────────────────────────────────────────────────────────

const dealsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        status: z.enum(['OPEN', 'WON', 'LOST', 'ON_HOLD']).optional(),
        pipeline_id: z.string().optional(),
        stage_id: z.string().optional(),
        assignee_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmDeal.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          ...(input.status ? { status: input.status } : {}),
          ...(input.pipeline_id ? { pipeline_id: input.pipeline_id } : {}),
          ...(input.stage_id ? { stage_id: input.stage_id } : {}),
          ...(input.assignee_id ? { assignee_id: input.assignee_id } : {}),
          ...(input.search
            ? { name: { contains: input.search, mode: 'insensitive' } }
            : {}),
        },
        include: {
          stage: { select: { id: true, name: true, color: true, sort_order: true } },
          pipeline: { select: { id: true, name: true } },
          contact: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, name: true, avatar_url: true } },
        },
        take: input.limit,
        skip: input.offset,
        orderBy: { created_at: 'desc' },
      });
    }),

  get: protectedProcedure
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
    .input(
      z.object({
        pipeline_id: z.string(),
        stage_id: z.string(),
        name: z.string().min(1, 'Deal name is required'),
        value: z.number().optional(),
        probability: z.number().min(0).max(100).optional(),
        expected_close: z.string().optional(),
        contact_id: z.string().optional(),
        assignee_id: z.string().optional(),
        tags: z.array(z.string()).default([]),
        notes: z.string().optional(),
        status: z.enum(['OPEN', 'WON', 'LOST', 'ON_HOLD']).default('OPEN'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmDeal.create({
        data: {
          ...input,
          value: input.value ?? null,
          probability: input.probability ?? null,
          expected_close: input.expected_close ? new Date(input.expected_close) : null,
          organization_id: orgId,
        },
        include: { stage: true, contact: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        value: z.number().optional(),
        probability: z.number().min(0).max(100).optional(),
        expected_close: z.string().optional(),
        contact_id: z.string().optional(),
        assignee_id: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        status: z.enum(['OPEN', 'WON', 'LOST', 'ON_HOLD']).optional(),
        lost_reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.crmDeal.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });

      const closedAt = data.status === 'WON' || data.status === 'LOST' ? new Date() : undefined;
      return ctx.prisma.crmDeal.update({
        where: { id },
        data: {
          ...data,
          expected_close: data.expected_close ? new Date(data.expected_close) : undefined,
          ...(closedAt ? { closed_at: closedAt } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmDeal.findFirst({ where: { id: input.id, organization_id: orgId, deleted_at: null } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      return ctx.prisma.crmDeal.update({ where: { id: input.id }, data: { deleted_at: new Date() } });
    }),

  moveStage: protectedProcedure
    .input(z.object({ id: z.string(), stage_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmDeal.findFirst({ where: { id: input.id, organization_id: orgId, deleted_at: null } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      return ctx.prisma.crmDeal.update({ where: { id: input.id }, data: { stage_id: input.stage_id } });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline router
// ─────────────────────────────────────────────────────────────────────────────

const pipelineRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.crmPipeline.findMany({
      where: { organization_id: orgId },
      include: { stages: { orderBy: { sort_order: 'asc' } }, _count: { select: { deals: true } } },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    });
  }),

  getWithStages: protectedProcedure
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
    .input(
      z.object({
        name: z.string().min(1, 'Pipeline name is required'),
        description: z.string().optional(),
        is_default: z.boolean().default(false),
        stages: z
          .array(
            z.object({
              name: z.string().min(1),
              color: z.string().default('#6366f1'),
              win_probability: z.number().min(0).max(100).optional(),
              is_closed: z.boolean().default(false),
              is_won: z.boolean().default(false),
            })
          )
          .default([
            { name: 'Prospecting', color: '#6366f1', win_probability: 10, is_closed: false, is_won: false },
            { name: 'Qualification', color: '#8b5cf6', win_probability: 25, is_closed: false, is_won: false },
            { name: 'Proposal', color: '#06b6d4', win_probability: 50, is_closed: false, is_won: false },
            { name: 'Negotiation', color: '#f59e0b', win_probability: 75, is_closed: false, is_won: false },
            { name: 'Closed Won', color: '#22c55e', win_probability: 100, is_closed: true, is_won: true },
            { name: 'Closed Lost', color: '#ef4444', win_probability: 0, is_closed: true, is_won: false },
          ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmPipeline.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          is_default: input.is_default,
          stages: {
            create: input.stages.map((stage, idx) => ({
              ...stage,
              win_probability: stage.win_probability ?? null,
              sort_order: idx,
            })),
          },
        },
        include: { stages: { orderBy: { sort_order: 'asc' } } },
      });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Activities router
// ─────────────────────────────────────────────────────────────────────────────

const activitiesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE', 'DEMO', 'FOLLOW_UP']).optional(),
        status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
        contact_id: z.string().optional(),
        lead_id: z.string().optional(),
        deal_id: z.string().optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmActivity.findMany({
        where: {
          organization_id: orgId,
          ...(input.type ? { type: input.type } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.contact_id ? { contact_id: input.contact_id } : {}),
          ...(input.lead_id ? { lead_id: input.lead_id } : {}),
          ...(input.deal_id ? { deal_id: input.deal_id } : {}),
          ...(input.from_date || input.to_date
            ? {
                due_at: {
                  ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                  ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                },
              }
            : {}),
        },
        include: {
          contact: { select: { id: true, first_name: true, last_name: true } },
          lead: { select: { id: true, title: true } },
          deal: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, avatar_url: true } },
        },
        take: input.limit,
        skip: input.offset,
        orderBy: [{ due_at: 'asc' }, { created_at: 'desc' }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE', 'DEMO', 'FOLLOW_UP']),
        subject: z.string().min(1, 'Subject is required'),
        description: z.string().optional(),
        status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PLANNED'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        due_at: z.string().optional(),
        contact_id: z.string().optional(),
        lead_id: z.string().optional(),
        deal_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const ownerId = ctx.session.user.id as string;
      return ctx.prisma.crmActivity.create({
        data: {
          ...input,
          due_at: input.due_at ? new Date(input.due_at) : null,
          organization_id: orgId,
          owner_id: ownerId,
        },
        include: { contact: true, lead: true, deal: true },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmActivity.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
      return ctx.prisma.crmActivity.update({
        where: { id: input.id },
        data: { status: 'COMPLETED', completed_at: new Date() },
      });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

const statsQuery = protectedProcedure.query(async ({ ctx }) => {
  const orgId = ctx.session.user.organizationId as string;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalContacts, activeLeads, openDeals, wonDealsThisMonth, recentActivities, pipelineStages] =
    await Promise.all([
      ctx.prisma.crmContact.count({ where: { organization_id: orgId, deleted_at: null } }),
      ctx.prisma.crmLead.count({ where: { organization_id: orgId, deleted_at: null, status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] } } }),
      ctx.prisma.crmDeal.aggregate({
        where: { organization_id: orgId, deleted_at: null, status: 'OPEN' },
        _sum: { value: true },
        _count: true,
      }),
      ctx.prisma.crmDeal.aggregate({
        where: { organization_id: orgId, deleted_at: null, status: 'WON', closed_at: { gte: startOfMonth } },
        _sum: { value: true },
        _count: true,
      }),
      ctx.prisma.crmActivity.findMany({
        where: { organization_id: orgId },
        include: { contact: { select: { first_name: true, last_name: true } }, owner: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
      ctx.prisma.crmPipelineStage.findMany({
        where: { pipeline: { organization_id: orgId } },
        include: { _count: { select: { deals: true } }, deals: { where: { deleted_at: null, status: 'OPEN' }, select: { value: true } } },
        orderBy: { sort_order: 'asc' },
        take: 10,
      }),
    ]);

  return {
    totalContacts,
    activeLeads,
    openDealsCount: openDeals._count,
    totalDealValue: Number(openDeals._sum.value ?? 0),
    wonDealsThisMonth: wonDealsThisMonth._count,
    wonValueThisMonth: Number(wonDealsThisMonth._sum.value ?? 0),
    recentActivities,
    pipelineStages: pipelineStages.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      count: s._count.deals,
      value: s.deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
    })),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Root CRM router
// ─────────────────────────────────────────────────────────────────────────────

export const crmRouter = createTRPCRouter({
  // v1 routers (preserved)
  contacts: contactsRouter,
  leads: leadsRouter,
  deals: dealsRouter,
  pipeline: pipelineRouter,
  activities: activitiesRouter,
  stats: statsQuery,

  // v2 sub-routers
  pipelines: crmPipelinesRouter,
  accounts: crmAccountsRouter,
  dealsV2: crmDealsRouter,
  contactsV2: crmContactsV2Router,
  quotes: crmQuotesRouter,
  sequences: crmSequencesRouter,
  email: crmEmailRouter,
  products: crmProductsRouter,
  webforms: crmWebformsRouter,
  territories: crmTerritoriesRouter,
  notes: crmNotesRouter,
  reports: crmReportsRouter,
});
