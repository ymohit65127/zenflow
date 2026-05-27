import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const leaveBalanceRouter = createTRPCRouter({
  getForEmployee: protectedProcedure
    .input(z.object({ employee_id: z.string(), year: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const emp = await ctx.prisma.hrEmployee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      return ctx.prisma.hrLeaveBalance.findMany({
        where: { employee_id: input.employee_id, year: input.year },
        include: { leave_type: { select: { id: true, name: true, code: true, color: true, paid_leave: true } } },
        orderBy: { leave_type: { position: 'asc' } },
      });
    }),

  getBulk: protectedProcedure
    .input(z.object({ year: z.number().int(), department_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrLeaveBalance.findMany({
        where: {
          year: input.year,
          employee: {
            organization_id: orgId,
            deleted_at: null,
            ...(input.department_id ? { department_id: input.department_id } : {}),
          },
        },
        include: {
          employee: {
            select: { id: true, first_name: true, last_name: true, employee_code: true },
          },
          leave_type: { select: { id: true, name: true, code: true, color: true } },
        },
        orderBy: [{ employee: { first_name: 'asc' } }, { leave_type: { position: 'asc' } }],
      });
    }),

  adjust: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        leave_type_id: z.string(),
        year: z.number().int(),
        adjustment: z.number(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const emp = await ctx.prisma.hrEmployee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      const existing = await ctx.prisma.hrLeaveBalance.findUnique({
        where: {
          employee_id_leave_type_id_year: {
            employee_id: input.employee_id,
            leave_type_id: input.leave_type_id,
            year: input.year,
          },
        },
      });

      if (!existing) {
        // Create with adjustment
        return ctx.prisma.hrLeaveBalance.create({
          data: {
            employee_id: input.employee_id,
            leave_type_id: input.leave_type_id,
            year: input.year,
            adjusted: input.adjustment,
            closing_balance: input.adjustment,
          },
        });
      }

      const newAdjusted = Number(existing.adjusted) + input.adjustment;
      const newClosing = Number(existing.opening_balance) + Number(existing.accrued) + newAdjusted + Number(existing.carry_forward) - Number(existing.taken);

      return ctx.prisma.hrLeaveBalance.update({
        where: {
          employee_id_leave_type_id_year: {
            employee_id: input.employee_id,
            leave_type_id: input.leave_type_id,
            year: input.year,
          },
        },
        data: { adjusted: newAdjusted, closing_balance: newClosing },
      });
    }),

  initializeYear: protectedProcedure
    .input(z.object({ year: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const [employees, leaveTypes] = await Promise.all([
        ctx.prisma.hrEmployee.findMany({
          where: { organization_id: orgId, deleted_at: null },
          select: { id: true },
        }),
        ctx.prisma.hrLeaveType.findMany({
          where: { organization_id: orgId, is_active: true },
          select: { id: true, max_balance: true, carry_forward_enabled: true, carry_forward_max: true },
        }),
      ]);

      let created = 0;
      for (const emp of employees) {
        for (const lt of leaveTypes) {
          const prevBalance = await ctx.prisma.hrLeaveBalance.findUnique({
            where: {
              employee_id_leave_type_id_year: {
                employee_id: emp.id,
                leave_type_id: lt.id,
                year: input.year - 1,
              },
            },
          });

          let carry_forward = 0;
          if (lt.carry_forward_enabled && prevBalance) {
            const available = Number(prevBalance.closing_balance);
            const maxCarry = Number(lt.carry_forward_max);
            carry_forward = Math.min(Math.max(0, available), maxCarry);
          }

          const opening = Number(lt.max_balance);
          await ctx.prisma.hrLeaveBalance.upsert({
            where: {
              employee_id_leave_type_id_year: {
                employee_id: emp.id,
                leave_type_id: lt.id,
                year: input.year,
              },
            },
            update: {},
            create: {
              employee_id: emp.id,
              leave_type_id: lt.id,
              year: input.year,
              opening_balance: opening,
              carry_forward,
              closing_balance: opening + carry_forward,
            },
          });
          created++;
        }
      }
      return { created };
    }),
});
