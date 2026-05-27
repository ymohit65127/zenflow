import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const leaveRequestsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        employee_id: z.string().optional(),
        leave_type_id: z.string().optional(),
        status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'withdrawn']).optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const skip = (input.page - 1) * input.limit;

      const where = {
        org_id: orgId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.employee_id ? { employee_id: input.employee_id } : {}),
        ...(input.leave_type_id ? { leave_type_id: input.leave_type_id } : {}),
        ...(input.from_date || input.to_date
          ? {
              start_date: {
                ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.hrLeaveRequest.findMany({
          where,
          include: {
            employee: { select: { id: true, first_name: true, last_name: true, employee_code: true } },
            leave_type: { select: { id: true, name: true, code: true, color: true, paid_leave: true } },
            approvals: {
              include: { approver: { select: { id: true, first_name: true, last_name: true } } },
              orderBy: { level: 'asc' },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.hrLeaveRequest.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const req = await ctx.prisma.hrLeaveRequest.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true, employee_code: true } },
          leave_type: true,
          approvals: {
            include: { approver: { select: { id: true, first_name: true, last_name: true } } },
            orderBy: { level: 'asc' },
          },
        },
      });
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      return req;
    }),

  apply: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        leave_type_id: z.string(),
        start_date: z.string(),
        end_date: z.string(),
        start_day_type: z.enum(['full', 'first_half', 'second_half']).default('full'),
        end_day_type: z.enum(['full', 'first_half', 'second_half']).default('full'),
        total_days: z.number().positive(),
        reason: z.string().optional(),
        document_url: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const emp = await ctx.prisma.hrEmployee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      const leaveType = await ctx.prisma.hrLeaveType.findFirst({
        where: { id: input.leave_type_id, organization_id: orgId },
      });
      if (!leaveType) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });

      const year = new Date(input.start_date).getFullYear();

      // Check balance
      if (!leaveType.allow_negative) {
        const balance = await ctx.prisma.hrLeaveBalance.findUnique({
          where: {
            employee_id_leave_type_id_year: {
              employee_id: input.employee_id,
              leave_type_id: input.leave_type_id,
              year,
            },
          },
        });
        if (!balance || Number(balance.closing_balance) < input.total_days) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient leave balance' });
        }
      }

      return ctx.prisma.hrLeaveRequest.create({
        data: {
          org_id: orgId,
          employee_id: input.employee_id,
          leave_type_id: input.leave_type_id,
          start_date: new Date(input.start_date),
          end_date: new Date(input.end_date),
          start_day_type: input.start_day_type,
          end_day_type: input.end_day_type,
          total_days: input.total_days,
          reason: input.reason ?? null,
          document_url: input.document_url ?? null,
          status: 'pending',
        },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true } },
          leave_type: { select: { id: true, name: true, code: true } },
        },
      });
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string(), remarks: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const request = await ctx.prisma.hrLeaveRequest.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      if (request.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending requests can be approved' });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.hrLeaveRequest.update({
          where: { id: input.id },
          data: {
            status: 'approved',
            approved_by: userId,
            approved_at: new Date(),
            balance_deducted: true,
          },
        });

        // Deduct balance
        const year = new Date(request.start_date).getFullYear();
        await tx.hrLeaveBalance.updateMany({
          where: {
            employee_id: request.employee_id,
            leave_type_id: request.leave_type_id,
            year,
          },
          data: {
            taken: { increment: Number(request.total_days) },
            closing_balance: { decrement: Number(request.total_days) },
          },
        });

        return updated;
      });
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const request = await ctx.prisma.hrLeaveRequest.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      if (request.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending requests can be rejected' });
      }

      return ctx.prisma.hrLeaveRequest.update({
        where: { id: input.id },
        data: { status: 'rejected', rejected_by: userId, rejected_reason: input.reason },
      });
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const request = await ctx.prisma.hrLeaveRequest.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.hrLeaveRequest.update({
          where: { id: input.id },
          data: { status: 'cancelled', cancelled_at: new Date() },
        });

        // Restore balance if already approved and deducted
        if (request.status === 'approved' && request.balance_deducted) {
          const year = new Date(request.start_date).getFullYear();
          await tx.hrLeaveBalance.updateMany({
            where: {
              employee_id: request.employee_id,
              leave_type_id: request.leave_type_id,
              year,
            },
            data: {
              taken: { decrement: Number(request.total_days) },
              closing_balance: { increment: Number(request.total_days) },
            },
          });
        }

        return updated;
      });
    }),

  teamCalendar: protectedProcedure
    .input(
      z.object({
        month: z.number().int().min(1).max(12),
        year: z.number().int(),
        department_id: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const start = new Date(input.year, input.month - 1, 1);
      const end = new Date(input.year, input.month, 0);

      return ctx.prisma.hrLeaveRequest.findMany({
        where: {
          org_id: orgId,
          status: 'approved',
          start_date: { lte: end },
          end_date: { gte: start },
          ...(input.department_id
            ? { employee: { department_id: input.department_id } }
            : {}),
        },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true, department_id: true } },
          leave_type: { select: { id: true, name: true, code: true, color: true } },
        },
        orderBy: { start_date: 'asc' },
      });
    }),

  pendingCount: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrLeaveRequest.count({ where: { org_id: orgId, status: 'pending' } });
  }),
});
