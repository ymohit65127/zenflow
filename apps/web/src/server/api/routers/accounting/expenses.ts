// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateExpenseNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.accExpense.count({
    where: { org_id: orgId, expense_number: { startsWith: `EXP-${year}-` } },
  });
  return `EXP-${year}-${String(count + 1).padStart(4, '0')}`;
}

export const accExpensesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        status: z
          .enum(['draft', 'submitted', 'approved', 'rejected', 'reimbursed'])
          .optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        vendor_id: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const [items, total] = await Promise.all([
        ctx.prisma.accExpense.findMany({
          where: {
            org_id: orgId,
            ...(input.status ? { approval_status: input.status } : {}),
            ...(input.vendor_id ? { vendor_id: input.vendor_id } : {}),
            ...(input.from_date || input.to_date
              ? {
                  expense_date: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
            ...(input.search
              ? {
                  OR: [
                    { expense_number: { contains: input.search, mode: 'insensitive' } },
                    { description: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            vendor: { select: { id: true, name: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { expense_date: 'desc' },
        }),
        ctx.prisma.accExpense.count({
          where: {
            org_id: orgId,
            ...(input.status ? { approval_status: input.status } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const expense = await ctx.prisma.accExpense.findFirst({
        where: { id: input.id, org_id: orgId },
        include: { vendor: true },
      });
      if (!expense) throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      return expense;
    }),

  create: protectedProcedure
    .input(
      z.object({
        expense_account_id: z.string(),
        expense_date: z.string(),
        description: z.string().optional(),
        amount: z.number().positive(),
        currency: z.string().optional(),
        vendor_id: z.string().optional(),
        receipt_url: z.string().optional(),
        tax_id: z.string().optional(),
        tax_amount: z.number().optional(),
        billable: z.boolean().optional(),
        project_id: z.string().optional(),
        payment_method: z
          .enum(['company_card', 'personal', 'petty_cash', 'other'])
          .optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const expense_number = await generateExpenseNumber(ctx.prisma, orgId);
      return ctx.prisma.accExpense.create({
        data: {
          org_id: orgId,
          expense_number,
          expense_account_id: input.expense_account_id,
          expense_date: new Date(input.expense_date),
          description: input.description ?? null,
          amount: input.amount,
          currency: input.currency ?? null,
          vendor_id: input.vendor_id ?? null,
          receipt_url: input.receipt_url ?? null,
          tax_id: input.tax_id ?? null,
          tax_amount: input.tax_amount ?? 0,
          billable: input.billable ?? false,
          project_id: input.project_id ?? null,
          payment_method: input.payment_method ?? null,
          approval_status: 'draft',
          created_by: ctx.session.user.id,
        },
      });
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const expense = await ctx.prisma.accExpense.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!expense) throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      if (expense.approval_status !== 'draft')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft expenses can be submitted' });
      return ctx.prisma.accExpense.update({
        where: { id: input.id },
        data: { approval_status: 'submitted' },
      });
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const expense = await ctx.prisma.accExpense.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!expense) throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      return ctx.prisma.accExpense.update({
        where: { id: input.id },
        data: {
          approval_status: 'approved',
          approved_by: ctx.session.user.id,
          approved_at: new Date(),
        },
      });
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const expense = await ctx.prisma.accExpense.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!expense) throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      return ctx.prisma.accExpense.update({
        where: { id: input.id },
        data: { approval_status: 'rejected', rejected_reason: input.reason },
      });
    }),

  reimburse: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const expense = await ctx.prisma.accExpense.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!expense) throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      if (expense.approval_status !== 'approved')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only approved expenses can be reimbursed' });
      return ctx.prisma.accExpense.update({
        where: { id: input.id },
        data: { approval_status: 'reimbursed', reimbursed_at: new Date() },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalAgg, pending, approved, reimbursed] = await Promise.all([
      ctx.prisma.accExpense.aggregate({
        where: { org_id: orgId, expense_date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      ctx.prisma.accExpense.count({ where: { org_id: orgId, approval_status: 'submitted' } }),
      ctx.prisma.accExpense.count({ where: { org_id: orgId, approval_status: 'approved' } }),
      ctx.prisma.accExpense.count({ where: { org_id: orgId, approval_status: 'reimbursed' } }),
    ]);
    return {
      totalThisMonth: Number(totalAgg._sum.amount ?? 0),
      pending,
      approved,
      reimbursed,
    };
  }),
});
