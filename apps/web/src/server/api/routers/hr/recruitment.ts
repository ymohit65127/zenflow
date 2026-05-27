// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const STAGES = [
  'applied', 'screening', 'phone_screen', 'interview_1', 'interview_2',
  'technical', 'hr', 'offer', 'hired', 'rejected', 'withdrawn',
] as const;

export const recruitmentRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Job Postings
  // ---------------------------------------------------------------------------
  listJobs: protectedProcedure
    .input(z.object({ status: z.enum(['draft', 'active', 'paused', 'closed']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrJobPosting.findMany({
        where: {
          organization_id: orgId,
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  getJob: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const job = await ctx.prisma.hrJobPosting.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
      });
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job posting not found' });
      return job;
    }),

  createJob: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        department_id: z.string().optional(),
        designation_id: z.string().optional(),
        location: z.string().optional(),
        job_type: z.enum(['full_time', 'part_time', 'contract', 'internship']).default('full_time'),
        experience_min: z.number().int().min(0).default(0),
        experience_max: z.number().int().optional(),
        salary_min: z.number().optional(),
        salary_max: z.number().optional(),
        currency: z.string().default('INR'),
        description: z.string().optional(),
        requirements: z.string().optional(),
        closes_at: z.string().optional(),
        openings: z.number().int().min(1).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;
      return ctx.prisma.hrJobPosting.create({
        data: {
          organization_id: orgId,
          title: input.title,
          department_id: input.department_id ?? null,
          designation_id: input.designation_id ?? null,
          location: input.location ?? null,
          job_type: input.job_type,
          experience_min: input.experience_min,
          experience_max: input.experience_max ?? null,
          salary_min: input.salary_min ?? null,
          salary_max: input.salary_max ?? null,
          currency: input.currency,
          description: input.description ?? null,
          requirements: input.requirements ?? null,
          closes_at: input.closes_at ? new Date(input.closes_at) : null,
          openings: input.openings,
          status: 'draft',
          created_by: userId,
        },
      });
    }),

  updateJob: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        department_id: z.string().optional().nullable(),
        designation_id: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
        job_type: z.enum(['full_time', 'part_time', 'contract', 'internship']).optional(),
        experience_min: z.number().int().min(0).optional(),
        experience_max: z.number().int().optional().nullable(),
        salary_min: z.number().optional().nullable(),
        salary_max: z.number().optional().nullable(),
        description: z.string().optional().nullable(),
        requirements: z.string().optional().nullable(),
        closes_at: z.string().optional().nullable(),
        openings: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, closes_at, ...rest } = input;
      const existing = await ctx.prisma.hrJobPosting.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job posting not found' });
      return ctx.prisma.hrJobPosting.update({
        where: { id },
        data: {
          ...rest,
          ...(closes_at !== undefined ? { closes_at: closes_at ? new Date(closes_at) : null } : {}),
        },
      });
    }),

  publishJob: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrJobPosting.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job posting not found' });
      return ctx.prisma.hrJobPosting.update({
        where: { id: input.id },
        data: { status: 'active', posted_at: new Date() },
      });
    }),

  closeJob: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrJobPosting.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job posting not found' });
      return ctx.prisma.hrJobPosting.update({ where: { id: input.id }, data: { status: 'closed' } });
    }),

  // ---------------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------------
  listApplications: protectedProcedure
    .input(
      z.object({
        job_id: z.string(),
        stage: z.enum(STAGES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.hrApplication.findMany({
        where: {
          job_id: input.job_id,
          ...(input.stage ? { stage: input.stage } : {}),
        },
        orderBy: [{ stage: 'asc' }, { created_at: 'desc' }],
      });
    }),

  getApplication: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const app = await ctx.prisma.hrApplication.findFirst({
        where: { id: input.id },
        include: { job: { select: { id: true, title: true, organization_id: true } } },
      });
      if (!app) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      const orgId = ctx.session.user.organizationId as string;
      if (app.job.organization_id !== orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      return app;
    }),

  createApplication: protectedProcedure
    .input(
      z.object({
        job_id: z.string(),
        candidate_name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        resume_url: z.string().optional(),
        linkedin_url: z.string().optional(),
        cover_letter: z.string().optional(),
        current_ctc: z.number().optional(),
        expected_ctc: z.number().optional(),
        notice_period_days: z.number().int().optional(),
        source: z.enum(['linkedin', 'naukri', 'indeed', 'referral', 'direct', 'other']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const job = await ctx.prisma.hrJobPosting.findFirst({ where: { id: input.job_id, organization_id: orgId } });
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job posting not found' });

      const app = await ctx.prisma.hrApplication.create({
        data: {
          job_id: input.job_id,
          candidate_name: input.candidate_name,
          email: input.email,
          phone: input.phone ?? null,
          resume_url: input.resume_url ?? null,
          linkedin_url: input.linkedin_url ?? null,
          cover_letter: input.cover_letter ?? null,
          current_ctc: input.current_ctc ?? null,
          expected_ctc: input.expected_ctc ?? null,
          notice_period_days: input.notice_period_days ?? null,
          source: input.source ?? null,
          stage: 'applied',
          stage_changed_at: new Date(),
        },
      });

      // Increment applications_count
      await ctx.prisma.hrJobPosting.update({
        where: { id: input.job_id },
        data: { applications_count: { increment: 1 } },
      });

      return app;
    }),

  moveStage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        stage: z.enum(STAGES),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.prisma.hrApplication.findFirst({
        where: { id: input.id },
        include: { job: { select: { organization_id: true } } },
      });
      if (!app) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      const orgId = ctx.session.user.organizationId as string;
      if (app.job.organization_id !== orgId) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.prisma.hrApplication.update({
        where: { id: input.id },
        data: { stage: input.stage, stage_changed_at: new Date() },
      });
    }),

  rejectApplication: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.hrApplication.update({
        where: { id: input.id },
        data: { stage: 'rejected', rejection_reason: input.reason, stage_changed_at: new Date() },
      });
    }),

  scoreApplication: protectedProcedure
    .input(z.object({ id: z.string(), score: z.number().int().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.hrApplication.update({ where: { id: input.id }, data: { score: input.score } });
    }),

  hireToEmployee: protectedProcedure
    .input(
      z.object({
        application_id: z.string(),
        join_date: z.string(),
        department_id: z.string(),
        designation_id: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const app = await ctx.prisma.hrApplication.findFirst({
        where: { id: input.application_id },
        include: { job: { select: { title: true, organization_id: true } } },
      });
      if (!app) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      if (app.job.organization_id !== orgId) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.prisma.$transaction(async (tx) => {
        // Generate employee code
        const last = await tx.hrEmployee.findFirst({
          where: { organization_id: orgId },
          orderBy: { employee_code: 'desc' },
          select: { employee_code: true },
        });
        const num = last ? parseInt(last.employee_code.replace(/\D/g, ''), 10) : 0;
        const employee_code = `EMP${String(isNaN(num) ? 1 : num + 1).padStart(3, '0')}`;

        const [firstName, ...rest] = app.candidate_name.split(' ');
        const lastName = rest.join(' ') || '-';

        const emp = await tx.hrEmployee.create({
          data: {
            organization_id: orgId,
            employee_code,
            first_name: firstName,
            last_name: lastName,
            email: app.email,
            mobile: app.phone ?? null,
            department_id: input.department_id,
            designation_id: input.designation_id ?? null,
            join_date: new Date(input.join_date),
            lifecycle_stage: 'onboarding',
          },
        });

        await tx.hrApplication.update({
          where: { id: input.application_id },
          data: { stage: 'hired', stage_changed_at: new Date() },
        });

        return emp;
      });
    }),
});
