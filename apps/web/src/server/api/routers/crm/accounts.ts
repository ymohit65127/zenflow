// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const AccountCreateSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(['SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_201_1000', 'SIZE_1001_5000', 'SIZE_5001_PLUS']).optional(),
  annual_revenue: z.number().optional(),
  website: z.string().url('Must be a valid URL').optional().nullable(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  owner_id: z.string().optional(),
  parent_account_id: z.string().optional(),
  linkedin_url: z.string().url('Must be a valid URL').optional().nullable(),
  twitter_url: z.string().url('Must be a valid URL').optional().nullable(),
  tags: z.array(z.string()).default([]),
});

const AccountUpdateSchema = AccountCreateSchema.partial();

const AccountFilterSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  owner_id: z.string().optional(),
  size: z.enum(['SIZE_1_10', 'SIZE_11_50', 'SIZE_51_200', 'SIZE_201_1000', 'SIZE_1001_5000', 'SIZE_5001_PLUS']).optional(),
});

export const crmAccountsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
        filters: AccountFilterSchema.default({}),
        sort: z.object({
          field: z.enum(['name', 'created_at', 'lead_score', 'annual_revenue']).default('created_at'),
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
        ...(filters.industry && { industry: filters.industry }),
        ...(filters.owner_id && { owner_id: filters.owner_id }),
        ...(filters.size && { size: filters.size }),
        ...(filters.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { domain: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
        ...(cursor && { id: { lt: cursor } }),
      };

      const accounts = await ctx.prisma.crmAccount.findMany({
        where,
        take: limit + 1,
        orderBy: { [sort.field]: sort.dir },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { contacts: true, deals: true } },
        },
      });

      let nextCursor: string | undefined;
      if (accounts.length > limit) {
        const next = accounts.pop();
        nextCursor = next?.id;
      }

      return { accounts, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const account = await ctx.prisma.crmAccount.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
          parent_account: { select: { id: true, name: true } },
          child_accounts: { where: { deleted_at: null }, select: { id: true, name: true, domain: true } },
          contacts: {
            where: { deleted_at: null },
            select: { id: true, first_name: true, last_name: true, email: true, job_title: true, lifecycle_stage: true },
            take: 20,
          },
          deals: {
            where: { deleted_at: null },
            select: { id: true, name: true, amount: true, stage: { select: { name: true, color: true } } },
            take: 20,
          },
          notes: {
            where: { deleted_at: null },
            orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }],
            take: 10,
          },
        },
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      return account;
    }),

  create: protectedProcedure
    .input(AccountCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { annual_revenue, address, ...rest } = input;
      return ctx.prisma.crmAccount.create({
        data: {
          ...rest,
          organization_id: orgId,
          annual_revenue: annual_revenue ?? null,
          address: address ?? null,
          domain: rest.domain ?? null,
          industry: rest.industry ?? null,
          size: rest.size ?? null,
          website: rest.website ?? null,
          phone: rest.phone ?? null,
          description: rest.description ?? null,
          owner_id: rest.owner_id ?? null,
          parent_account_id: rest.parent_account_id ?? null,
          linkedin_url: rest.linkedin_url ?? null,
          twitter_url: rest.twitter_url ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: AccountUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmAccount.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });

      const { annual_revenue, address, ...rest } = input.data;
      return ctx.prisma.crmAccount.update({
        where: { id: input.id },
        data: {
          ...rest,
          ...(annual_revenue !== undefined && { annual_revenue: annual_revenue ?? null }),
          ...(address !== undefined && { address: address ?? null }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmAccount.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      return ctx.prisma.crmAccount.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmAccount.updateMany({
        where: { id: { in: input.ids }, organization_id: orgId },
        data: { deleted_at: new Date() },
      });
    }),

  merge: protectedProcedure
    .input(z.object({ primaryId: z.string(), duplicateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [primary, duplicate] = await Promise.all([
        ctx.prisma.crmAccount.findFirst({ where: { id: input.primaryId, organization_id: orgId } }),
        ctx.prisma.crmAccount.findFirst({ where: { id: input.duplicateId, organization_id: orgId } }),
      ]);
      if (!primary || !duplicate) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });

      await ctx.prisma.$transaction([
        ctx.prisma.crmContact.updateMany({
          where: { account_id: input.duplicateId },
          data: { account_id: input.primaryId },
        }),
        ctx.prisma.crmDeal.updateMany({
          where: { account_id: input.duplicateId },
          data: { account_id: input.primaryId },
        }),
        ctx.prisma.crmAccount.update({
          where: { id: input.duplicateId },
          data: { deleted_at: new Date() },
        }),
      ]);

      return { success: true };
    }),
});
