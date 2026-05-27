import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const LeaveTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  color: z.string().default('#6366f1'),
  description: z.string().optional(),
  accrual_type: z.enum(['none', 'monthly', 'yearly', 'on_grant']).default('none'),
  accrual_amount: z.number().min(0).default(0),
  max_balance: z.number().min(0).default(30),
  carry_forward_enabled: z.boolean().default(false),
  carry_forward_max: z.number().min(0).default(0),
  encashment_enabled: z.boolean().default(false),
  encashment_max: z.number().min(0).default(0),
  applicable_gender: z.enum(['all', 'male', 'female']).default('all'),
  min_service_days: z.number().int().min(0).default(0),
  requires_document: z.boolean().default(false),
  min_days: z.number().min(0).default(0.5),
  max_consecutive_days: z.number().int().optional(),
  advance_notice_days: z.number().int().min(0).default(0),
  allow_negative: z.boolean().default(false),
  paid_leave: z.boolean().default(true),
  position: z.number().int().default(0),
});

export const leaveTypesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrLeaveType.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { _count: { select: { leave_requests: true } } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const lt = await ctx.prisma.hrLeaveType.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!lt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });
      return lt;
    }),

  create: protectedProcedure
    .input(LeaveTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrLeaveType.create({
        data: {
          organization_id: orgId,
          ...input,
          code: input.code.toUpperCase(),
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(LeaveTypeSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, code, ...rest } = input;
      const existing = await ctx.prisma.hrLeaveType.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });
      return ctx.prisma.hrLeaveType.update({
        where: { id },
        data: { ...rest, ...(code ? { code: code.toUpperCase() } : {}) },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrLeaveType.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });
      return ctx.prisma.hrLeaveType.update({ where: { id: input.id }, data: { is_active: false } });
    }),
});
