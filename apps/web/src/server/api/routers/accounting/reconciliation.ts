import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const reconciliationRouter = createTRPCRouter({
  getSummary: protectedProcedure
    .input(z.object({ bank_account_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bankAccount = await ctx.prisma.accBankAccount.findFirst({
        where: { id: input.bank_account_id, org_id: orgId },
      });
      if (!bankAccount) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });

      const [unmatched, matched, total] = await Promise.all([
        ctx.prisma.accBankTransaction.count({
          where: { bank_account_id: input.bank_account_id, status: 'unmatched' },
        }),
        ctx.prisma.accBankTransaction.count({
          where: { bank_account_id: input.bank_account_id, status: 'matched' },
        }),
        ctx.prisma.accBankTransaction.count({
          where: { bank_account_id: input.bank_account_id },
        }),
      ]);

      return {
        bank_account: bankAccount,
        total_transactions: total,
        unmatched_count: unmatched,
        matched_count: matched,
        last_reconciled_date: bankAccount.last_reconciled_date,
      };
    }),

  getUnmatched: protectedProcedure
    .input(
      z.object({
        bank_account_id: z.string(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bankAccount = await ctx.prisma.accBankAccount.findFirst({
        where: { id: input.bank_account_id, org_id: orgId },
      });
      if (!bankAccount) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });

      // Unmatched bank transactions
      const bankTxs = await ctx.prisma.accBankTransaction.findMany({
        where: { bank_account_id: input.bank_account_id, status: 'unmatched' },
        orderBy: { transaction_date: 'desc' },
        take: input.limit,
        skip: input.offset,
      });

      // Unreconciled journal entry lines for this org
      const jelines = await ctx.prisma.accJournalEntryLine.findMany({
        where: {
          reconciled: false,
          journal_entry: { org_id: orgId, status: 'posted' },
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
          account: { select: { id: true, code: true, name: true } },
        },
        orderBy: { journal_entry: { entry_date: 'desc' } },
        take: 200,
      });

      return { bank_transactions: bankTxs, journal_lines: jelines };
    }),

  match: protectedProcedure
    .input(
      z.object({
        bank_transaction_id: z.string(),
        journal_entry_line_id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bankTx = await ctx.prisma.accBankTransaction.findFirst({
        where: { id: input.bank_transaction_id, bank_account: { org_id: orgId } },
      });
      if (!bankTx) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank transaction not found' });
      if (bankTx.status === 'matched')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Transaction already matched' });

      const jeline = await ctx.prisma.accJournalEntryLine.findFirst({
        where: { id: input.journal_entry_line_id, journal_entry: { org_id: orgId } },
      });
      if (!jeline) throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry line not found' });

      await ctx.prisma.$transaction([
        ctx.prisma.accBankTransaction.update({
          where: { id: input.bank_transaction_id },
          data: {
            status: 'matched',
            journal_entry_line_id: input.journal_entry_line_id,
          },
        }),
        ctx.prisma.accJournalEntryLine.update({
          where: { id: input.journal_entry_line_id },
          data: { reconciled: true, reconciled_at: new Date() },
        }),
      ]);

      return { success: true };
    }),

  unmatch: protectedProcedure
    .input(z.object({ bank_transaction_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bankTx = await ctx.prisma.accBankTransaction.findFirst({
        where: { id: input.bank_transaction_id, bank_account: { org_id: orgId } },
      });
      if (!bankTx) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank transaction not found' });

      if (bankTx.journal_entry_line_id) {
        await ctx.prisma.accJournalEntryLine.update({
          where: { id: bankTx.journal_entry_line_id },
          data: { reconciled: false, reconciled_at: null },
        });
      }

      return ctx.prisma.accBankTransaction.update({
        where: { id: input.bank_transaction_id },
        data: { status: 'unmatched', journal_entry_line_id: null },
      });
    }),

  ignore: protectedProcedure
    .input(z.object({ bank_transaction_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bankTx = await ctx.prisma.accBankTransaction.findFirst({
        where: { id: input.bank_transaction_id, bank_account: { org_id: orgId } },
      });
      if (!bankTx) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank transaction not found' });
      return ctx.prisma.accBankTransaction.update({
        where: { id: input.bank_transaction_id },
        data: { status: 'ignored' },
      });
    }),

  finalize: protectedProcedure
    .input(
      z.object({
        bank_account_id: z.string(),
        statement_date: z.string(),
        closing_balance: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bankAccount = await ctx.prisma.accBankAccount.findFirst({
        where: { id: input.bank_account_id, org_id: orgId },
      });
      if (!bankAccount) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });

      return ctx.prisma.accBankAccount.update({
        where: { id: input.bank_account_id },
        data: {
          last_reconciled_date: new Date(input.statement_date),
          current_balance: input.closing_balance,
        },
      });
    }),
});
