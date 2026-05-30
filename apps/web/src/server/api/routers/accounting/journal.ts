// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { logAudit } from '@/lib/audit';

async function generateEntryNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]['ctx']['prisma'],
  orgId: string,
  prefix = 'JE'
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.accJournalEntry.count({
    where: { org_id: orgId, entry_number: { startsWith: `${prefix}-${year}-` } },
  });
  const seq = String(count + 1).padStart(5, '0');
  return `${prefix}-${year}-${seq}`;
}

const journalLineInput = z.object({
  account_id: z.string(),
  description: z.string().optional(),
  debit_amount: z.number().min(0).default(0),
  credit_amount: z.number().min(0).default(0),
  currency: z.string().optional(),
  exchange_rate: z.number().optional(),
  cost_center_id: z.string().optional(),
  project_id: z.string().optional(),
  tax_id: z.string().optional(),
  tax_amount: z.number().optional(),
});

export const journalRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        status: z.enum(['draft', 'posted', 'reversed', 'void']).optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const [items, total] = await Promise.all([
        ctx.prisma.accJournalEntry.findMany({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.from_date || input.to_date
              ? {
                  entry_date: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
            ...(input.search
              ? {
                  OR: [
                    { entry_number: { contains: input.search, mode: 'insensitive' } },
                    { description: { contains: input.search, mode: 'insensitive' } },
                    { reference: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: { lines: { select: { debit_amount: true, credit_amount: true } } },
          take: input.limit,
          skip: input.offset,
          orderBy: { entry_date: 'desc' },
        }),
        ctx.prisma.accJournalEntry.count({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const entry = await ctx.prisma.accJournalEntry.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, account_type: true } },
            },
            orderBy: { line_order: 'asc' },
          },
        },
      });
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
      return entry;
    }),

  create: protectedProcedure
    .input(
      z.object({
        entry_date: z.string(),
        description: z.string(),
        reference: z.string().optional(),
        currency: z.string().optional(),
        exchange_rate: z.number().optional(),
        lines: z.array(journalLineInput).min(2, 'At least 2 lines required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const entry_number = await generateEntryNumber(ctx.prisma, orgId);
      const entryDate = new Date(input.entry_date);
      return ctx.prisma.accJournalEntry.create({
        data: {
          org_id: orgId,
          entry_number,
          entry_date: entryDate,
          description: input.description,
          reference: input.reference ?? null,
          currency: input.currency ?? null,
          exchange_rate: input.exchange_rate ?? 1,
          source_type: 'manual',
          created_by: ctx.session.user.id,
          financial_year: entryDate.getFullYear(),
          financial_period: entryDate.getMonth() + 1,
          lines: {
            create: input.lines.map((l, i) => ({
              account_id: l.account_id,
              description: l.description ?? null,
              debit_amount: l.debit_amount,
              credit_amount: l.credit_amount,
              currency: l.currency ?? null,
              exchange_rate: l.exchange_rate ?? 1,
              cost_center_id: l.cost_center_id ?? null,
              project_id: l.project_id ?? null,
              tax_id: l.tax_id ?? null,
              tax_amount: l.tax_amount ?? 0,
              line_order: i,
            })),
          },
        },
        include: { lines: true },
      });
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const posted = await ctx.prisma.$transaction(async (tx) => {
        const entry = await tx.accJournalEntry.findFirst({
          where: { id: input.id, org_id: orgId },
          include: {
            lines: {
              include: { account: { select: { id: true, normal_balance: true } } },
            },
          },
        });
        if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
        if (entry.status !== 'draft')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft entries can be posted' });

        // Validate balance
        const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit_amount), 0);
        const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit_amount), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.001) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Journal entry must balance: debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})`,
          });
        }

        // Update account balances
        for (const line of entry.lines) {
          const exchangeRate = Number(line.exchange_rate ?? 1);
          const baseDebit = Number(line.debit_amount) * exchangeRate;
          const baseCredit = Number(line.credit_amount) * exchangeRate;
          const balanceDelta =
            line.account.normal_balance === 'debit'
              ? baseDebit - baseCredit
              : baseCredit - baseDebit;

          await tx.accChartOfAccount.update({
            where: { id: line.account.id },
            data: { current_balance: { increment: balanceDelta } },
          });

          await tx.accJournalEntryLine.update({
            where: { id: line.id },
            data: { base_debit: baseDebit, base_credit: baseCredit },
          });
        }

        return tx.accJournalEntry.update({
          where: { id: input.id },
          data: {
            status: 'posted',
            posted_at: new Date(),
            posted_by: ctx.session.user.id,
            total_debit: totalDebit,
            total_credit: totalCredit,
          },
          include: { lines: true },
        });
      });
      void logAudit(ctx.prisma, {
        orgId,
        userId: ctx.session.user.id as string,
        action: 'JOURNAL_POSTED',
        resourceType: 'journal_entry',
        resourceId: posted.id as string,
      });
      return posted;
    }),

  reverse: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reversal_date: z.string(),
        description: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const original = await ctx.prisma.accJournalEntry.findFirst({
        where: { id: input.id, org_id: orgId },
        include: { lines: true },
      });
      if (!original) throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
      if (original.status !== 'posted')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only posted entries can be reversed' });

      const reversalNumber = await generateEntryNumber(ctx.prisma, orgId);
      const reversalDate = new Date(input.reversal_date);

      const reversal = await ctx.prisma.accJournalEntry.create({
        data: {
          org_id: orgId,
          entry_number: reversalNumber,
          entry_date: reversalDate,
          description: `Reversal of ${original.entry_number}: ${input.description}`,
          source_type: 'adjustment',
          currency: original.currency ?? null,
          exchange_rate: original.exchange_rate ?? 1,
          financial_year: reversalDate.getFullYear(),
          financial_period: reversalDate.getMonth() + 1,
          reversed_entry_id: original.id,
          reversal_date: reversalDate,
          created_by: ctx.session.user.id,
          lines: {
            create: original.lines.map((line, i) => ({
              account_id: line.account_id,
              description: line.description ?? null,
              debit_amount: line.credit_amount,
              credit_amount: line.debit_amount,
              currency: line.currency ?? null,
              exchange_rate: line.exchange_rate ?? 1,
              cost_center_id: line.cost_center_id ?? null,
              project_id: line.project_id ?? null,
              line_order: i,
            })),
          },
        },
      });

      // Post the reversal (re-use post logic inline)
      await ctx.prisma.$transaction(async (tx) => {
        const rev = await tx.accJournalEntry.findUnique({
          where: { id: reversal.id },
          include: {
            lines: {
              include: { account: { select: { id: true, normal_balance: true } } },
            },
          },
        });
        if (!rev) return;
        const totalDebit = rev.lines.reduce((s, l) => s + Number(l.debit_amount), 0);
        const totalCredit = rev.lines.reduce((s, l) => s + Number(l.credit_amount), 0);
        for (const line of rev.lines) {
          const exchangeRate = Number(line.exchange_rate ?? 1);
          const baseDebit = Number(line.debit_amount) * exchangeRate;
          const baseCredit = Number(line.credit_amount) * exchangeRate;
          const balanceDelta =
            line.account.normal_balance === 'debit'
              ? baseDebit - baseCredit
              : baseCredit - baseDebit;
          await tx.accChartOfAccount.update({
            where: { id: line.account.id },
            data: { current_balance: { increment: balanceDelta } },
          });
        }
        await tx.accJournalEntry.update({
          where: { id: reversal.id },
          data: {
            status: 'posted',
            posted_at: new Date(),
            posted_by: ctx.session.user.id,
            total_debit: totalDebit,
            total_credit: totalCredit,
          },
        });
        await tx.accJournalEntry.update({
          where: { id: original.id },
          data: { status: 'reversed' },
        });
      });

      return reversal;
    }),

  void: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const entry = await ctx.prisma.accJournalEntry.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
      if (entry.status !== 'draft')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft entries can be voided' });
      return ctx.prisma.accJournalEntry.update({
        where: { id: input.id },
        data: { status: 'void' },
      });
    }),
});
