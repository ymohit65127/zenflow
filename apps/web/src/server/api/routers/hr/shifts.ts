import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const shiftsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrShift.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const shift = await ctx.prisma.hrShift.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          assignments: {
            include: {
              employee: { select: { id: true, first_name: true, last_name: true, employee_code: true } },
            },
            where: { effective_to: null },
            orderBy: { created_at: 'desc' },
          },
        },
      });
      if (!shift) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found' });
      return shift;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        color: z.string().default('#6366f1'),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
        grace_period_minutes: z.number().int().min(0).default(15),
        half_day_threshold_minutes: z.number().int().min(0).default(240),
        break_duration_minutes: z.number().int().min(0).default(60),
        is_night_shift: z.boolean().default(false),
        overtime_after_minutes: z.number().int().min(0).default(480),
        weekly_off_days: z.array(z.number().int().min(0).max(6)).default([0, 6]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrShift.create({
        data: { ...input, organization_id: orgId },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        grace_period_minutes: z.number().int().min(0).optional(),
        half_day_threshold_minutes: z.number().int().min(0).optional(),
        break_duration_minutes: z.number().int().min(0).optional(),
        is_night_shift: z.boolean().optional(),
        overtime_after_minutes: z.number().int().min(0).optional(),
        weekly_off_days: z.array(z.number().int().min(0).max(6)).optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.hrShift.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found' });
      return ctx.prisma.hrShift.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrShift.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found' });
      return ctx.prisma.hrShift.update({ where: { id: input.id }, data: { is_active: false } });
    }),

  assign: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        shift_id: z.string(),
        effective_from: z.string(),
        effective_to: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Close existing open assignment
      await ctx.prisma.hrShiftAssignment.updateMany({
        where: { employee_id: input.employee_id, effective_to: null },
        data: { effective_to: new Date(input.effective_from) },
      });
      return ctx.prisma.hrShiftAssignment.create({
        data: {
          employee_id: input.employee_id,
          shift_id: input.shift_id,
          effective_from: new Date(input.effective_from),
          effective_to: input.effective_to ? new Date(input.effective_to) : null,
          created_by: userId,
        },
      });
    }),

  listAssignments: protectedProcedure
    .input(z.object({ employee_id: z.string().optional(), shift_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.hrShiftAssignment.findMany({
        where: {
          ...(input.employee_id ? { employee_id: input.employee_id } : {}),
          ...(input.shift_id ? { shift_id: input.shift_id } : {}),
          effective_to: null,
        },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true, employee_code: true } },
          shift: { select: { id: true, name: true, color: true, start_time: true, end_time: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }),
});
