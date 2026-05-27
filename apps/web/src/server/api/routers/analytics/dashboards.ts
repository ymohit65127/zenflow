import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const DashboardCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  is_default: z.boolean().default(false),
  scope: z.enum(['personal', 'team', 'org']).default('personal'),
  shared_with_ids: z.array(z.string()).default([]),
});

const DashboardUpdateSchema = DashboardCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const GridPositionSchema = z.object({
  grid_x: z.number().int().default(0),
  grid_y: z.number().int().default(0),
  grid_w: z.number().int().default(6),
  grid_h: z.number().int().default(4),
});

const DashboardItemLayoutSchema = z.object({
  id: z.string().uuid(),
  grid_x: z.number().int(),
  grid_y: z.number().int(),
  grid_w: z.number().int(),
  grid_h: z.number().int(),
});

export const dashboardsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ scope: z.enum(['personal', 'team', 'org']).optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.analyticsDashboard.findMany({
        where: {
          organization_id: orgId,
          ...(input.scope ? { scope: input.scope } : {}),
        },
        include: {
          _count: { select: { items: true } },
        },
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const dashboard = await ctx.prisma.analyticsDashboard.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          items: {
            include: {
              report: {
                select: {
                  id: true,
                  name: true,
                  report_type: true,
                  visualization_config: true,
                  last_run_at: true,
                },
              },
            },
            orderBy: [{ grid_y: 'asc' }, { grid_x: 'asc' }],
          },
        },
      });
      if (!dashboard) throw new TRPCError({ code: 'NOT_FOUND' });
      return dashboard;
    }),

  create: protectedProcedure
    .input(DashboardCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      // If new default, unset existing defaults for this user's personal scope
      if (input.is_default && input.scope === 'personal') {
        await ctx.prisma.analyticsDashboard.updateMany({
          where: { organization_id: orgId, created_by: userId, scope: 'personal', is_default: true },
          data: { is_default: false },
        });
      }

      return ctx.prisma.analyticsDashboard.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          name: input.name,
          description: input.description ?? null,
          is_default: input.is_default,
          scope: input.scope,
          shared_with_ids: input.shared_with_ids,
        },
      });
    }),

  update: protectedProcedure
    .input(DashboardUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.analyticsDashboard.findFirst({
        where: { id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsDashboard.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description ?? null } : {}),
          ...(data.is_default !== undefined ? { is_default: data.is_default } : {}),
          ...(data.scope !== undefined ? { scope: data.scope } : {}),
          ...(data.shared_with_ids !== undefined ? { shared_with_ids: data.shared_with_ids } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.analyticsDashboard.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsDashboard.delete({ where: { id: input.id } });
    }),

  saveLayout: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      items: z.array(DashboardItemLayoutSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.analyticsDashboard.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.prisma.$transaction(
        input.items.map((item) =>
          ctx.prisma.analyticsDashboardItem.update({
            where: { id: item.id },
            data: {
              grid_x: item.grid_x,
              grid_y: item.grid_y,
              grid_w: item.grid_w,
              grid_h: item.grid_h,
            },
          })
        )
      );
      return { updated: input.items.length };
    }),

  addWidget: protectedProcedure
    .input(z.object({
      dashboardId: z.string().uuid(),
      reportId: z.string().uuid(),
      grid: GridPositionSchema,
      title_override: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const dashboard = await ctx.prisma.analyticsDashboard.findFirst({
        where: { id: input.dashboardId, organization_id: orgId },
      });
      if (!dashboard) throw new TRPCError({ code: 'NOT_FOUND' });

      // Verify report belongs to org
      const report = await ctx.prisma.analyticsReport.findFirst({
        where: { id: input.reportId, organization_id: orgId },
        select: { id: true, report_type: true },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' });

      return ctx.prisma.analyticsDashboardItem.create({
        data: {
          dashboard_id: input.dashboardId,
          report_id: input.reportId,
          widget_type: (report.report_type as string) as 'chart',
          grid_x: input.grid.grid_x,
          grid_y: input.grid.grid_y,
          grid_w: input.grid.grid_w,
          grid_h: input.grid.grid_h,
          title_override: input.title_override ?? null,
        },
      });
    }),

  removeWidget: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const item = await ctx.prisma.analyticsDashboardItem.findFirst({
        where: { id: input.itemId, dashboard: { organization_id: orgId } },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsDashboardItem.delete({ where: { id: input.itemId } });
    }),
});
