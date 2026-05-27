// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const DataSourceConfigSchema = z.object({
  module: z.string(),
  dimensions: z.array(z.object({
    field: z.string(),
    alias: z.string().optional(),
  })).default([]),
  measures: z.array(z.object({
    field: z.string(),
    func: z.enum(['sum', 'count', 'avg', 'min', 'max']),
    alias: z.string().optional(),
  })).default([]),
  filters: z.array(z.object({
    field: z.string(),
    op: z.string(),
    value: z.unknown(),
  })).default([]),
  joins: z.array(z.string()).default([]),
  date_filter: z.object({
    field: z.string(),
    preset: z.enum(['last_7_days', 'last_30_days', 'this_month', 'last_month', 'this_quarter', 'this_year', 'custom']).optional(),
    from: z.string().nullable().optional(),
    to: z.string().nullable().optional(),
  }).optional(),
  sort: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  limit: z.number().int().max(10000).default(100),
  group_by_date_trunc: z.enum(['day', 'week', 'month', 'quarter', 'year']).nullable().optional(),
});

const VisualizationConfigSchema = z.object({
  chart_type: z.enum(['line', 'bar', 'stacked_bar', 'pie', 'donut', 'area', 'scatter', 'heatmap']).default('bar'),
  x_axis: z.string().optional(),
  y_axis: z.string().optional(),
  color: z.string().optional(),
  group_by: z.string().nullable().optional(),
  show_legend: z.boolean().default(true),
  show_data_labels: z.boolean().default(false),
  color_palette: z.union([
    z.enum(['default', 'pastel', 'bold']),
    z.array(z.string()),
  ]).default('default'),
  kpi_comparison_period: z.enum(['prev_period', 'prev_year']).nullable().optional(),
  pivot_row_field: z.string().nullable().optional(),
  pivot_col_field: z.string().nullable().optional(),
  pivot_value_field: z.string().nullable().optional(),
  funnel_stages: z.array(z.unknown()).default([]),
});

const ReportCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  report_type: z.enum(['table', 'chart', 'pivot', 'funnel', 'cohort', 'kpi']).default('chart'),
  data_source: DataSourceConfigSchema,
  visualization_config: VisualizationConfigSchema,
  is_public: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const ReportUpdateSchema = ReportCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const ScheduledReportSchema = z.object({
  report_id: z.string().uuid().optional(),
  dashboard_id: z.string().uuid().optional(),
  name: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  day_of_week: z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(31).optional(),
  hour_of_day: z.number().int().min(0).max(23).default(8),
  recipients: z.array(z.string().email()),
  format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
  is_active: z.boolean().default(true),
});

function computeNextSendAt(frequency: string, hourOfDay: number, dayOfWeek?: number | null, dayOfMonth?: number | null): Date {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(hourOfDay);

  if (next <= now) next.setDate(next.getDate() + 1);

  if (frequency === 'weekly' && dayOfWeek != null) {
    const currentDay = next.getDay();
    const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntil);
  } else if (frequency === 'monthly' && dayOfMonth != null) {
    next.setDate(dayOfMonth);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  } else if (frequency === 'quarterly') {
    const currentMonth = now.getMonth();
    const nextQuarterMonth = Math.floor(currentMonth / 3) * 3 + 3;
    next.setMonth(nextQuarterMonth, 1);
  }

  return next;
}

export const reportsV2Router = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().default(1),
      tags: z.array(z.string()).optional(),
      search: z.string().optional(),
      report_type: z.enum(['table', 'chart', 'pivot', 'funnel', 'cohort', 'kpi']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const pageSize = 20;
      const skip = (input.page - 1) * pageSize;

      const where = {
        organization_id: orgId,
        ...(input.report_type ? { report_type: input.report_type } : {}),
        ...(input.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {}),
        ...(input.tags?.length ? { tags: { hasSome: input.tags } } : {}),
      };

      const [reports, total] = await Promise.all([
        ctx.prisma.analyticsReport.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
          select: {
            id: true,
            name: true,
            description: true,
            report_type: true,
            tags: true,
            is_public: true,
            last_run_at: true,
            last_run_duration_ms: true,
            created_at: true,
            updated_at: true,
          },
        }),
        ctx.prisma.analyticsReport.count({ where }),
      ]);

      return { reports, total, page: input.page, pageSize };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const report = await ctx.prisma.analyticsReport.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          scheduled_reports: {
            where: { is_active: true },
            select: { id: true, name: true, frequency: true, next_send_at: true },
          },
          alerts: {
            where: { is_active: true },
            select: { id: true, name: true, operator: true, threshold: true },
          },
        },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND' });
      return report;
    }),

  create: protectedProcedure
    .input(ReportCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.analyticsReport.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          name: input.name,
          description: input.description ?? null,
          report_type: input.report_type,
          data_source: input.data_source as object,
          visualization_config: input.visualization_config as object,
          is_public: input.is_public,
          tags: input.tags,
        },
      });
    }),

  update: protectedProcedure
    .input(ReportUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.analyticsReport.findFirst({
        where: { id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsReport.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description ?? null } : {}),
          ...(data.report_type !== undefined ? { report_type: data.report_type } : {}),
          ...(data.data_source !== undefined ? { data_source: data.data_source as object } : {}),
          ...(data.visualization_config !== undefined ? { visualization_config: data.visualization_config as object } : {}),
          ...(data.is_public !== undefined ? { is_public: data.is_public } : {}),
          ...(data.tags !== undefined ? { tags: data.tags } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.analyticsReport.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsReport.delete({ where: { id: input.id } });
    }),

  run: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      override_filters: z.array(z.object({
        field: z.string(),
        op: z.string(),
        value: z.unknown(),
      })).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const report = await ctx.prisma.analyticsReport.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND' });

      const { runAnalyticsQuery } = await import('@/lib/analytics/query-runner');
      const dataSource = report.data_source as Record<string, unknown>;
      const config = {
        dataSource: dataSource.module as string,
        dimensions: ((dataSource.dimensions as Array<{ field: string; alias?: string }>) ?? []).map((d) => d.alias ?? d.field),
        measures: ((dataSource.measures as Array<{ field: string; func: string; alias?: string }>) ?? []).map((m) => ({
          field: m.field,
          aggregation: m.func as 'sum' | 'count' | 'avg' | 'min' | 'max',
        })),
        filters: (input.override_filters ?? (dataSource.filters as Array<{ field: string; operator: string; value: unknown }>) ?? []) as Array<{ field: string; operator: string; value: unknown }>,
        dateRange: dataSource.date_filter
          ? {
              field: (dataSource.date_filter as { field: string }).field,
              from: (dataSource.date_filter as { from?: string }).from ?? new Date(Date.now() - 30 * 86400000).toISOString(),
              to: (dataSource.date_filter as { to?: string }).to ?? new Date().toISOString(),
            }
          : { field: 'created_at', from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() },
        limit: (dataSource.limit as number | undefined) ?? 100,
      };

      const start = Date.now();
      let rows: unknown[] = [];
      try {
        rows = await runAnalyticsQuery(ctx.prisma, orgId, config);
      } catch {
        rows = [];
      }
      const duration = Date.now() - start;

      await ctx.prisma.analyticsReport.update({
        where: { id: input.id },
        data: { last_run_at: new Date(), last_run_duration_ms: duration },
      });

      return { rows, meta: { duration_ms: duration, row_count: rows.length } };
    }),

  schedule: protectedProcedure
    .input(ScheduledReportSchema.extend({ report_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const nextSendAt = computeNextSendAt(input.frequency, input.hour_of_day, input.day_of_week, input.day_of_month);
      return ctx.prisma.analyticsScheduledReport.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          report_id: input.report_id,
          name: input.name,
          frequency: input.frequency,
          day_of_week: input.day_of_week ?? null,
          day_of_month: input.day_of_month ?? null,
          hour_of_day: input.hour_of_day,
          recipients: input.recipients,
          format: input.format,
          is_active: input.is_active,
          next_send_at: nextSendAt,
        },
      });
    }),

  // Scheduled report management
  schedules: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.analyticsScheduledReport.findMany({
        where: { organization_id: orgId },
        include: { report: { select: { id: true, name: true, report_type: true } } },
        orderBy: { created_at: 'desc' },
      });
    }),

    update: protectedProcedure
      .input(ScheduledReportSchema.partial().extend({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;
        const { id, ...data } = input;
        const existing = await ctx.prisma.analyticsScheduledReport.findFirst({
          where: { id, organization_id: orgId },
        });
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

        const nextSendAt = data.frequency
          ? computeNextSendAt(data.frequency, data.hour_of_day ?? existing.hour_of_day, data.day_of_week, data.day_of_month)
          : undefined;

        return ctx.prisma.analyticsScheduledReport.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
            ...(data.day_of_week !== undefined ? { day_of_week: data.day_of_week } : {}),
            ...(data.day_of_month !== undefined ? { day_of_month: data.day_of_month } : {}),
            ...(data.hour_of_day !== undefined ? { hour_of_day: data.hour_of_day } : {}),
            ...(data.recipients !== undefined ? { recipients: data.recipients } : {}),
            ...(data.format !== undefined ? { format: data.format } : {}),
            ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
            ...(nextSendAt ? { next_send_at: nextSendAt } : {}),
          },
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;
        const existing = await ctx.prisma.analyticsScheduledReport.findFirst({
          where: { id: input.id, organization_id: orgId },
        });
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
        return ctx.prisma.analyticsScheduledReport.delete({ where: { id: input.id } });
      }),
  }),
});
