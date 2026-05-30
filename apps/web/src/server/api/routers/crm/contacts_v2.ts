// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const ContactCreateSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().optional(),
  email: z.string().email().max(255),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
  linkedin_url: z.string().url('Must be a valid URL').optional().nullable(),
  twitter_url: z.string().url('Must be a valid URL').optional().nullable(),
  lifecycle_stage: z.enum(['lead', 'subscriber', 'opportunity', 'customer', 'evangelist']).default('lead'),
  source: z.string().optional(),
  source_detail: z.string().optional(),
  tags: z.array(z.string()).default([]),
  account_id: z.string().optional(),
  owner_id: z.string().optional(),
});

const ContactUpdateSchema = ContactCreateSchema.partial();

const ContactFilterSchema = z.object({
  search: z.string().optional(),
  lifecycle_stage: z.enum(['lead', 'subscriber', 'opportunity', 'customer', 'evangelist']).optional(),
  owner_id: z.string().optional(),
  account_id: z.string().optional(),
  unsubscribed: z.boolean().optional(),
  lead_score_min: z.number().optional(),
  lead_score_max: z.number().optional(),
  tag: z.string().optional(),
});

export const crmContactsV2Router = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
        filters: ContactFilterSchema.default({}),
        sort: z.object({
          field: z.enum(['first_name', 'created_at', 'lead_score', 'last_activity_at']).default('created_at'),
          dir: z.enum(['asc', 'desc']).default('desc'),
        }).default({ field: 'created_at', dir: 'desc' }),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { filters, sort, limit, cursor } = input;

      const where: Record<string, unknown> = {
        organization_id: orgId,
        deleted_at: null,
        ...(filters.lifecycle_stage && { lifecycle_stage: filters.lifecycle_stage }),
        ...(filters.owner_id && { owner_id: filters.owner_id }),
        ...(filters.account_id && { account_id: filters.account_id }),
        ...(filters.unsubscribed !== undefined && { unsubscribed: filters.unsubscribed }),
        ...(filters.tag && { tags: { has: filters.tag } }),
        ...((filters.lead_score_min !== undefined || filters.lead_score_max !== undefined) && {
          lead_score: {
            ...(filters.lead_score_min !== undefined && { gte: filters.lead_score_min }),
            ...(filters.lead_score_max !== undefined && { lte: filters.lead_score_max }),
          },
        }),
        ...(filters.search && {
          OR: [
            { first_name: { contains: filters.search, mode: 'insensitive' } },
            { last_name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
        ...(cursor && { id: { lt: cursor } }),
      };

      const contacts = await ctx.prisma.crmContact.findMany({
        where,
        take: limit + 1,
        orderBy: { [sort.field]: sort.dir },
        include: {
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { deals: true } },
        },
      });

      let nextCursor: string | undefined;
      if (contacts.length > limit) {
        const next = contacts.pop();
        nextCursor = next?.id;
      }

      return { contacts, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const contact = await ctx.prisma.crmContact.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          account: true,
          owner: { select: { id: true, name: true, avatar_url: true } },
          deals: {
            where: { deleted_at: null },
            include: { stage: { select: { name: true, color: true } }, pipeline: { select: { name: true } } },
            take: 10,
          },
          notes: { where: { deleted_at: null }, orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }], take: 10 },
          sequence_enrollments: {
            include: { sequence: { select: { id: true, name: true, status: true } } },
            orderBy: { enrolled_at: 'desc' },
            take: 5,
          },
        },
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      return contact;
    }),

  create: protectedProcedure
    .input(ContactCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmContact.create({
        data: {
          organization_id: orgId,
          first_name: input.first_name,
          last_name: input.last_name ?? null,
          email: input.email,
          phone: input.phone ?? null,
          mobile: input.mobile ?? null,
          job_title: input.job_title ?? null,
          department: input.department ?? null,
          linkedin_url: input.linkedin_url ?? null,
          twitter_url: input.twitter_url ?? null,
          lifecycle_stage: input.lifecycle_stage,
          source: input.source ?? null,
          source_detail: input.source_detail ?? null,
          tags: input.tags,
          account_id: input.account_id ?? null,
          owner_id: input.owner_id ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: ContactUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmContact.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });

      const { data } = input;
      return ctx.prisma.crmContact.update({
        where: { id: input.id },
        data: {
          ...(data.first_name !== undefined && { first_name: data.first_name }),
          ...(data.last_name !== undefined && { last_name: data.last_name ?? null }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.phone !== undefined && { phone: data.phone ?? null }),
          ...(data.mobile !== undefined && { mobile: data.mobile ?? null }),
          ...(data.job_title !== undefined && { job_title: data.job_title ?? null }),
          ...(data.department !== undefined && { department: data.department ?? null }),
          ...(data.linkedin_url !== undefined && { linkedin_url: data.linkedin_url ?? null }),
          ...(data.twitter_url !== undefined && { twitter_url: data.twitter_url ?? null }),
          ...(data.lifecycle_stage !== undefined && { lifecycle_stage: data.lifecycle_stage }),
          ...(data.source !== undefined && { source: data.source ?? null }),
          ...(data.source_detail !== undefined && { source_detail: data.source_detail ?? null }),
          ...(data.tags !== undefined && { tags: data.tags }),
          ...(data.account_id !== undefined && { account_id: data.account_id ?? null }),
          ...(data.owner_id !== undefined && { owner_id: data.owner_id ?? null }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmContact.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });
      return ctx.prisma.crmContact.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  bulkUpdate: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
        data: z.object({
          owner_id: z.string().optional(),
          lifecycle_stage: z.enum(['lead', 'subscriber', 'opportunity', 'customer', 'evangelist']).optional(),
          tags: z.array(z.string()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmContact.updateMany({
        where: { id: { in: input.ids }, organization_id: orgId, deleted_at: null },
        data: {
          ...(input.data.owner_id !== undefined && { owner_id: input.data.owner_id }),
          ...(input.data.lifecycle_stage !== undefined && { lifecycle_stage: input.data.lifecycle_stage }),
          ...(input.data.tags !== undefined && { tags: input.data.tags }),
        },
      });
    }),

  getTimeline: protectedProcedure
    .input(
      z.object({
        contactId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const contact = await ctx.prisma.crmContact.findFirst({
        where: { id: input.contactId, organization_id: orgId },
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });

      const [activities, notes, emails] = await Promise.all([
        ctx.prisma.crmActivity.findMany({
          where: { entity_type: 'contact', entity_id: input.contactId, organization_id: orgId },
          orderBy: { created_at: 'desc' },
          take: input.limit,
        }),
        ctx.prisma.crmNote.findMany({
          where: { entity_type: 'contact', entity_id: input.contactId, organization_id: orgId, deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: input.limit,
        }),
        ctx.prisma.crmEmailLog.findMany({
          where: { entity_type: 'contact', entity_id: input.contactId, organization_id: orgId },
          orderBy: { sent_at: 'desc' },
          take: input.limit,
        }),
      ]);

      return [
        ...activities.map((a) => ({ type: 'activity' as const, date: a.created_at, data: a })),
        ...notes.map((n) => ({ type: 'note' as const, date: n.created_at, data: n })),
        ...emails.map((e) => ({ type: 'email' as const, date: e.sent_at, data: e })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime());
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ contactId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const contact = await ctx.prisma.crmContact.findFirst({
        where: { id: input.contactId, organization_id: orgId, deleted_at: null },
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });

      await ctx.prisma.$transaction([
        ctx.prisma.crmContact.update({
          where: { id: input.contactId },
          data: { unsubscribed: true, unsubscribed_at: new Date() },
        }),
        ctx.prisma.crmSequenceEnrollment.updateMany({
          where: { contact_id: input.contactId, status: 'active' },
          data: { status: 'exited', exited_at: new Date(), exit_reason: 'unsubscribed' },
        }),
      ]);

      return { success: true };
    }),
});
