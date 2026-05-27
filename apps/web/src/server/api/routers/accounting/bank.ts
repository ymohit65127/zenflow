// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const bankRouter = createTRPCRouter({
  listAccounts: protectedProcedure
    .input(z.object({ include_inactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.accBankAccount.findMany({
        where: {
          org_id: orgId,
          ...(input.include_inactive ? {} : { is_active: true }),
        },
        include: {
          gl_account: { select: { id: true, code: true, name: true } },
          _count: { select: { transactions: true } },
        },
        orderBy: { name: 'asc' },
      });
    }),

  getAccount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const account = await ctx.prisma.accBankAccount.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          gl_account: { select: { id: true, code: true, name: true } },
        },
      });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });
      return account;
    }),

  createAccount: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        account_number: z.string().optional(),
        bank_name: z.string().optional(),
        bank_branch: z.string().optional(),
        ifsc_code: z.string().optional(),
        account_type: z
          .enum(['savings', 'current', 'overdraft', 'fixed_deposit', 'credit_card'])
          .default('current'),
        currency: z.string().default('INR'),
        opening_balance: z.number().default(0),
        gl_account_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.accBankAccount.create({
        data: {
          org_id: orgId,
          name: input.name,
          account_number: input.account_number ?? null,
          bank_name: input.bank_name ?? null,
          bank_branch: input.bank_branch ?? null,
          ifsc_code: input.ifsc_code ?? null,
          account_type: input.account_type,
          currency: input.currency,
          opening_balance: input.opening_balance,
          current_balance: input.opening_balance,
          gl_account_id: input.gl_account_id ?? null,
        },
      });
    }),

  updateAccount: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        account_number: z.string().optional(),
        bank_name: z.string().optional(),
        bank_branch: z.string().optional(),
        ifsc_code: z.string().optional(),
        gl_account_id: z.string().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;
      const account = await ctx.prisma.accBankAccount.findFirst({ where: { id, org_id: orgId } });
      if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });
      return ctx.prisma.accBankAccount.update({ where: { id }, data });
    }),

  listTransactions: protectedProcedure
    .input(
      z.object({
        bank_account_id: z.string(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        status: z.enum(['unmatched', 'matched', 'ignored', 'excluded']).optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        type: z.enum(['debit', 'credit']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      // Verify the bank account belongs to this org
      const bankAccount = await ctx.prisma.accBankAccount.findFirst({
        where: { id: input.bank_account_id, org_id: orgId },
      });
      if (!bankAccount) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });

      const [items, total] = await Promise.all([
        ctx.prisma.accBankTransaction.findMany({
          where: {
            bank_account_id: input.bank_account_id,
            ...(input.status ? { status: input.status } : {}),
            ...(input.type ? { type: input.type } : {}),
            ...(input.from_date || input.to_date
              ? {
                  transaction_date: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
          },
          orderBy: { transaction_date: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.accBankTransaction.count({
          where: {
            bank_account_id: input.bank_account_id,
            ...(input.status ? { status: input.status } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  importTransactions: protectedProcedure
    .input(
      z.object({
        bank_account_id: z.string(),
        transactions: z.array(
          z.object({
            transaction_date: z.string(),
            value_date: z.string().optional(),
            description: z.string().optional(),
            reference: z.string().optional(),
            amount: z.number(),
            type: z.enum(['debit', 'credit']),
            running_balance: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bankAccount = await ctx.prisma.accBankAccount.findFirst({
        where: { id: input.bank_account_id, org_id: orgId },
      });
      if (!bankAccount) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });

      const importBatchId = `batch-${Date.now()}`;
      const created = await ctx.prisma.accBankTransaction.createMany({
        data: input.transactions.map((t) => ({
          bank_account_id: input.bank_account_id,
          transaction_date: new Date(t.transaction_date),
          value_date: t.value_date ? new Date(t.value_date) : null,
          description: t.description ?? null,
          reference: t.reference ?? null,
          amount: t.amount,
          type: t.type,
          running_balance: t.running_balance ?? null,
          status: 'unmatched',
          import_batch_id: importBatchId,
        })),
        skipDuplicates: true,
      });

      // Update bank account balance
      const lastTx = input.transactions.at(-1);
      if (lastTx?.running_balance !== undefined) {
        await ctx.prisma.accBankAccount.update({
          where: { id: input.bank_account_id },
          data: { current_balance: lastTx.running_balance },
        });
      }

      return { imported: created.count, import_batch_id: importBatchId };
    }),
});
