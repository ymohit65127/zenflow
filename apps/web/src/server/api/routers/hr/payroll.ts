import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// India statutory constants
// ---------------------------------------------------------------------------

const PF_MAX_BASIC = 15_000;
const PF_RATE = 0.12; // 12%
const ESI_GROSS_LIMIT = 21_000;
const ESI_EMPLOYEE_RATE = 0.0075; // 0.75%
const ESI_EMPLOYER_RATE = 0.0325; // 3.25%

// PT monthly slabs (MH example, simplified)
function computePT(gross: number): number {
  if (gross <= 7_500) return 0;
  if (gross <= 10_000) return 175;
  return 200;
}

// Annual TDS slabs (new regime simplified)
function computeAnnualTDS(annualBasic: number): number {
  let tax = 0;
  if (annualBasic <= 250_000) return 0;
  if (annualBasic <= 500_000) {
    tax = (annualBasic - 250_000) * 0.05;
  } else if (annualBasic <= 750_000) {
    tax = 12_500 + (annualBasic - 500_000) * 0.1;
  } else if (annualBasic <= 1_000_000) {
    tax = 37_500 + (annualBasic - 750_000) * 0.15;
  } else if (annualBasic <= 1_250_000) {
    tax = 75_000 + (annualBasic - 1_000_000) * 0.2;
  } else if (annualBasic <= 1_500_000) {
    tax = 125_000 + (annualBasic - 1_250_000) * 0.25;
  } else {
    tax = 187_500 + (annualBasic - 1_500_000) * 0.3;
  }
  return tax;
}

// ---------------------------------------------------------------------------
// Payroll computation for a single employee
// ---------------------------------------------------------------------------

interface SalaryComponent {
  name: string;
  code: string;
  type: 'fixed' | 'percentage' | 'formula';
  value: number;
  formula_base?: string;
  is_taxable: boolean;
  pf_eligible: boolean;
  esic_eligible: boolean;
  sort_order: number;
}

function computePayroll(ctc: number, components: SalaryComponent[]) {
  const annualCTC = ctc;
  const monthlyCTC = annualCTC / 12;

  let basic = 0;
  let hra = 0;
  let specialAllowance = 0;
  let otherAllowances = 0;
  const componentDetails: Record<string, number> = {};

  const sorted = [...components].sort((a, b) => a.sort_order - b.sort_order);

  for (const comp of sorted) {
    let amount = 0;
    if (comp.type === 'fixed') {
      amount = comp.value;
    } else if (comp.type === 'percentage') {
      // percentage of monthly CTC
      amount = (monthlyCTC * comp.value) / 100;
    } else if (comp.type === 'formula' && comp.formula_base === 'basic') {
      amount = (basic * comp.value) / 100;
    }

    componentDetails[comp.code] = Math.round(amount * 100) / 100;

    const code = comp.code.toUpperCase();
    if (code === 'BASIC') basic = amount;
    else if (code === 'HRA') hra = amount;
    else if (code === 'SPECIAL' || code === 'SA') specialAllowance = amount;
    else otherAllowances += amount;
  }

  const grossSalary = basic + hra + specialAllowance + otherAllowances;

  // PF: 12% of basic, max basic 15000
  const pfBasic = Math.min(basic, PF_MAX_BASIC);
  const pfEmployee = Math.round(pfBasic * PF_RATE * 100) / 100;
  const pfEmployer = pfEmployee;

  // ESI: only if gross <= 21000
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (grossSalary <= ESI_GROSS_LIMIT) {
    esiEmployee = Math.round(grossSalary * ESI_EMPLOYEE_RATE * 100) / 100;
    esiEmployer = Math.round(grossSalary * ESI_EMPLOYER_RATE * 100) / 100;
  }

  // PT
  const pt = computePT(grossSalary);

  // TDS: annual basic * 12, divide monthly TDS
  const annualBasic = basic * 12;
  const annualTDS = computeAnnualTDS(annualBasic);
  const tds = Math.round((annualTDS / 12) * 100) / 100;

  const totalDeductions = pfEmployee + esiEmployee + pt + tds;
  const netSalary = grossSalary - totalDeductions;

  return {
    basic: Math.round(basic * 100) / 100,
    hra: Math.round(hra * 100) / 100,
    special_allowance: Math.round(specialAllowance * 100) / 100,
    other_allowances: Math.round(otherAllowances * 100) / 100,
    gross_salary: Math.round(grossSalary * 100) / 100,
    pf_employee: pfEmployee,
    pf_employer: pfEmployer,
    esic_employee: esiEmployee,
    esic_employer: esiEmployer,
    pt,
    tds,
    total_deductions: Math.round(totalDeductions * 100) / 100,
    net_salary: Math.round(netSalary * 100) / 100,
    components: componentDetails,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const payrollRouter = createTRPCRouter({
  listPeriods: protectedProcedure
    .input(z.object({ year: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrPayrollPeriod.findMany({
        where: {
          organization_id: orgId,
          ...(input?.year ? { year: input.year } : {}),
        },
        include: { _count: { select: { entries: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
    }),

  getPeriod: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const period = await ctx.prisma.hrPayrollPeriod.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { _count: { select: { entries: true } } },
      });
      if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll period not found' });
      return period;
    }),

  createPeriod: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        period_type: z.enum(['monthly', 'semi_monthly', 'bi_weekly', 'weekly']).default('monthly'),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
        start_date: z.string(),
        end_date: z.string(),
        payment_date: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrPayrollPeriod.create({
        data: {
          organization_id: orgId,
          name: input.name,
          period_type: input.period_type,
          year: input.year,
          month: input.month,
          start_date: new Date(input.start_date),
          end_date: new Date(input.end_date),
          payment_date: new Date(input.payment_date),
          status: 'draft',
        },
      });
    }),

  processPayroll: protectedProcedure
    .input(z.object({ period_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const period = await ctx.prisma.hrPayrollPeriod.findFirst({
        where: { id: input.period_id, organization_id: orgId },
      });
      if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll period not found' });
      if (period.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payroll is not in draft status' });
      }

      // Mark as processing
      await ctx.prisma.hrPayrollPeriod.update({
        where: { id: input.period_id },
        data: { status: 'processing', processed_by: userId, processed_at: new Date() },
      });

      // Fetch all active employees with current salary
      const employees = await ctx.prisma.hrEmployee.findMany({
        where: { organization_id: orgId, deleted_at: null },
        include: {
          salary_revisions: {
            where: { effective_to: null },
            include: { structure: true },
            orderBy: { effective_from: 'desc' },
            take: 1,
          },
        },
      });

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      let count = 0;

      for (const emp of employees) {
        const revision = emp.salary_revisions[0];
        if (!revision) continue;

        const ctc = Number(revision.ctc);
        const components = revision.structure.components as unknown as SalaryComponent[];
        const computed = computePayroll(ctc, components);

        await ctx.prisma.hrPayrollEntry.upsert({
          where: { period_id_employee_id: { period_id: input.period_id, employee_id: emp.id } },
          update: {
            status: 'computed',
            working_days: 26,
            paid_days: 26,
            gross_salary: computed.gross_salary,
            basic: computed.basic,
            hra: computed.hra,
            special_allowance: computed.special_allowance,
            other_allowances: computed.other_allowances,
            pf_employee: computed.pf_employee,
            pf_employer: computed.pf_employer,
            esic_employee: computed.esic_employee,
            esic_employer: computed.esic_employer,
            pt: computed.pt,
            tds: computed.tds,
            total_deductions: computed.total_deductions,
            net_salary: computed.net_salary,
            components: computed.components,
            computed_at: new Date(),
          },
          create: {
            period_id: input.period_id,
            employee_id: emp.id,
            status: 'computed',
            working_days: 26,
            paid_days: 26,
            gross_salary: computed.gross_salary,
            basic: computed.basic,
            hra: computed.hra,
            special_allowance: computed.special_allowance,
            other_allowances: computed.other_allowances,
            pf_employee: computed.pf_employee,
            pf_employer: computed.pf_employer,
            esic_employee: computed.esic_employee,
            esic_employer: computed.esic_employer,
            pt: computed.pt,
            tds: computed.tds,
            total_deductions: computed.total_deductions,
            net_salary: computed.net_salary,
            components: computed.components,
            computed_at: new Date(),
          },
        });

        totalGross += computed.gross_salary;
        totalDeductions += computed.total_deductions;
        totalNet += computed.net_salary;
        count++;
      }

      return ctx.prisma.hrPayrollPeriod.update({
        where: { id: input.period_id },
        data: {
          status: 'approved',
          total_gross: totalGross,
          total_deductions: totalDeductions,
          total_net: totalNet,
          employee_count: count,
        },
      });
    }),

  approvePeriod: protectedProcedure
    .input(z.object({ period_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const period = await ctx.prisma.hrPayrollPeriod.findFirst({
        where: { id: input.period_id, organization_id: orgId },
      });
      if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll period not found' });
      if (period.status !== 'processing' && period.status !== 'approved') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payroll cannot be approved at this stage' });
      }

      return ctx.prisma.hrPayrollPeriod.update({
        where: { id: input.period_id },
        data: { status: 'approved', approved_by: userId, approved_at: new Date() },
      });
    }),

  markPaid: protectedProcedure
    .input(z.object({ period_id: z.string(), paid_at: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const period = await ctx.prisma.hrPayrollPeriod.findFirst({
        where: { id: input.period_id, organization_id: orgId },
      });
      if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payroll period not found' });

      return ctx.prisma.$transaction([
        ctx.prisma.hrPayrollPeriod.update({
          where: { id: input.period_id },
          data: { status: 'paid', paid_at: input.paid_at ? new Date(input.paid_at) : new Date() },
        }),
        ctx.prisma.hrPayrollEntry.updateMany({
          where: { period_id: input.period_id },
          data: { status: 'paid' },
        }),
      ]);
    }),

  listEntries: protectedProcedure
    .input(
      z.object({
        period_id: z.string(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const skip = (input.page - 1) * input.limit;

      const period = await ctx.prisma.hrPayrollPeriod.findFirst({
        where: { id: input.period_id, organization_id: orgId },
      });
      if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Period not found' });

      const where = {
        period_id: input.period_id,
        period: { organization_id: orgId },
        ...(input.search
          ? {
              OR: [
                { employee: { first_name: { contains: input.search, mode: 'insensitive' as const } } },
                { employee: { last_name: { contains: input.search, mode: 'insensitive' as const } } },
                { employee: { employee_code: { contains: input.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.hrPayrollEntry.findMany({
          where,
          include: {
            employee: {
              select: { id: true, first_name: true, last_name: true, employee_code: true, department_id: true },
            },
          },
          orderBy: { employee: { first_name: 'asc' } },
          skip,
          take: input.limit,
        }),
        ctx.prisma.hrPayrollEntry.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  getPayslip: protectedProcedure
    .input(z.object({ period_id: z.string(), employee_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const entry = await ctx.prisma.hrPayrollEntry.findFirst({
        where: {
          period_id: input.period_id,
          employee_id: input.employee_id,
          period: { organization_id: orgId },
        },
        include: {
          employee: true,
          period: true,
        },
      });
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip not found' });
      return entry;
    }),

  statutoryReport: protectedProcedure
    .input(z.object({ period_id: z.string(), type: z.enum(['pf', 'esic', 'pt', 'tds']) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const period = await ctx.prisma.hrPayrollPeriod.findFirst({
        where: { id: input.period_id, organization_id: orgId },
      });
      if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Period not found' });

      const entries = await ctx.prisma.hrPayrollEntry.findMany({
        where: { period_id: input.period_id, period: { organization_id: orgId } },
        include: {
          employee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              employee_code: true,
              uan_number: true,
              esic_number: true,
              pt_state: true,
            },
          },
        },
      });

      const summary = entries.reduce(
        (acc, e) => {
          acc.totalEmployees++;
          acc.totalPfEmployee += Number(e.pf_employee);
          acc.totalPfEmployer += Number(e.pf_employer);
          acc.totalEsiEmployee += Number(e.esic_employee);
          acc.totalEsiEmployer += Number(e.esic_employer);
          acc.totalPt += Number(e.pt);
          acc.totalTds += Number(e.tds);
          return acc;
        },
        {
          totalEmployees: 0,
          totalPfEmployee: 0,
          totalPfEmployer: 0,
          totalEsiEmployee: 0,
          totalEsiEmployer: 0,
          totalPt: 0,
          totalTds: 0,
        },
      );

      return { entries, summary, type: input.type };
    }),
});
