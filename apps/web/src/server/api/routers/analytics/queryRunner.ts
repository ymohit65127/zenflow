import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

const QuerySchema = z.object({
  dataSource: z.string(),
  dimensions: z.array(z.string()).default([]),
  measures: z.array(z.object({
    field: z.string(),
    aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max']),
  })).default([]),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).default([]),
  dateRange: z.object({
    field: z.string(),
    from: z.string(),
    to: z.string(),
  }).optional(),
  orderBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
  limit: z.number().int().max(10000).default(100),
});

export const queryRunnerRouter = createTRPCRouter({
  run: protectedProcedure
    .input(QuerySchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { runAnalyticsQuery } = await import('@/lib/analytics/query-runner');

      const start = Date.now();
      let rows: unknown[] = [];
      try {
        rows = await runAnalyticsQuery(ctx.prisma, orgId, {
          dataSource: input.dataSource,
          dimensions: input.dimensions,
          measures: input.measures,
          filters: input.filters as Array<{ field: string; operator: string; value: unknown }>,
          dateRange: input.dateRange ?? { field: 'created_at', from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() },
          orderBy: input.orderBy,
          limit: input.limit,
        });
      } catch (err) {
        return {
          rows: [],
          meta: {
            duration_ms: Date.now() - start,
            row_count: 0,
            error: (err as Error).message,
          },
        };
      }

      return {
        rows,
        meta: {
          duration_ms: Date.now() - start,
          row_count: rows.length,
        },
      };
    }),

  dataSources: protectedProcedure.query(async () => {
    const { DATA_SOURCE_MODULES } = await import('@/lib/analytics/query-runner');
    return DATA_SOURCE_MODULES.map((m) => ({
      id: m.module_id,
      label: m.label,
      dimensions: m.dimensions,
      measures: m.measures,
      date_fields: m.date_fields,
    }));
  }),
});
