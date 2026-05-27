// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const coaRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ include_inactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.accChartOfAccount.findMany({
        where: {
          org_id: orgId,
          ...(input.include_inactive ? {} : { is_active: true }),
          deleted_at: null,
        },
        orderBy: [{ code: 'asc' }],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const account = await ctx.prisma.accChartOfAccount.findFirst({
        where: { id: input.id, org_id: orgId, deleted_at: null },
        include: {
          parent_account: { select: { id: true, code: true, name: true } },
          child_accounts: { select: { id: true, code: true, name: true, is_active: true } },
        },
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      return account;
    }),

  create: protectedProcedure
    .input(
      z.object({
        code: z.string().max(20),
        name: z.string().max(255),
        account_type: z.enum([
          'asset',
          'liability',
          'equity',
          'revenue',
          'expense',
          'contra_asset',
          'contra_liability',
        ]),
        account_sub_type: z.string().optional(),
        parent_account_id: z.string().optional(),
        normal_balance: z.enum(['debit', 'credit']),
        currency: z.string().length(3).optional(),
        description: z.string().optional(),
        opening_balance: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const exists = await ctx.prisma.accChartOfAccount.findUnique({
        where: { org_id_code: { org_id: orgId, code: input.code } },
      });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'Account code already exists' });

      let level = 1;
      if (input.parent_account_id) {
        const parent = await ctx.prisma.accChartOfAccount.findUnique({
          where: { id: input.parent_account_id },
          select: { level: true },
        });
        level = (parent?.level ?? 0) + 1;
      }

      return ctx.prisma.accChartOfAccount.create({
        data: {
          org_id: orgId,
          code: input.code,
          name: input.name,
          account_type: input.account_type,
          account_sub_type: input.account_sub_type ?? null,
          parent_account_id: input.parent_account_id ?? null,
          normal_balance: input.normal_balance,
          currency: input.currency ?? 'INR',
          description: input.description ?? null,
          opening_balance: input.opening_balance ?? 0,
          current_balance: input.opening_balance ?? 0,
          level,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
        account_sub_type: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;
      const account = await ctx.prisma.accChartOfAccount.findFirst({
        where: { id, org_id: orgId },
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      if (account.is_system)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'System accounts cannot be modified' });
      return ctx.prisma.accChartOfAccount.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const account = await ctx.prisma.accChartOfAccount.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      if (account.is_system)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'System accounts cannot be deleted' });
      return ctx.prisma.accChartOfAccount.update({
        where: { id: input.id },
        data: { deleted_at: new Date(), is_active: false },
      });
    }),

  ledger: protectedProcedure
    .input(
      z.object({
        account_id: z.string(),
        from_date: z.string(),
        to_date: z.string(),
        page: z.number().default(1),
        per_page: z.number().max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const lines = await ctx.prisma.accJournalEntryLine.findMany({
        where: {
          account_id: input.account_id,
          journal_entry: {
            org_id: orgId,
            status: 'posted',
            entry_date: {
              gte: new Date(input.from_date),
              lte: new Date(input.to_date),
            },
          },
        },
        include: {
          journal_entry: {
            select: {
              entry_number: true,
              entry_date: true,
              description: true,
              source_type: true,
            },
          },
        },
        orderBy: { journal_entry: { entry_date: 'asc' } },
        skip: (input.page - 1) * input.per_page,
        take: input.per_page,
      });
      return lines;
    }),
});
