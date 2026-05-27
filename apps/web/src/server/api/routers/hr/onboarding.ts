import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const TaskTemplateItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  assignee_role: z.enum(['hr', 'manager', 'it', 'employee']),
  due_after_days: z.number().int().min(0),
  is_required: z.boolean().default(true),
  description: z.string().optional(),
});

export const onboardingRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.hrOnboardingTemplate.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { _count: { select: { onboarding_tasks: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  getTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const t = await ctx.prisma.hrOnboardingTemplate.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!t) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      return t;
    }),

  createTemplate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        tasks: z.array(TaskTemplateItemSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;
      return ctx.prisma.hrOnboardingTemplate.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          tasks: input.tasks,
          created_by: userId,
        },
      });
    }),

  updateTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        tasks: z.array(TaskTemplateItemSchema).optional(),
        is_active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.hrOnboardingTemplate.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      return ctx.prisma.hrOnboardingTemplate.update({ where: { id }, data });
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrOnboardingTemplate.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      return ctx.prisma.hrOnboardingTemplate.update({ where: { id: input.id }, data: { is_active: false } });
    }),

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------
  listTasks: protectedProcedure
    .input(
      z.object({
        employee_id: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrOnboardingTask.findMany({
        where: {
          employee: { organization_id: orgId },
          ...(input?.employee_id ? { employee_id: input.employee_id } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          employee: { select: { id: true, first_name: true, last_name: true } },
          template: { select: { id: true, name: true } },
        },
        orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
      });
    }),

  assignTemplate: protectedProcedure
    .input(
      z.object({
        employee_id: z.string(),
        template_id: z.string(),
        start_date: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const emp = await ctx.prisma.hrEmployee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      const template = await ctx.prisma.hrOnboardingTemplate.findFirst({
        where: { id: input.template_id, organization_id: orgId },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });

      const startDate = new Date(input.start_date);
      const tasks = template.tasks as Array<{
        id: string;
        title: string;
        category: string;
        assignee_role: string;
        due_after_days: number;
        is_required: boolean;
        description?: string;
      }>;

      const created = await ctx.prisma.$transaction(
        tasks.map((task) => {
          const due = new Date(startDate);
          due.setDate(due.getDate() + task.due_after_days);
          return ctx.prisma.hrOnboardingTask.create({
            data: {
              employee_id: input.employee_id,
              template_id: input.template_id,
              template_task_id: task.id,
              title: task.title,
              category: task.category,
              due_date: due,
              status: 'pending',
              notes: task.description ?? null,
            },
          });
        }),
      );

      return { created: created.length };
    }),

  updateTask: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
        notes: z.string().optional().nullable(),
        assignee_id: z.string().optional().nullable(),
        due_date: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, status, due_date, ...rest } = input;
      return ctx.prisma.hrOnboardingTask.update({
        where: { id },
        data: {
          ...rest,
          ...(status ? { status, ...(status === 'completed' ? { completed_at: new Date() } : {}) } : {}),
          ...(due_date !== undefined ? { due_date: due_date ? new Date(due_date) : null } : {}),
        },
      });
    }),

  getEmployeeProgress: protectedProcedure
    .input(z.object({ employee_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const emp = await ctx.prisma.hrEmployee.findFirst({
        where: { id: input.employee_id, organization_id: orgId, deleted_at: null },
      });
      if (!emp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

      const tasks = await ctx.prisma.hrOnboardingTask.findMany({
        where: { employee_id: input.employee_id },
        orderBy: [{ due_date: 'asc' }, { category: 'asc' }],
      });

      const total = tasks.length;
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { tasks, total, completed, progress };
    }),
});
