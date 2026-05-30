import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ProjectBudgetEntry schema: amount (Decimal), is_expense (Boolean), category, description, entry_date
// We use amount for both budgeted (is_expense=false) and actual (is_expense=true)

export const budgetRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const entries = await ctx.prisma.projectBudgetEntry.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        orderBy: { entry_date: 'desc' },
      });

      const totalBudgeted = entries
        .filter((e) => !e.is_expense)
        .reduce((acc, e) => acc + Number(e.amount), 0);
      const totalActual = entries
        .filter((e) => e.is_expense)
        .reduce((acc, e) => acc + Number(e.amount), 0);

      return {
        entries,
        totals: {
          totalBudgeted,
          totalActual,
          variance: totalBudgeted - totalActual,
          utilizationPct:
            totalBudgeted > 0
              ? Math.round((totalActual / totalBudgeted) * 100)
              : 0,
        },
        projectBudget: 0,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        category: z
          .enum(['labor', 'materials', 'travel', 'tools', 'other'])
          .default('other'),
        description: z.string().min(1).max(255),
        budgetedAmount: z.number().min(0),
        actualAmount: z.number().min(0).default(0),
        entryDate: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Create two entries: one for budgeted (is_expense=false) and one for actual (is_expense=true)
      const budgetedEntry = await ctx.prisma.projectBudgetEntry.create({
        data: {
          project_id: input.projectId,
          organization_id: orgId,
          category: input.category,
          description: input.description,
          amount: input.budgetedAmount,
          is_expense: false,
          entry_date: input.entryDate,
          created_by: userId,
        },
      });

      if (input.actualAmount > 0) {
        await ctx.prisma.projectBudgetEntry.create({
          data: {
            project_id: input.projectId,
            organization_id: orgId,
            category: input.category,
            description: input.description + ' (actual)',
            amount: input.actualAmount,
            is_expense: true,
            entry_date: input.entryDate,
            created_by: userId,
          },
        });
      }

      return budgetedEntry;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        category: z
          .enum(['labor', 'materials', 'travel', 'tools', 'other'])
          .optional(),
        description: z.string().min(1).max(255).optional(),
        amount: z.number().min(0).optional(),
        entryDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const entry = await ctx.prisma.projectBudgetEntry.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget entry not found' });

      const { id, ...data } = input;

      return ctx.prisma.projectBudgetEntry.update({
        where: { id },
        data: {
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.entryDate !== undefined ? { entry_date: data.entryDate } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const entry = await ctx.prisma.projectBudgetEntry.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget entry not found' });

      await ctx.prisma.projectBudgetEntry.delete({ where: { id: input.id } });

      return { success: true };
    }),

  getCategoryTotals: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const entries = await ctx.prisma.projectBudgetEntry.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        select: { category: true, amount: true, is_expense: true },
      });

      const byCategory = entries.reduce<
        Record<string, { budgeted: number; actual: number }>
      >((acc, e) => {
        const cat = e.category;
        if (!acc[cat]) acc[cat] = { budgeted: 0, actual: 0 };
        if (e.is_expense) {
          acc[cat].actual += Number(e.amount);
        } else {
          acc[cat].budgeted += Number(e.amount);
        }
        return acc;
      }, {});

      return Object.entries(byCategory).map(([category, totals]) => ({
        category,
        ...totals,
        variance: totals.budgeted - totals.actual,
      }));
    }),
});
