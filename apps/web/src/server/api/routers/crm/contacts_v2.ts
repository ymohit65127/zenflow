import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const ContactCreateSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  linkedin_url: z.string().url('Must be a valid URL').optional().nullable(),
  twitter_handle: z.string().optional().nullable(),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).default('ACTIVE'),
});

const ContactUpdateSchema = ContactCreateSchema.partial();

const ContactFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  source: z.string().optional(),
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
          field: z.enum(['first_name', 'created_at']).default('created_at'),
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
        ...(filters.status && { status: filters.status }),
        ...(filters.source && { source: filters.source }),
        ...(filters.tag && { tags: { has: filters.tag } }),
        ...(filters.search && {
          OR: [
            { first_name: { contains: filters.search, mode: 'insensitive' } },
            { last_name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { company: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
        ...(cursor && { id: { lt: cursor } }),
      };

      const contacts = await ctx.prisma.crmContact.findMany({
        where,
        take: limit + 1,
        orderBy: { [sort.field]: sort.dir },
        include: {
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
          deals: {
            where: { deleted_at: null },
            include: { stage: { select: { name: true, color: true } }, pipeline: { select: { name: true } } },
            take: 10,
          },
          activities: {
            orderBy: { created_at: 'desc' },
            take: 10,
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
          email: input.email ?? null,
          phone: input.phone ?? null,
          mobile: input.mobile ?? null,
          title: input.title ?? null,
          department: input.department ?? null,
          company: input.company ?? null,
          website: input.website ?? null,
          linkedin_url: input.linkedin_url ?? null,
          twitter_handle: input.twitter_handle ?? null,
          source: input.source ?? null,
          tags: input.tags,
          notes: input.notes ?? null,
          status: input.status,
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
          ...(data.email !== undefined && { email: data.email ?? null }),
          ...(data.phone !== undefined && { phone: data.phone ?? null }),
          ...(data.mobile !== undefined && { mobile: data.mobile ?? null }),
          ...(data.title !== undefined && { title: data.title ?? null }),
          ...(data.department !== undefined && { department: data.department ?? null }),
          ...(data.company !== undefined && { company: data.company ?? null }),
          ...(data.website !== undefined && { website: data.website ?? null }),
          ...(data.linkedin_url !== undefined && { linkedin_url: data.linkedin_url ?? null }),
          ...(data.twitter_handle !== undefined && { twitter_handle: data.twitter_handle ?? null }),
          ...(data.source !== undefined && { source: data.source ?? null }),
          ...(data.tags !== undefined && { tags: data.tags }),
          ...(data.notes !== undefined && { notes: data.notes ?? null }),
          ...(data.status !== undefined && { status: data.status }),
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
          status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
          tags: z.array(z.string()).optional(),
          source: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmContact.updateMany({
        where: { id: { in: input.ids }, organization_id: orgId, deleted_at: null },
        data: {
          ...(input.data.status !== undefined && { status: input.data.status }),
          ...(input.data.tags !== undefined && { tags: input.data.tags }),
          ...(input.data.source !== undefined && { source: input.data.source }),
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

      const [activities, emails] = await Promise.all([
        ctx.prisma.crmActivity.findMany({
          where: { contact_id: input.contactId, organization_id: orgId },
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
        ...emails.map((e) => ({ type: 'email' as const, date: e.sent_at, data: e })),
      ].sort((a, b) => (b.date ?? new Date(0)).getTime() - (a.date ?? new Date(0)).getTime());
    }),

  deactivate: protectedProcedure
    .input(z.object({ contactId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const contact = await ctx.prisma.crmContact.findFirst({
        where: { id: input.contactId, organization_id: orgId, deleted_at: null },
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contact not found' });

      await ctx.prisma.crmContact.update({
        where: { id: input.contactId },
        data: { status: 'INACTIVE' },
      });

      return { success: true };
    }),
});
