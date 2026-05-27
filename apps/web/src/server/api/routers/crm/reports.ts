// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const crmReportsRouter = createTRPCRouter({
  getPipelineSummary: protectedProcedure
    .input(
      z.object({
        pipelineId: z.string().optional(),
        dateFrom: z.date(),
        dateTo: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const deals = await ctx.prisma.crmDeal.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          ...(input.pipelineId && { pipeline_id: input.pipelineId }),
          created_at: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          stage: { select: { id: true, name: true, color: true, stage_type: true } },
        },
      });

      // Group by stage
      const stageMap = new Map<string, { name: string; color: string; count: number; value: number }>();
      let totalValue = 0;
      let wonCount = 0;
      let lostCount = 0;

      for (const deal of deals) {
        const stageId = deal.stage_id;
        const existing = stageMap.get(stageId);
        const amount = Number(deal.amount ?? 0);

        if (existing) {
          existing.count++;
          existing.value += amount;
        } else {
          stageMap.set(stageId, {
            name: deal.stage.name,
            color: deal.stage.color,
            count: 1,
            value: amount,
          });
        }

        totalValue += amount;
        if (deal.stage.stage_type === 'won') wonCount++;
        if (deal.stage.stage_type === 'lost') lostCount++;
      }

      const totalDeals = deals.length;
      const avgDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
      const conversionRate = (wonCount + lostCount) > 0 ? wonCount / (wonCount + lostCount) : 0;

      return {
        totalDeals,
        totalValue,
        avgDealSize,
        conversionRate,
        wonCount,
        lostCount,
        byStage: Array.from(stageMap.entries()).map(([id, data]) => ({ id, ...data })),
      };
    }),

  getWinLossAnalysis: protectedProcedure
    .input(
      z.object({
        dateFrom: z.date(),
        dateTo: z.date(),
        groupBy: z.enum(['owner', 'source', 'deal_type', 'lost_reason']),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const [wonDeals, lostDeals] = await Promise.all([
        ctx.prisma.crmDeal.findMany({
          where: {
            organization_id: orgId,
            deleted_at: null,
            won_at: { gte: input.dateFrom, lte: input.dateTo },
          },
          include: {
            owner: { select: { id: true, name: true } },
            lost_reason: { select: { id: true, name: true } },
          },
        }),
        ctx.prisma.crmDeal.findMany({
          where: {
            organization_id: orgId,
            deleted_at: null,
            lost_at: { gte: input.dateFrom, lte: input.dateTo },
          },
          include: {
            owner: { select: { id: true, name: true } },
            lost_reason: { select: { id: true, name: true } },
          },
        }),
      ]);

      type GroupData = { label: string; won: number; lost: number; wonValue: number; lostValue: number };
      const grouped = new Map<string, GroupData>();

      const getKey = (deal: typeof wonDeals[0]) => {
        if (input.groupBy === 'owner') return deal.owner?.name ?? 'Unassigned';
        if (input.groupBy === 'source') return deal.source ?? 'Unknown';
        if (input.groupBy === 'deal_type') return deal.deal_type;
        if (input.groupBy === 'lost_reason') return deal.lost_reason?.name ?? 'No reason';
        return 'Other';
      };

      for (const deal of wonDeals) {
        const key = getKey(deal);
        const existing = grouped.get(key) ?? { label: key, won: 0, lost: 0, wonValue: 0, lostValue: 0 };
        existing.won++;
        existing.wonValue += Number(deal.amount ?? 0);
        grouped.set(key, existing);
      }

      for (const deal of lostDeals) {
        const key = getKey(deal);
        const existing = grouped.get(key) ?? { label: key, won: 0, lost: 0, wonValue: 0, lostValue: 0 };
        existing.lost++;
        existing.lostValue += Number(deal.amount ?? 0);
        grouped.set(key, existing);
      }

      return Array.from(grouped.values()).sort((a, b) => (b.won + b.lost) - (a.won + a.lost));
    }),

  getForecast: protectedProcedure
    .input(
      z.object({
        pipelineId: z.string(),
        period: z.enum(['this_month', 'next_month', 'this_quarter']),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const now = new Date();

      let startDate: Date;
      let endDate: Date;

      if (input.period === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (input.period === 'next_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      } else {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      }

      const openDeals = await ctx.prisma.crmDeal.findMany({
        where: {
          organization_id: orgId,
          pipeline_id: input.pipelineId,
          deleted_at: null,
          won_at: null,
          lost_at: null,
          expected_close_date: { gte: startDate, lte: endDate },
        },
        include: {
          stage: { select: { probability: true, name: true } },
        },
      });

      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const [wonLast6, closedLast6] = await Promise.all([
        ctx.prisma.crmDeal.count({
          where: { organization_id: orgId, pipeline_id: input.pipelineId, won_at: { gte: sixMonthsAgo } },
        }),
        ctx.prisma.crmDeal.count({
          where: {
            organization_id: orgId,
            pipeline_id: input.pipelineId,
            OR: [{ won_at: { gte: sixMonthsAgo } }, { lost_at: { gte: sixMonthsAgo } }],
          },
        }),
      ]);

      const historicalWinRate = closedLast6 > 0 ? wonLast6 / closedLast6 : 0.5;

      let bestCase = 0;
      let weighted = 0;

      for (const deal of openDeals) {
        const amount = Number(deal.amount ?? 0);
        const prob = Number(deal.probability ?? deal.stage.probability ?? 0) / 100;
        bestCase += amount;
        weighted += amount * prob;
      }

      const commit = weighted * historicalWinRate;

      return {
        bestCase,
        weighted,
        commit,
        dealCount: openDeals.length,
        avgDealSize: openDeals.length > 0 ? bestCase / openDeals.length : 0,
        historicalWinRate,
        period: { start: startDate, end: endDate },
        closingDeals: openDeals.map((d) => ({
          id: d.id,
          name: d.name,
          amount: Number(d.amount ?? 0),
          probability: Number(d.probability ?? d.stage.probability ?? 0),
          expected_close_date: d.expected_close_date,
          stageName: d.stage.name,
        })),
      };
    }),

  getActivityReport: protectedProcedure
    .input(
      z.object({
        ownerId: z.string().optional(),
        dateFrom: z.date(),
        dateTo: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const activities = await ctx.prisma.crmActivity.findMany({
        where: {
          organization_id: orgId,
          ...(input.ownerId && { owner_id: input.ownerId }),
          created_at: { gte: input.dateFrom, lte: input.dateTo },
        },
        select: { type: true, status: true, outcome: true, created_at: true },
      });

      const byType = new Map<string, number>();
      const byOutcome = new Map<string, number>();

      for (const act of activities) {
        byType.set(act.type, (byType.get(act.type) ?? 0) + 1);
        if (act.outcome) {
          byOutcome.set(act.outcome, (byOutcome.get(act.outcome) ?? 0) + 1);
        }
      }

      return {
        total: activities.length,
        byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
        byOutcome: Array.from(byOutcome.entries()).map(([outcome, count]) => ({ outcome, count })),
      };
    }),

  getLeaderboard: protectedProcedure
    .input(
      z.object({
        metric: z.enum(['deals_won', 'revenue', 'activities', 'avg_deal_size']),
        dateFrom: z.date(),
        dateTo: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const wonDeals = await ctx.prisma.crmDeal.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          won_at: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
        },
      });

      type RepData = { userId: string; name: string; avatar: string | null; dealsWon: number; revenue: number };
      const repMap = new Map<string, RepData>();

      for (const deal of wonDeals) {
        if (!deal.owner_id) continue;
        const existing = repMap.get(deal.owner_id) ?? {
          userId: deal.owner_id,
          name: deal.owner?.name ?? 'Unknown',
          avatar: deal.owner?.avatar_url ?? null,
          dealsWon: 0,
          revenue: 0,
        };
        existing.dealsWon++;
        existing.revenue += Number(deal.amount ?? 0);
        repMap.set(deal.owner_id, existing);
      }

      const reps = Array.from(repMap.values()).map((rep) => ({
        ...rep,
        avgDealSize: rep.dealsWon > 0 ? rep.revenue / rep.dealsWon : 0,
      }));

      if (input.metric === 'deals_won') reps.sort((a, b) => b.dealsWon - a.dealsWon);
      else if (input.metric === 'revenue') reps.sort((a, b) => b.revenue - a.revenue);
      else if (input.metric === 'avg_deal_size') reps.sort((a, b) => b.avgDealSize - a.avgDealSize);

      return reps.slice(0, 20);
    }),

  getVelocityReport: protectedProcedure
    .input(
      z.object({
        pipelineId: z.string(),
        dateFrom: z.date(),
        dateTo: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const closedDeals = await ctx.prisma.crmDeal.findMany({
        where: {
          organization_id: orgId,
          pipeline_id: input.pipelineId,
          deleted_at: null,
          actual_close_date: { gte: input.dateFrom, lte: input.dateTo },
        },
        select: {
          id: true,
          created_at: true,
          actual_close_date: true,
          stage_changed_at: true,
          won_at: true,
          lost_at: true,
          amount: true,
        },
      });

      const cycleTimes = closedDeals
        .filter((d) => d.actual_close_date)
        .map((d) => {
          const closeDate = d.actual_close_date as Date;
          return (closeDate.getTime() - d.created_at.getTime()) / (1000 * 60 * 60 * 24);
        });

      const avgCycleTime = cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;

      return {
        avgCycleTimeDays: Math.round(avgCycleTime),
        dealsAnalyzed: closedDeals.length,
        minCycleTime: cycleTimes.length > 0 ? Math.min(...cycleTimes) : 0,
        maxCycleTime: cycleTimes.length > 0 ? Math.max(...cycleTimes) : 0,
      };
    }),
});
