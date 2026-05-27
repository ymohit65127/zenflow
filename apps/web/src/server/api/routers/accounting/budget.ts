// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const budgetRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        financial_year: z.number().optional(),
        status: z.enum(['draft', 'active', 'archived']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.accBudget.findMany({
        where: {
          org_id: orgId,
          ...(input.financial_year ? { financial_year: input.financial_year } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: { _count: { select: { lines: true } } },
        orderBy: { financial_year: 'desc' },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const budget = await ctx.prisma.accBudget.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, account_type: true } },
            },
          },
        },
      });
      if (!budget) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      return budget;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        financial_year: z.number().int(),
        lines: z
          .array(
            z.object({
              account_id: z.string(),
              period_allocations: z.record(z.number()),
              total: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.accBudget.create({
        data: {
          org_id: orgId,
          name: input.name,
          financial_year: input.financial_year,
          status: 'draft',
          created_by: ctx.session.user.id,
          ...(input.lines
            ? {
                lines: {
                  create: input.lines.map((l) => ({
                    account_id: l.account_id,
                    period_allocations: l.period_allocations,
                    total: l.total,
                  })),
                },
              }
            : {}),
        },
        include: { lines: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        status: z.enum(['draft', 'active', 'archived']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;
      const budget = await ctx.prisma.accBudget.findFirst({ where: { id, org_id: orgId } });
      if (!budget) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      return ctx.prisma.accBudget.update({ where: { id }, data });
    }),

  upsertLine: protectedProcedure
    .input(
      z.object({
        budget_id: z.string(),
        account_id: z.string(),
        period_allocations: z.record(z.number()),
        total: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const budget = await ctx.prisma.accBudget.findFirst({
        where: { id: input.budget_id, org_id: orgId },
      });
      if (!budget) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      return ctx.prisma.accBudgetLine.upsert({
        where: { budget_id_account_id: { budget_id: input.budget_id, account_id: input.account_id } },
        create: {
          budget_id: input.budget_id,
          account_id: input.account_id,
          period_allocations: input.period_allocations,
          total: input.total,
        },
        update: {
          period_allocations: input.period_allocations,
          total: input.total,
        },
      });
    }),

  variance: protectedProcedure
    .input(
      z.object({
        budget_id: z.string(),
        period_month: z.number().int().min(1).max(12).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const budget = await ctx.prisma.accBudget.findFirst({
        where: { id: input.budget_id, org_id: orgId },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, account_type: true } },
            },
          },
        },
      });
      if (!budget) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });

      const fromDate = new Date(budget.financial_year, 0, 1);
      const toDate = new Date(budget.financial_year, 11, 31);

      // Get actuals from journal entries
      const actuals = await ctx.prisma.$queryRaw<
        Array<{ account_id: string; total: number }>
      >`
        SELECT jel.account_id,
          SUM(CASE WHEN coa.normal_balance = 'debit'
            THEN jel.debit_amount - jel.credit_amount
            ELSE jel.credit_amount - jel.debit_amount
          END) as total
        FROM acc_journal_entry_lines jel
        JOIN acc_journal_entries je ON je.id = jel.journal_entry_id
        JOIN acc_chart_of_accounts coa ON coa.id = jel.account_id
        WHERE je.org_id = ${orgId}
          AND je.status = 'posted'
          AND je.entry_date >= ${fromDate}
          AND je.entry_date <= ${toDate}
        GROUP BY jel.account_id
      `;

      const actualsMap = new Map(actuals.map((a) => [a.account_id, Number(a.total)]));

      const month = input.period_month?.toString() ?? null;
      const lines = budget.lines.map((line) => {
        const allocations = line.period_allocations as Record<string, number>;
        const budgetAmount = month
          ? (allocations[month] ?? 0)
          : Object.values(allocations).reduce((s, v) => s + v, 0);
        const actual = actualsMap.get(line.account_id) ?? 0;
        return {
          account: line.account,
          budget_amount: budgetAmount,
          actual_amount: actual,
          variance: actual - budgetAmount,
          variance_pct: budgetAmount !== 0 ? ((actual - budgetAmount) / budgetAmount) * 100 : null,
        };
      });

      return { budget, lines };
    }),
});
