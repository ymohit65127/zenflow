import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const holidaysRouter = createTRPCRouter({
  listCalendars: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrHolidayCalendar.findMany({
      where: { organization_id: orgId },
      include: { _count: { select: { holidays: true } } },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
    });
  }),

  getCalendar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const calendar = await ctx.prisma.hrHolidayCalendar.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          holidays: { orderBy: { date: 'asc' } },
        },
      });
      if (!calendar) throw new TRPCError({ code: 'NOT_FOUND', message: 'Holiday calendar not found' });
      return calendar;
    }),

  createCalendar: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        year: z.number().int().min(2020).max(2100),
        region: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrHolidayCalendar.create({
        data: {
          organization_id: orgId,
          name: input.name,
          year: input.year,
          region: input.region ?? null,
        },
      });
    }),

  updateCalendar: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        year: z.number().int().optional(),
        region: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.hrHolidayCalendar.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Calendar not found' });
      return ctx.prisma.hrHolidayCalendar.update({ where: { id }, data });
    }),

  deleteCalendar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrHolidayCalendar.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Calendar not found' });
      return ctx.prisma.hrHolidayCalendar.delete({ where: { id: input.id } });
    }),

  addHoliday: protectedProcedure
    .input(
      z.object({
        calendar_id: z.string(),
        name: z.string().min(1),
        date: z.string(),
        type: z.enum(['national', 'regional', 'optional', 'restricted']).default('national'),
        is_half_day: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const calendar = await ctx.prisma.hrHolidayCalendar.findFirst({
        where: { id: input.calendar_id, organization_id: orgId },
      });
      if (!calendar) throw new TRPCError({ code: 'NOT_FOUND', message: 'Calendar not found' });
      return ctx.prisma.hrHoliday.create({
        data: {
          calendar_id: input.calendar_id,
          name: input.name,
          date: new Date(input.date),
          type: input.type,
          is_half_day: input.is_half_day,
        },
      });
    }),

  updateHoliday: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        date: z.string().optional(),
        type: z.enum(['national', 'regional', 'optional', 'restricted']).optional(),
        is_half_day: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, date, ...rest } = input;
      return ctx.prisma.hrHoliday.update({
        where: { id },
        data: {
          ...rest,
          ...(date ? { date: new Date(date) } : {}),
        },
      });
    }),

  deleteHoliday: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.hrHoliday.delete({ where: { id: input.id } });
    }),

  listHolidaysForYear: protectedProcedure
    .input(z.object({ year: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrHoliday.findMany({
        where: {
          calendar: { organization_id: orgId, year: input.year },
        },
        include: { calendar: { select: { id: true, name: true, region: true } } },
        orderBy: { date: 'asc' },
      });
    }),
});
