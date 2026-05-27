import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma as _prismaInstance } from '@zenflow/db';

type PrismaInstance = typeof _prismaInstance;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateEmployeeCode(prisma: PrismaInstance, orgId: string): Promise<string> {
  const last = await prisma.employee.findFirst({
    where: { organization_id: orgId },
    orderBy: { employee_code: 'desc' },
    select: { employee_code: true },
  });
  if (!last) return 'EMP001';
  const num = parseInt(last.employee_code.replace(/\D/g, ''), 10);
  return `EMP${String(isNaN(num) ? 1 : num + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

const employeesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        department_id: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const skip = (input.page - 1) * input.limit;

      const where = {
        organization_id: orgId,
        deleted_at: null,
        ...(input.status ? { status: input.status } : {}),
        ...(input.department_id ? { department_id: input.department_id } : {}),
        ...(input.search
          ? {
              OR: [
                { first_name: { contains: input.search, mode: 'insensitive' as const } },
                { last_name: { contains: input.search, mode: 'insensitive' as const } },
                { email: { contains: input.search, mode: 'insensitive' as const } },
                { employee_code: { contains: input.search, mode: 'insensitive' as const } },
                { designation: { contains: input.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.employee.findMany({
          where,
          include: { department: { select: { id: true, name: true } } },
          orderBy: { created_at: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.employee.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const employee = await ctx.prisma.employee.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          department: { select: { id: true, name: true } },
          leave_requests: {
            include: { leave_type: { select: { id: true, name: true, code: true } } },
            orderBy: { created_at: 'desc' },
            take: 10,
          },
          attendances: { orderBy: { date: 'desc' }, take: 30 },
        },
      });
      if (!employee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });
      return employee;
    }),

  create: protectedProcedure
    .input(
      z.object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        department_id: z.string().optional(),
        manager_id: z.string().optional(),
        date_of_birth: z.string().optional(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
        join_date: z.string(),
        employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERN']).default('FULL_TIME'),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).default('ACTIVE'),
        position: z.string().optional(),
        designation: z.string().optional(),
        salary: z.number().optional(),
        currency: z.string().default('USD'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const employee_code = await generateEmployeeCode(ctx.prisma, orgId);

      return ctx.prisma.employee.create({
        data: {
          organization_id: orgId,
          employee_code,
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone ?? null,
          department_id: input.department_id ?? null,
          manager_id: input.manager_id ?? null,
          date_of_birth: input.date_of_birth ? new Date(input.date_of_birth) : null,
          gender: input.gender ?? null,
          join_date: new Date(input.join_date),
          employment_type: input.employment_type,
          status: input.status,
          position: input.position ?? null,
          designation: input.designation ?? null,
          salary: input.salary ?? null,
          currency: input.currency,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        first_name: z.string().min(1).optional(),
        last_name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().nullable(),
        department_id: z.string().optional().nullable(),
        manager_id: z.string().optional().nullable(),
        date_of_birth: z.string().optional().nullable(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional().nullable(),
        join_date: z.string().optional(),
        employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERN']).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
        position: z.string().optional().nullable(),
        designation: z.string().optional().nullable(),
        salary: z.number().optional().nullable(),
        currency: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, date_of_birth, join_date, ...rest } = input;

      const existing = await ctx.prisma.employee.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      return ctx.prisma.employee.update({
        where: { id },
        data: {
          ...rest,
          ...(date_of_birth !== undefined ? { date_of_birth: date_of_birth ? new Date(date_of_birth) : null } : {}),
          ...(join_date ? { join_date: new Date(join_date) } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.employee.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });
      return ctx.prisma.employee.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, onLeave, newThisMonth] = await Promise.all([
      ctx.prisma.employee.count({ where: { organization_id: orgId, deleted_at: null } }),
      ctx.prisma.employee.count({ where: { organization_id: orgId, deleted_at: null, status: 'ACTIVE' } }),
      ctx.prisma.employee.count({ where: { organization_id: orgId, deleted_at: null, status: 'ON_LEAVE' } }),
      ctx.prisma.employee.count({
        where: { organization_id: orgId, deleted_at: null, created_at: { gte: startOfMonth } },
      }),
    ]);

    return { total, active, onLeave, newThisMonth };
  }),
});

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const departmentsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.department.findMany({
      where: { organization_id: orgId },
      include: {
        _count: { select: { employees: { where: { deleted_at: null } } } },
        children: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        parent_id: z.string().optional(),
        manager_id: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.department.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          parent_id: input.parent_id ?? null,
          manager_id: input.manager_id ?? null,
        },
      });
    }),
});

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

const leaveRouter = createTRPCRouter({
  types: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.leaveType.findMany({
      where: { organization_id: orgId },
      orderBy: { name: 'asc' },
    });
  }),

  createType: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        days_allowed: z.number().positive(),
        is_paid: z.boolean().default(true),
        carry_forward: z.boolean().default(false),
        max_carry_days: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.leaveType.create({
        data: {
          organization_id: orgId,
          name: input.name,
          code: input.code.toUpperCase(),
          days_allowed: input.days_allowed,
          is_paid: input.is_paid,
          carry_forward: input.carry_forward,
          max_carry_days: input.max_carry_days,
        },
      });
    }),

  requests: protectedProcedure
    .input(
      z.object({
        employee_id: z.string().optional(),
        leave_type_id: z.string().optional(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
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
        employee: { organization_id: orgId },
        ...(input.status ? { status: input.status } : {}),
        ...(input.employee_id ? { employee_id: input.employee_id } : {}),
        ...(input.leave_type_id ? { leave_type_id: input.leave_type_id } : {}),
        ...(input.from_date || input.to_date
          ? {
              from_date: {
                ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.leaveRequest.findMany({
          where,
          include: {
            employee: { select: { id: true, first_name: true, last_name: true, employee_code: true, designation: true } },
            leave_type: { select: { id: true, name: true, code: true, is_paid: true } },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.leaveRequest.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  apply: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        leave_type_id: z.string(),
        from_date: z.string(),
        to_date: z.string(),
        days: z.number().positive(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const employee = await ctx.prisma.employee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!employee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      return ctx.prisma.leaveRequest.create({
        data: {
          employee_id: input.employee_id,
          user_id: userId,
          leave_type_id: input.leave_type_id,
          from_date: new Date(input.from_date),
          to_date: new Date(input.to_date),
          days: input.days,
          reason: input.reason,
          status: 'PENDING',
        },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true } },
          leave_type: { select: { id: true, name: true, code: true } },
        },
      });
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const request = await ctx.prisma.leaveRequest.findFirst({
        where: { id: input.id, employee: { organization_id: orgId } },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending requests can be approved' });
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const req = await tx.leaveRequest.update({
          where: { id: input.id },
          data: { status: 'APPROVED', approved_by: userId, approved_at: new Date() },
        });
        await tx.employee.update({
          where: { id: request.employee_id },
          data: { status: 'ON_LEAVE' },
        });
        return req;
      });

      return updated;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const request = await ctx.prisma.leaveRequest.findFirst({
        where: { id: input.id, employee: { organization_id: orgId } },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending requests can be rejected' });
      }

      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: { status: 'REJECTED', rejected_reason: input.reason },
      });
    }),
});

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

const attendanceRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        employee_id: z.string().optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND']).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const skip = (input.page - 1) * input.limit;

      const where = {
        employee: { organization_id: orgId },
        ...(input.employee_id ? { employee_id: input.employee_id } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.from_date || input.to_date
          ? {
              date: {
                ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.attendance.findMany({
          where,
          include: {
            employee: {
              select: { id: true, first_name: true, last_name: true, employee_code: true, designation: true },
            },
          },
          orderBy: { date: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.attendance.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  markToday: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        action: z.enum(['CHECK_IN', 'CHECK_OUT']),
        status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND']).default('PRESENT'),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const employee = await ctx.prisma.employee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!employee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      const existing = await ctx.prisma.attendance.findUnique({
        where: { employee_id_date: { employee_id: input.employee_id, date: today } },
      });

      if (!existing) {
        return ctx.prisma.attendance.create({
          data: {
            employee_id: input.employee_id,
            date: today,
            check_in: input.action === 'CHECK_IN' ? now : null,
            check_out: input.action === 'CHECK_OUT' ? now : null,
            status: input.status,
            notes: input.notes ?? null,
          },
        });
      }

      const updateData: Record<string, unknown> = { notes: input.notes };
      if (input.action === 'CHECK_IN') updateData.check_in = now;
      if (input.action === 'CHECK_OUT') {
        updateData.check_out = now;
        if (existing.check_in) {
          const hours = (now.getTime() - existing.check_in.getTime()) / 3_600_000;
          updateData.hours_worked = Math.round(hours * 100) / 100;
        }
      }

      return ctx.prisma.attendance.update({
        where: { employee_id_date: { employee_id: input.employee_id, date: today } },
        data: updateData,
      });
    }),
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const hrRouter = createTRPCRouter({
  employees: employeesRouter,
  departments: departmentsRouter,
  leave: leaveRouter,
  attendance: attendanceRouter,
});
