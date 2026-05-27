import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ─── Analytics v2 Sub-routers ─────────────────────────────────────────────────
import { dashboardsRouter } from './analytics/dashboards';
import { reportsV2Router } from './analytics/reports_v2';
import { dataAlertsRouter } from './analytics/dataAlerts';
import { savedFiltersRouter } from './analytics/savedFilters';
import { queryRunnerRouter } from './analytics/queryRunner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

// ─── Widgets sub-router ───────────────────────────────────────────────────────

const widgetsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const userId = ctx.session.user.id as string;
    return ctx.prisma.dashboardWidget.findMany({
      where: { organization_id: orgId, user_id: userId },
      orderBy: [{ grid_row: 'asc' }, { grid_col: 'asc' }],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        widget_type: z.enum(['METRIC', 'LINE_CHART', 'BAR_CHART', 'PIE_CHART', 'TABLE', 'FUNNEL', 'MAP', 'CALENDAR', 'LIST']),
        data_source: z.string(),
        query_config: z.record(z.unknown()).default({}),
        display_config: z.record(z.unknown()).default({}),
        grid_col: z.number().int().default(0),
        grid_row: z.number().int().default(0),
        grid_w: z.number().int().default(4),
        grid_h: z.number().int().default(3),
        refresh_interval_sec: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.dashboardWidget.create({
        data: {
          ...input,
          organization_id: orgId,
          user_id: userId,
          query_config: input.query_config as object,
          display_config: input.display_config as object,
          refresh_interval_sec: input.refresh_interval_sec ?? null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.dashboardWidget.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.dashboardWidget.delete({ where: { id: input.id } });
    }),
});

// ─── Reports sub-router ───────────────────────────────────────────────────────

const reportsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.analyticsReport.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        module: z.string(),
        report_type: z.enum(['SUMMARY', 'DETAILED', 'COMPARISON', 'TREND']),
        config: z.record(z.unknown()).default({}),
        is_scheduled: z.boolean().default(false),
        schedule_cron: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.analyticsReport.create({
        data: {
          ...input,
          organization_id: orgId,
          config: input.config as object,
          schedule_cron: input.schedule_cron ?? null,
          description: input.description ?? null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.analyticsReport.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsReport.delete({ where: { id: input.id } });
    }),

  markRun: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.analyticsReport.update({
        where: { id: input.id },
        data: { last_run_at: new Date() },
      });
    }),
});

// ─── Root analytics router ────────────────────────────────────────────────────

export const analyticsRouter = createTRPCRouter({
  // Aggregate overview KPIs from every module
  overview: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();
    const monthStart = startOfMonth(now);

    const [
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      totalContacts,
      newContactsThisMonth,
      openDealsAgg,
      activeProjects,
      completedTasksThisWeek,
      openTickets,
      resolvedTicketsThisMonth,
      revenueAgg,
      outstandingInvoicesAgg,
    ] = await Promise.all([
      ctx.prisma.user.count({ where: { organization_id: orgId, deleted_at: null } }),
      ctx.prisma.user.count({ where: { organization_id: orgId, deleted_at: null, is_active: true } }),
      ctx.prisma.user.count({ where: { organization_id: orgId, deleted_at: null, created_at: { gte: monthStart } } }),
      ctx.prisma.crmContact.count({ where: { organization_id: orgId, deleted_at: null } }),
      ctx.prisma.crmContact.count({ where: { organization_id: orgId, deleted_at: null, created_at: { gte: monthStart } } }),
      ctx.prisma.crmDeal.aggregate({
        where: { organization_id: orgId, deleted_at: null, status: 'OPEN' },
        _sum: { value: true },
        _count: true,
      }),
      ctx.prisma.project.count({ where: { organization_id: orgId, deleted_at: null, status: 'ACTIVE' } }),
      ctx.prisma.task.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'DONE',
          completed_at: { gte: startOfWeek(now) },
        },
      }),
      ctx.prisma.ticket.count({ where: { organization_id: orgId, deleted_at: null, status: 'OPEN' } }),
      ctx.prisma.ticket.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'RESOLVED',
          resolved_at: { gte: monthStart },
        },
      }),
      ctx.prisma.invoice.aggregate({
        where: { organization_id: orgId, deleted_at: null, status: 'PAID' },
        _sum: { paid_amount: true },
      }),
      ctx.prisma.invoice.aggregate({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      totalContacts,
      newContactsThisMonth,
      openDeals: openDealsAgg._count,
      totalDealValue: Number(openDealsAgg._sum.value ?? 0),
      activeProjects,
      completedTasksThisWeek,
      openTickets,
      resolvedTicketsThisMonth,
      totalRevenue: Number(revenueAgg._sum.paid_amount ?? 0),
      outstandingInvoices: Number(outstandingInvoicesAgg._sum.total ?? 0),
      outstandingInvoiceCount: outstandingInvoicesAgg._count,
    };
  }),

  // Monthly contacts + leads + deals for last 6 months
  crmStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();

    const months: Array<{ year: number; month: number; label: string; start: Date; end: Date }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: monthLabel(d.getFullYear(), d.getMonth()), start: d, end });
    }

    const results = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const [contacts, leads, deals] = await Promise.all([
          ctx.prisma.crmContact.count({
            where: { organization_id: orgId, deleted_at: null, created_at: { gte: start, lt: end } },
          }),
          ctx.prisma.crmLead.count({
            where: { organization_id: orgId, deleted_at: null, created_at: { gte: start, lt: end } },
          }),
          ctx.prisma.crmDeal.count({
            where: { organization_id: orgId, deleted_at: null, created_at: { gte: start, lt: end } },
          }),
        ]);
        return { month: label, contacts, leads, deals };
      })
    );

    return results;
  }),

  // Monthly revenue for last 12 months
  revenueStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();

    const months: Array<{ label: string; start: Date; end: Date }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({ label: monthLabel(d.getFullYear(), d.getMonth()), start: d, end });
    }

    const results = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const agg = await ctx.prisma.invoice.aggregate({
          where: {
            organization_id: orgId,
            deleted_at: null,
            status: 'PAID',
            paid_at: { gte: start, lt: end },
          },
          _sum: { paid_amount: true },
          _count: true,
        });
        return {
          month: label,
          revenue: Number(agg._sum.paid_amount ?? 0),
          invoiceCount: agg._count,
        };
      })
    );

    return results;
  }),

  // Tickets by status + priority
  ticketStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;

    const [byStatus, byPriority] = await Promise.all([
      ctx.prisma.ticket.groupBy({
        by: ['status'],
        where: { organization_id: orgId, deleted_at: null },
        _count: true,
      }),
      ctx.prisma.ticket.groupBy({
        by: ['priority'],
        where: { organization_id: orgId, deleted_at: null },
        _count: true,
      }),
    ]);

    const statusColors: Record<string, string> = {
      OPEN: '#6366f1',
      IN_PROGRESS: '#06b6d4',
      PENDING: '#f59e0b',
      RESOLVED: '#22c55e',
      CLOSED: '#8b5cf6',
    };
    const priorityColors: Record<string, string> = {
      LOW: '#22c55e',
      MEDIUM: '#f59e0b',
      HIGH: '#ef4444',
      URGENT: '#dc2626',
    };

    return {
      byStatus: byStatus.map((s) => ({
        name: s.status,
        value: s._count,
        fill: statusColors[s.status] ?? '#6366f1',
      })),
      byPriority: byPriority.map((p) => ({
        name: p.priority,
        value: p._count,
        fill: priorityColors[p.priority] ?? '#6366f1',
      })),
    };
  }),

  // Tasks by status across all projects
  projectStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();
    const weekStart = startOfWeek(now);
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [byStatus, projectsByStatus, thisWeekDone, lastWeekDone] = await Promise.all([
      ctx.prisma.task.groupBy({
        by: ['status'],
        where: { organization_id: orgId, deleted_at: null },
        _count: true,
      }),
      ctx.prisma.project.groupBy({
        by: ['status'],
        where: { organization_id: orgId, deleted_at: null },
        _count: true,
      }),
      ctx.prisma.task.count({
        where: { organization_id: orgId, deleted_at: null, status: 'DONE', completed_at: { gte: weekStart } },
      }),
      ctx.prisma.task.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'DONE',
          completed_at: { gte: lastWeekStart, lt: weekStart },
        },
      }),
    ]);

    const statusColors: Record<string, string> = {
      TODO: '#8b5cf6',
      IN_PROGRESS: '#6366f1',
      IN_REVIEW: '#f59e0b',
      DONE: '#22c55e',
      CANCELLED: '#ef4444',
    };
    const projectStatusColors: Record<string, string> = {
      ACTIVE: '#6366f1',
      ON_HOLD: '#f59e0b',
      COMPLETED: '#22c55e',
      CANCELLED: '#ef4444',
      ARCHIVED: '#8b5cf6',
    };

    return {
      tasksByStatus: byStatus.map((t) => ({
        name: t.status,
        value: t._count,
        fill: statusColors[t.status] ?? '#6366f1',
      })),
      projectsByStatus: projectsByStatus.map((p) => ({
        name: p.status,
        value: p._count,
        fill: projectStatusColors[p.status] ?? '#6366f1',
      })),
      thisWeekDone,
      lastWeekDone,
    };
  }),

  // Top 5 open deals by value
  topDeals: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.crmDeal.findMany({
      where: { organization_id: orgId, deleted_at: null, status: 'OPEN' },
      include: {
        contact: { select: { first_name: true, last_name: true, company: true } },
        stage: { select: { name: true, color: true } },
        assignee: { select: { name: true, avatar_url: true } },
      },
      orderBy: { value: 'desc' },
      take: 5,
    });
  }),

  // Last 20 audit log entries
  recentActivity: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.auditLog.findMany({
      where: { organization_id: orgId },
      include: { user: { select: { name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
  }),

  // Leads grouped by source
  leadsBySource: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const grouped = await ctx.prisma.crmLead.groupBy({
      by: ['source'],
      where: { organization_id: orgId, deleted_at: null },
      _count: true,
    });

    const sourceColors: Record<string, string> = {
      WEBSITE: '#6366f1',
      SOCIAL_MEDIA: '#8b5cf6',
      REFERRAL: '#22c55e',
      EMAIL_CAMPAIGN: '#06b6d4',
      COLD_CALL: '#f59e0b',
      TRADE_SHOW: '#ef4444',
      PARTNER: '#ec4899',
      OTHER: '#94a3b8',
    };

    return grouped.map((g) => ({
      source: g.source ?? 'OTHER',
      count: g._count,
      fill: sourceColors[g.source ?? 'OTHER'] ?? '#94a3b8',
    }));
  }),

  // Deals won vs lost this quarter
  dealsWonLost: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const [won, lost] = await Promise.all([
      ctx.prisma.crmDeal.aggregate({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'WON',
          closed_at: { gte: quarterStart },
        },
        _count: true,
        _sum: { value: true },
      }),
      ctx.prisma.crmDeal.aggregate({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'LOST',
          closed_at: { gte: quarterStart },
        },
        _count: true,
        _sum: { value: true },
      }),
    ]);

    return {
      won: { count: won._count, value: Number(won._sum.value ?? 0) },
      lost: { count: lost._count, value: Number(lost._sum.value ?? 0) },
    };
  }),

  // Invoice status breakdown
  invoiceStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const grouped = await ctx.prisma.invoice.groupBy({
      by: ['status'],
      where: { organization_id: orgId, deleted_at: null },
      _count: true,
      _sum: { total: true },
    });

    const statusColors: Record<string, string> = {
      DRAFT: '#94a3b8',
      SENT: '#6366f1',
      VIEWED: '#8b5cf6',
      PARTIAL: '#06b6d4',
      PAID: '#22c55e',
      OVERDUE: '#ef4444',
      CANCELLED: '#f59e0b',
    };

    return grouped.map((g) => ({
      status: g.status,
      count: g._count,
      total: Number(g._sum.total ?? 0),
      fill: statusColors[g.status] ?? '#94a3b8',
    }));
  }),

  widgets: widgetsRouter,
  reports: reportsRouter,

  // ── Analytics v2 ──────────────────────────────────────────────────────────
  dashboards: dashboardsRouter,
  reportsV2: reportsV2Router,
  alerts: dataAlertsRouter,
  savedFilters: savedFiltersRouter,
  query: queryRunnerRouter,
});
