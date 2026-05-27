// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const reportsRouter = createTRPCRouter({
  profitAndLoss: protectedProcedure
    .input(
      z.object({
        from_date: z.string(),
        to_date: z.string(),
        cost_center_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const lines = await ctx.prisma.$queryRaw<
        Array<{
          account_id: string;
          account_type: string;
          code: string;
          name: string;
          total: number;
        }>
      >`
        SELECT
          coa.id as account_id,
          coa.account_type,
          coa.code,
          coa.name,
          SUM(
            CASE WHEN coa.normal_balance = 'credit'
              THEN COALESCE(jel.base_credit, jel.credit_amount) - COALESCE(jel.base_debit, jel.debit_amount)
              ELSE COALESCE(jel.base_debit, jel.debit_amount) - COALESCE(jel.base_credit, jel.credit_amount)
            END
          ) as total
        FROM acc_journal_entry_lines jel
        JOIN acc_journal_entries je ON je.id = jel.journal_entry_id
        JOIN acc_chart_of_accounts coa ON coa.id = jel.account_id
        WHERE je.org_id = ${orgId}
          AND je.status = 'posted'
          AND je.entry_date >= ${new Date(input.from_date)}
          AND je.entry_date <= ${new Date(input.to_date)}
          AND coa.account_type IN ('revenue', 'expense', 'contra_asset')
        GROUP BY coa.id, coa.account_type, coa.code, coa.name
        ORDER BY coa.code
      `;

      const revenue = lines.filter((l) => l.account_type === 'revenue');
      const expenses = lines.filter((l) => l.account_type === 'expense' || l.account_type === 'contra_asset');
      const totalRevenue = revenue.reduce((s, l) => s + Number(l.total), 0);
      const totalExpenses = expenses.reduce((s, l) => s + Number(l.total), 0);
      const netProfit = totalRevenue - totalExpenses;
      const grossMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        from_date: input.from_date,
        to_date: input.to_date,
        revenue,
        expenses,
        totalRevenue,
        totalExpenses,
        netProfit,
        grossMarginPct: Math.round(grossMarginPct * 100) / 100,
      };
    }),

  balanceSheet: protectedProcedure
    .input(z.object({ as_of_date: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const accounts = await ctx.prisma.accChartOfAccount.findMany({
        where: {
          org_id: orgId,
          account_type: {
            in: ['asset', 'liability', 'equity', 'contra_asset', 'contra_liability'],
          },
          is_active: true,
          deleted_at: null,
        },
        orderBy: { code: 'asc' },
      });

      const assets = accounts.filter(
        (a) => a.account_type === 'asset' || a.account_type === 'contra_asset'
      );
      const liabilities = accounts.filter(
        (a) => a.account_type === 'liability' || a.account_type === 'contra_liability'
      );
      const equity = accounts.filter((a) => a.account_type === 'equity');

      const totalAssets = assets.reduce((s, a) => s + Number(a.current_balance), 0);
      const totalLiabilities = liabilities.reduce((s, a) => s + Number(a.current_balance), 0);
      const totalEquity = equity.reduce((s, a) => s + Number(a.current_balance), 0);

      return {
        as_of_date: input.as_of_date,
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities,
        totalEquity,
        balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      };
    }),

  trialBalance: protectedProcedure
    .input(z.object({ from_date: z.string(), to_date: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const lines = await ctx.prisma.$queryRaw<
        Array<{
          account_id: string;
          code: string;
          name: string;
          account_type: string;
          total_debit: number;
          total_credit: number;
        }>
      >`
        SELECT
          coa.id as account_id,
          coa.code,
          coa.name,
          coa.account_type,
          SUM(COALESCE(jel.debit_amount, 0)) as total_debit,
          SUM(COALESCE(jel.credit_amount, 0)) as total_credit
        FROM acc_journal_entry_lines jel
        JOIN acc_journal_entries je ON je.id = jel.journal_entry_id
        JOIN acc_chart_of_accounts coa ON coa.id = jel.account_id
        WHERE je.org_id = ${orgId}
          AND je.status = 'posted'
          AND je.entry_date >= ${new Date(input.from_date)}
          AND je.entry_date <= ${new Date(input.to_date)}
        GROUP BY coa.id, coa.code, coa.name, coa.account_type
        HAVING SUM(COALESCE(jel.debit_amount, 0)) > 0 OR SUM(COALESCE(jel.credit_amount, 0)) > 0
        ORDER BY coa.code
      `;

      const totalDebit = lines.reduce((s, l) => s + Number(l.total_debit), 0);
      const totalCredit = lines.reduce((s, l) => s + Number(l.total_credit), 0);

      return { lines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
    }),

  cashFlow: protectedProcedure
    .input(z.object({ from_date: z.string(), to_date: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      // Get cash account transactions
      const cashTxs = await ctx.prisma.$queryRaw<
        Array<{ source_type: string; debit: number; credit: number; entry_date: string }>
      >`
        SELECT
          je.source_type,
          SUM(COALESCE(jel.debit_amount, 0)) as debit,
          SUM(COALESCE(jel.credit_amount, 0)) as credit,
          je.entry_date::text as entry_date
        FROM acc_journal_entry_lines jel
        JOIN acc_journal_entries je ON je.id = jel.journal_entry_id
        JOIN acc_chart_of_accounts coa ON coa.id = jel.account_id
        WHERE je.org_id = ${orgId}
          AND je.status = 'posted'
          AND je.entry_date >= ${new Date(input.from_date)}
          AND je.entry_date <= ${new Date(input.to_date)}
          AND coa.account_type = 'asset'
          AND coa.code LIKE '1%'
        GROUP BY je.source_type, je.entry_date
        ORDER BY je.entry_date
      `;

      const operating = cashTxs
        .filter((t) => ['invoice', 'payment', 'expense', 'manual'].includes(t.source_type))
        .reduce((s, t) => s + Number(t.debit) - Number(t.credit), 0);
      const investing = cashTxs
        .filter((t) => t.source_type === 'depreciation')
        .reduce((s, t) => s + Number(t.debit) - Number(t.credit), 0);
      const financing = cashTxs
        .filter((t) => t.source_type === 'opening_balance')
        .reduce((s, t) => s + Number(t.debit) - Number(t.credit), 0);

      return {
        from_date: input.from_date,
        to_date: input.to_date,
        operating_activities: operating,
        investing_activities: investing,
        financing_activities: financing,
        net_change: operating + investing + financing,
        transactions: cashTxs,
      };
    }),

  agedReceivables: protectedProcedure
    .input(z.object({ as_of_date: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const asOf = new Date(input.as_of_date);
      const invoices = await ctx.prisma.accInvoice.findMany({
        where: {
          org_id: orgId,
          status: { in: ['sent', 'viewed', 'partially_paid', 'overdue'] },
          balance_due: { gt: 0 },
        },
        select: {
          id: true,
          invoice_number: true,
          contact_id: true,
          due_date: true,
          balance_due: true,
          grand_total: true,
          currency: true,
        },
      });

      const buckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_plus: 0 };
      const rows = invoices.map((inv) => {
        const days = inv.due_date
          ? Math.floor((asOf.getTime() - new Date(inv.due_date).getTime()) / 86400000)
          : 0;
        let bucket: keyof typeof buckets = 'current';
        if (days > 90) bucket = 'b91_plus';
        else if (days > 60) bucket = 'b61_90';
        else if (days > 30) bucket = 'b31_60';
        else if (days > 0) bucket = 'b1_30';
        buckets[bucket] += Number(inv.balance_due);
        return { ...inv, days_overdue: days, bucket };
      });

      return { rows, buckets, total: Object.values(buckets).reduce((s, v) => s + v, 0) };
    }),

  agedPayables: protectedProcedure
    .input(z.object({ as_of_date: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const asOf = new Date(input.as_of_date);
      const bills = await ctx.prisma.accBill.findMany({
        where: {
          org_id: orgId,
          status: { in: ['approved', 'partially_paid', 'overdue'] },
          balance_due: { gt: 0 },
        },
        select: {
          id: true,
          bill_number: true,
          vendor_id: true,
          due_date: true,
          balance_due: true,
          grand_total: true,
          currency: true,
          vendor: { select: { name: true } },
        },
      });

      const buckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_plus: 0 };
      const rows = bills.map((bill) => {
        const days = bill.due_date
          ? Math.floor((asOf.getTime() - new Date(bill.due_date).getTime()) / 86400000)
          : 0;
        let bucket: keyof typeof buckets = 'current';
        if (days > 90) bucket = 'b91_plus';
        else if (days > 60) bucket = 'b61_90';
        else if (days > 30) bucket = 'b31_60';
        else if (days > 0) bucket = 'b1_30';
        buckets[bucket] += Number(bill.balance_due);
        return { ...bill, days_overdue: days, bucket };
      });

      return { rows, buckets, total: Object.values(buckets).reduce((s, v) => s + v, 0) };
    }),

  gstSummary: protectedProcedure
    .input(z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0);

      // Outward supplies (sales invoices)
      const outward = await ctx.prisma.accInvoice.aggregate({
        where: {
          org_id: orgId,
          status: { in: ['sent', 'partially_paid', 'paid'] },
          invoice_date: { gte: startDate, lte: endDate },
        },
        _sum: { taxable_amount: true, tax_total: true, grand_total: true },
        _count: true,
      });

      // Inward supplies (vendor bills)
      const inward = await ctx.prisma.accBill.aggregate({
        where: {
          org_id: orgId,
          status: { in: ['approved', 'partially_paid', 'paid'] },
          bill_date: { gte: startDate, lte: endDate },
        },
        _sum: { subtotal: true, tax_total: true, grand_total: true },
        _count: true,
      });

      const taxLiability =
        Number(outward._sum.tax_total ?? 0) - Number(inward._sum.tax_total ?? 0);

      return {
        month: input.month,
        year: input.year,
        outward_supplies: {
          count: outward._count,
          taxable_amount: Number(outward._sum.taxable_amount ?? 0),
          tax_amount: Number(outward._sum.tax_total ?? 0),
          total: Number(outward._sum.grand_total ?? 0),
        },
        inward_supplies: {
          count: inward._count,
          taxable_amount: Number(inward._sum.subtotal ?? 0),
          tax_amount: Number(inward._sum.tax_total ?? 0),
          total: Number(inward._sum.grand_total ?? 0),
        },
        tax_liability: taxLiability,
        input_tax_credit: Number(inward._sum.tax_total ?? 0),
        net_tax_payable: Math.max(taxLiability, 0),
      };
    }),
});
