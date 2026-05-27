// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

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
        where: { project_id: input.projectId },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
        orderBy: { entry_date: 'desc' },
      });

      const totals = entries.reduce(
        (acc, e) => ({
          totalBudgeted: acc.totalBudgeted + Number(e.budgeted_amount),
          totalActual: acc.totalActual + Number(e.actual_amount),
        }),
        { totalBudgeted: 0, totalActual: 0 }
      );

      return {
        entries,
        totals: {
          ...totals,
          variance: totals.totalBudgeted - totals.totalActual,
          utilizationPct:
            totals.totalBudgeted > 0
              ? Math.round((totals.totalActual / totals.totalBudgeted) * 100)
              : 0,
        },
        projectBudget: Number(project.budget_amount ?? 0),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        category: z
          .enum(['labor', 'software', 'hardware', 'travel', 'other'])
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

      const entry = await ctx.prisma.projectBudgetEntry.create({
        data: {
          project_id: input.projectId,
          category: input.category,
          description: input.description,
          budgeted_amount: input.budgetedAmount,
          actual_amount: input.actualAmount,
          entry_date: input.entryDate,
          created_by: userId,
        },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
      });

      // Update project.actual_cost running sum
      await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { actual_cost: { increment: input.actualAmount } },
      });

      return entry;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        category: z
          .enum(['labor', 'software', 'hardware', 'travel', 'other'])
          .optional(),
        description: z.string().min(1).max(255).optional(),
        budgetedAmount: z.number().min(0).optional(),
        actualAmount: z.number().min(0).optional(),
        entryDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const entry = await ctx.prisma.projectBudgetEntry.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
      });
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget entry not found' });

      const { id, ...data } = input;

      const updated = await ctx.prisma.projectBudgetEntry.update({
        where: { id },
        data: {
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.budgetedAmount !== undefined ? { budgeted_amount: data.budgetedAmount } : {}),
          ...(data.actualAmount !== undefined ? { actual_amount: data.actualAmount } : {}),
          ...(data.entryDate !== undefined ? { entry_date: data.entryDate } : {}),
        },
      });

      // Recalculate project actual_cost
      if (data.actualAmount !== undefined) {
        const diff = data.actualAmount - Number(entry.actual_amount);
        await ctx.prisma.project.update({
          where: { id: entry.project_id },
          data: { actual_cost: { increment: diff } },
        });
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const entry = await ctx.prisma.projectBudgetEntry.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
      });
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget entry not found' });

      await ctx.prisma.projectBudgetEntry.delete({ where: { id: input.id } });

      // Adjust project.actual_cost
      await ctx.prisma.project.update({
        where: { id: entry.project_id },
        data: { actual_cost: { decrement: Number(entry.actual_amount) } },
      });

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
        where: { project_id: input.projectId },
        select: { category: true, budgeted_amount: true, actual_amount: true },
      });

      const byCategory = entries.reduce<
        Record<string, { budgeted: number; actual: number }>
      >((acc, e) => {
        if (!acc[e.category]) acc[e.category] = { budgeted: 0, actual: 0 };
        acc[e.category].budgeted += Number(e.budgeted_amount);
        acc[e.category].actual += Number(e.actual_amount);
        return acc;
      }, {});

      return Object.entries(byCategory).map(([category, totals]) => ({
        category,
        ...totals,
        variance: totals.budgeted - totals.actual,
      }));
    }),
});
