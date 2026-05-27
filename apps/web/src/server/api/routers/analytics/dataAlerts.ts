import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const AlertCreateSchema = z.object({
  report_id: z.string().uuid(),
  name: z.string().min(1),
  metric_path: z.string().min(1),
  operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'change_pct_up', 'change_pct_down']),
  threshold: z.number(),
  notification_channels: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    in_app: z.boolean().default(true),
  }),
  recipients: z.array(z.string().email()),
  is_active: z.boolean().default(true),
});

export const dataAlertsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      report_id: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.analyticsDataAlert.findMany({
        where: {
          organization_id: orgId,
          ...(input.report_id ? { report_id: input.report_id } : {}),
        },
        include: {
          report: { select: { id: true, name: true, report_type: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const alert = await ctx.prisma.analyticsDataAlert.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { report: true },
      });
      if (!alert) throw new TRPCError({ code: 'NOT_FOUND' });
      return alert;
    }),

  create: protectedProcedure
    .input(AlertCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      // Verify report belongs to org
      const report = await ctx.prisma.analyticsReport.findFirst({
        where: { id: input.report_id, organization_id: orgId },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' });

      return ctx.prisma.analyticsDataAlert.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          report_id: input.report_id,
          name: input.name,
          metric_path: input.metric_path,
          operator: input.operator,
          threshold: input.threshold,
          notification_channels: input.notification_channels as object,
          recipients: input.recipients,
          is_active: input.is_active,
        },
      });
    }),

  update: protectedProcedure
    .input(AlertCreateSchema.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.analyticsDataAlert.findFirst({
        where: { id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsDataAlert.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.metric_path !== undefined ? { metric_path: data.metric_path } : {}),
          ...(data.operator !== undefined ? { operator: data.operator } : {}),
          ...(data.threshold !== undefined ? { threshold: data.threshold } : {}),
          ...(data.notification_channels !== undefined ? { notification_channels: data.notification_channels as object } : {}),
          ...(data.recipients !== undefined ? { recipients: data.recipients } : {}),
          ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.analyticsDataAlert.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsDataAlert.delete({ where: { id: input.id } });
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.analyticsDataAlert.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsDataAlert.update({
        where: { id: input.id },
        data: { is_active: input.active },
      });
    }),

  checkStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const alert = await ctx.prisma.analyticsDataAlert.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { report: true },
      });
      if (!alert) throw new TRPCError({ code: 'NOT_FOUND' });

      return {
        id: alert.id,
        name: alert.name,
        is_active: alert.is_active,
        last_triggered_at: alert.last_triggered_at,
        last_value: alert.last_value ? Number(alert.last_value) : null,
        threshold: Number(alert.threshold),
        operator: alert.operator,
      };
    }),
});
