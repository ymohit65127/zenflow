import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const ComponentSchema = z.object({
  name: z.string(),
  code: z.string(),
  type: z.enum(['fixed', 'percentage', 'formula']),
  value: z.number(),
  formula_base: z.string().optional(),
  is_taxable: z.boolean().default(true),
  pf_eligible: z.boolean().default(false),
  esic_eligible: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const salaryStructureRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrSalaryStructure.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { _count: { select: { salary_revisions: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const s = await ctx.prisma.hrSalaryStructure.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!s) throw new TRPCError({ code: 'NOT_FOUND', message: 'Salary structure not found' });
      return s;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        effective_from: z.string(),
        components: z.array(ComponentSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrSalaryStructure.create({
        data: {
          organization_id: orgId,
          name: input.name,
          effective_from: new Date(input.effective_from),
          components: input.components,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        effective_from: z.string().optional(),
        components: z.array(ComponentSchema).optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, effective_from, ...rest } = input;
      const existing = await ctx.prisma.hrSalaryStructure.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Salary structure not found' });
      return ctx.prisma.hrSalaryStructure.update({
        where: { id },
        data: {
          ...rest,
          ...(effective_from ? { effective_from: new Date(effective_from) } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrSalaryStructure.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Salary structure not found' });
      return ctx.prisma.hrSalaryStructure.update({ where: { id: input.id }, data: { is_active: false } });
    }),

  assignToEmployee: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        structure_id: z.string(),
        ctc: z.number().positive(),
        effective_from: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const emp = await ctx.prisma.hrEmployee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      return ctx.prisma.$transaction(async (tx) => {
        // Close existing open revision
        await tx.hrEmployeeSalary.updateMany({
          where: { employee_id: input.employee_id, effective_to: null },
          data: { effective_to: new Date(input.effective_from) },
        });
        return tx.hrEmployeeSalary.create({
          data: {
            employee_id: input.employee_id,
            structure_id: input.structure_id,
            ctc: input.ctc,
            effective_from: new Date(input.effective_from),
            created_by: userId,
          },
        });
      });
    }),

  getEmployeeSalary: protectedProcedure
    .input(z.object({ employee_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const emp = await ctx.prisma.hrEmployee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      return ctx.prisma.hrEmployeeSalary.findFirst({
        where: { employee_id: input.employee_id, effective_to: null },
        include: { structure: true },
        orderBy: { effective_from: 'desc' },
      });
    }),
});
