import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { HrReviewCycleStatus } from '@prisma/client';

export const performanceRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------------------
  listGoals: protectedProcedure
    .input(
      z.object({
        owner_id: z.string().optional(),
        period: z.enum(['quarterly', 'half_yearly', 'annual', 'custom']).optional(),
        status: z.enum(['draft', 'active', 'at_risk', 'completed', 'cancelled']).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrGoal.findMany({
        where: {
          org_id: orgId,
          parent_goal_id: null,
          ...(input?.owner_id ? { owner_id: input.owner_id } : {}),
          ...(input?.period ? { period: input.period } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          owner: { select: { id: true, first_name: true, last_name: true } },
          key_results: {
            include: { owner: { select: { id: true, first_name: true, last_name: true } } },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  getGoal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const goal = await ctx.prisma.hrGoal.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          owner: { select: { id: true, first_name: true, last_name: true } },
          key_results: {
            include: { owner: { select: { id: true, first_name: true, last_name: true } } },
          },
          parent_goal: { select: { id: true, title: true } },
        },
      });
      if (!goal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Goal not found' });
      return goal;
    }),

  createGoal: protectedProcedure
    .input(
      z.object({
        owner_id: z.string(),
        parent_goal_id: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        goal_type: z.enum(['company', 'team', 'individual']),
        period: z.enum(['quarterly', 'half_yearly', 'annual', 'custom']),
        start_date: z.string(),
        end_date: z.string(),
        metric_type: z.enum(['percent', 'number', 'currency', 'boolean']),
        metric_target: z.number(),
        metric_unit: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;
      return ctx.prisma.hrGoal.create({
        data: {
          org_id: orgId,
          owner_id: input.owner_id,
          parent_goal_id: input.parent_goal_id ?? null,
          title: input.title,
          description: input.description ?? null,
          goal_type: input.goal_type,
          period: input.period,
          start_date: new Date(input.start_date),
          end_date: new Date(input.end_date),
          metric_type: input.metric_type,
          metric_target: input.metric_target,
          metric_unit: input.metric_unit ?? null,
          created_by: userId,
          status: 'draft',
        },
      });
    }),

  updateGoalProgress: protectedProcedure
    .input(z.object({ id: z.string(), metric_current: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const goal = await ctx.prisma.hrGoal.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!goal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Goal not found' });

      const progress = Math.min(100, (input.metric_current / Number(goal.metric_target)) * 100);
      return ctx.prisma.hrGoal.update({
        where: { id: input.id },
        data: {
          metric_current: input.metric_current,
          progress,
          status: progress >= 100 ? 'completed' : progress < 50 ? 'at_risk' : 'active',
        },
      });
    }),

  updateGoalStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['draft', 'active', 'at_risk', 'completed', 'cancelled']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const goal = await ctx.prisma.hrGoal.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!goal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Goal not found' });
      return ctx.prisma.hrGoal.update({ where: { id: input.id }, data: { status: input.status } });
    }),

  // ---------------------------------------------------------------------------
  // Review Cycles
  // ---------------------------------------------------------------------------
  listCycles: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrPerformanceReviewCycle.findMany({
      where: { organization_id: orgId },
      include: {
        _count: { select: { reviews: true } },
        criteria: { orderBy: { position: 'asc' } },
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  getCycle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const cycle = await ctx.prisma.hrPerformanceReviewCycle.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          criteria: { orderBy: { position: 'asc' } },
          _count: { select: { reviews: true } },
        },
      });
      if (!cycle) throw new TRPCError({ code: 'NOT_FOUND', message: 'Review cycle not found' });
      return cycle;
    }),

  createCycle: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        review_type: z.enum(['annual', 'semi_annual', 'quarterly', 'probation', 'three_sixty']),
        self_review_start: z.string(),
        self_review_end: z.string(),
        manager_review_start: z.string(),
        manager_review_end: z.string(),
        calibration_date: z.string().optional(),
        share_date: z.string().optional(),
        criteria: z
          .array(
            z.object({
              name: z.string(),
              description: z.string().optional(),
              weight: z.number(),
              max_score: z.number().default(5),
              position: z.number().int().default(0),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;
      return ctx.prisma.hrPerformanceReviewCycle.create({
        data: {
          organization_id: orgId,
          name: input.name,
          review_type: input.review_type,
          self_review_start: new Date(input.self_review_start),
          self_review_end: new Date(input.self_review_end),
          manager_review_start: new Date(input.manager_review_start),
          manager_review_end: new Date(input.manager_review_end),
          calibration_date: input.calibration_date ? new Date(input.calibration_date) : null,
          share_date: input.share_date ? new Date(input.share_date) : null,
          created_by: userId,
          status: 'upcoming',
          criteria: input.criteria
            ? {
                create: input.criteria.map((c) => ({
                  name: c.name,
                  description: c.description ?? null,
                  weight: c.weight,
                  max_score: c.max_score,
                  position: c.position,
                })),
              }
            : undefined,
        },
        include: { criteria: true },
      });
    }),

  advanceCycleStatus: protectedProcedure
    .input(z.object({ cycle_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const cycle = await ctx.prisma.hrPerformanceReviewCycle.findFirst({
        where: { id: input.cycle_id, organization_id: orgId },
      });
      if (!cycle) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cycle not found' });

      const next: Record<string, string> = {
        upcoming: 'self_review',
        self_review: 'manager_review',
        manager_review: 'calibration',
        calibration: 'completed',
      };
      const nextStatus = (next[cycle.status] ?? cycle.status) as HrReviewCycleStatus;
      return ctx.prisma.hrPerformanceReviewCycle.update({
        where: { id: input.cycle_id },
        data: { status: nextStatus },
      });
    }),

  // ---------------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------------
  listReviews: protectedProcedure
    .input(z.object({ cycle_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrPerformanceReview.findMany({
        where: { review_cycle_id: input.cycle_id, org_id: orgId },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true, employee_code: true, department_id: true } },
          reviewer: { select: { id: true, first_name: true, last_name: true } },
        },
        orderBy: { created_at: 'asc' },
      });
    }),

  createReview: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        reviewer_id: z.string(),
        review_cycle_id: z.string(),
        review_type: z.enum(['annual', 'semi_annual', 'quarterly', 'probation', 'three_sixty']).default('annual'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrPerformanceReview.create({
        data: {
          org_id: orgId,
          employee_id: input.employee_id,
          reviewer_id: input.reviewer_id,
          review_cycle_id: input.review_cycle_id,
          review_type: input.review_type,
          status: 'draft',
        },
      });
    }),

  submitSelfReview: protectedProcedure
    .input(
      z.object({
        review_id: z.string(),
        self_rating: z.number().min(0).max(5),
        feedback_strengths: z.string().optional(),
        feedback_improvements: z.string().optional(),
        goals_for_next_period: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const review = await ctx.prisma.hrPerformanceReview.findFirst({ where: { id: input.review_id, org_id: orgId } });
      if (!review) throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' });
      return ctx.prisma.hrPerformanceReview.update({
        where: { id: input.review_id },
        data: {
          self_rating: input.self_rating,
          feedback_strengths: input.feedback_strengths ?? null,
          feedback_improvements: input.feedback_improvements ?? null,
          goals_for_next_period: input.goals_for_next_period ?? null,
          status: 'self_review',
        },
      });
    }),

  submitManagerReview: protectedProcedure
    .input(
      z.object({
        review_id: z.string(),
        manager_rating: z.number().min(0).max(5),
        feedback_strengths: z.string().optional(),
        feedback_improvements: z.string().optional(),
        goals_for_next_period: z.string().optional(),
        promotion_recommended: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const review = await ctx.prisma.hrPerformanceReview.findFirst({ where: { id: input.review_id, org_id: orgId } });
      if (!review) throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' });
      return ctx.prisma.hrPerformanceReview.update({
        where: { id: input.review_id },
        data: {
          manager_rating: input.manager_rating,
          ...(input.feedback_strengths !== undefined ? { feedback_strengths: input.feedback_strengths } : {}),
          ...(input.feedback_improvements !== undefined ? { feedback_improvements: input.feedback_improvements } : {}),
          ...(input.goals_for_next_period !== undefined ? { goals_for_next_period: input.goals_for_next_period } : {}),
          ...(input.promotion_recommended !== undefined ? { promotion_recommended: input.promotion_recommended } : {}),
          status: 'manager_review',
        },
      });
    }),

  setFinalRating: protectedProcedure
    .input(
      z.object({
        review_id: z.string(),
        final_rating: z.number().min(0).max(5),
        rating_label: z.string(),
        promotion_recommended: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const review = await ctx.prisma.hrPerformanceReview.findFirst({ where: { id: input.review_id, org_id: orgId } });
      if (!review) throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' });
      return ctx.prisma.hrPerformanceReview.update({
        where: { id: input.review_id },
        data: {
          final_rating: input.final_rating,
          rating_label: input.rating_label,
          promotion_recommended: input.promotion_recommended,
          status: 'calibration',
        },
      });
    }),

  shareWithEmployee: protectedProcedure
    .input(z.object({ review_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const review = await ctx.prisma.hrPerformanceReview.findFirst({ where: { id: input.review_id, org_id: orgId } });
      if (!review) throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' });
      return ctx.prisma.hrPerformanceReview.update({
        where: { id: input.review_id },
        data: { shared_with_employee_at: new Date(), status: 'shared' },
      });
    }),

  acknowledgeReview: protectedProcedure
    .input(z.object({ review_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const review = await ctx.prisma.hrPerformanceReview.findFirst({ where: { id: input.review_id, org_id: orgId } });
      if (!review) throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' });
      return ctx.prisma.hrPerformanceReview.update({
        where: { id: input.review_id },
        data: { employee_acknowledged_at: new Date(), status: 'completed' },
      });
    }),

  calibrationData: protectedProcedure
    .input(z.object({ cycle_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrPerformanceReview.findMany({
        where: {
          review_cycle_id: input.cycle_id,
          org_id: orgId,
          final_rating: { not: null },
        },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true, department_id: true } },
        },
      });
    }),
});
