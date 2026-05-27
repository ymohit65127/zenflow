import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const departmentsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrDepartment.findMany({
      where: { organization_id: orgId, is_active: true },
      include: {
        _count: { select: { employees: { where: { deleted_at: null } } } },
        children: { select: { id: true, name: true, _count: { select: { employees: { where: { deleted_at: null } } } } } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const dept = await ctx.prisma.hrDepartment.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          _count: { select: { employees: { where: { deleted_at: null } } } },
          children: {
            include: {
              _count: { select: { employees: { where: { deleted_at: null } } } },
            },
          },
          parent: { select: { id: true, name: true } },
          employees: {
            where: { deleted_at: null },
            select: { id: true, first_name: true, last_name: true, designation_id: true },
            take: 20,
          },
        },
      });
      if (!dept) throw new TRPCError({ code: 'NOT_FOUND', message: 'Department not found' });
      return dept;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        parent_department_id: z.string().optional(),
        head_employee_id: z.string().optional(),
        cost_center_code: z.string().optional(),
        budget_amount: z.number().optional(),
        position: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrDepartment.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          parent_department_id: input.parent_department_id ?? null,
          head_employee_id: input.head_employee_id ?? null,
          cost_center_code: input.cost_center_code ?? null,
          budget_amount: input.budget_amount ?? null,
          position: input.position ?? 0,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        parent_department_id: z.string().optional().nullable(),
        head_employee_id: z.string().optional().nullable(),
        cost_center_code: z.string().optional().nullable(),
        budget_amount: z.number().optional().nullable(),
        position: z.number().optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.hrDepartment.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Department not found' });
      return ctx.prisma.hrDepartment.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrDepartment.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Department not found' });
      return ctx.prisma.hrDepartment.update({ where: { id: input.id }, data: { is_active: false } });
    }),

  orgTree: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const all = await ctx.prisma.hrDepartment.findMany({
      where: { organization_id: orgId, is_active: true },
      include: {
        _count: { select: { employees: { where: { deleted_at: null } } } },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    type DeptNode = (typeof all)[0] & { children: DeptNode[] };

    function buildTree(parentId: string | null): DeptNode[] {
      return all
        .filter((d) => d.parent_department_id === parentId)
        .map((d) => ({ ...d, children: buildTree(d.id) }));
    }

    return buildTree(null);
  }),
});
