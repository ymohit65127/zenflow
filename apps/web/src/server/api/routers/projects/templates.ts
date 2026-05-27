// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const TemplateDataSchema = z.object({
  phases: z
    .array(z.object({ name: z.string(), color: z.string(), position: z.number() }))
    .optional(),
  statuses: z
    .array(
      z.object({
        name: z.string(),
        color: z.string(),
        statusType: z.string(),
        isDefault: z.boolean().optional(),
        position: z.number(),
      })
    )
    .optional(),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        phaseIndex: z.number().optional(),
        taskType: z.string().optional(),
        priority: z.string().optional(),
        estimatePoints: z.number().optional(),
      })
    )
    .optional(),
  milestones: z
    .array(
      z.object({ name: z.string(), dueDaysFromStart: z.number(), color: z.string() })
    )
    .optional(),
});

export const templatesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      return ctx.prisma.projectTemplate.findMany({
        where: {
          organization_id: orgId,
          ...(input.category ? { category: input.category } : {}),
        },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { projects: true } },
        },
        orderBy: [{ usage_count: 'desc' }, { created_at: 'desc' }],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const template = await ctx.prisma.projectTemplate.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      return template;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.string().optional(),
        methodology: z
          .enum(['agile', 'waterfall', 'hybrid', 'kanban'])
          .default('agile'),
        templateData: TemplateDataSchema,
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      return ctx.prisma.projectTemplate.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          category: input.category ?? null,
          methodology: input.methodology,
          template_data: input.templateData,
          is_public: input.isPublic,
          created_by: userId,
        },
      });
    }),

  createFromProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
        include: {
          phases: { orderBy: { position: 'asc' } },
          task_statuses: { orderBy: { position: 'asc' } },
          tasks: {
            where: { deleted_at: null, parent_task_id: null },
            orderBy: { position: 'asc' },
            take: 50,
          },
          milestones: { orderBy: { due_date: 'asc' } },
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const startDate = project.start_date ?? new Date();

      const templateData = {
        phases: project.phases.map((p) => ({
          name: p.name,
          color: p.color,
          position: p.position,
        })),
        statuses: project.task_statuses.map((s) => ({
          name: s.name,
          color: s.color,
          statusType: s.status_type,
          isDefault: s.is_default,
          position: s.position,
        })),
        tasks: project.tasks.map((t) => ({
          title: t.title,
          phaseIndex: project.phases.findIndex((p) => p.id === t.phase_id),
          taskType: t.task_type,
          priority: t.priority,
          estimatePoints: t.estimate_points ?? undefined,
        })),
        milestones: project.milestones.map((m) => ({
          name: m.name,
          color: m.color,
          dueDaysFromStart: Math.round(
            (m.due_date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
        })),
      };

      return ctx.prisma.projectTemplate.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          category: null,
          methodology: project.methodology ?? 'agile',
          template_data: templateData,
          is_public: input.isPublic,
          created_by: userId,
        },
      });
    }),

  applyToProject: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        projectId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const [template, project] = await Promise.all([
        ctx.prisma.projectTemplate.findFirst({
          where: { id: input.templateId, organization_id: orgId },
        }),
        ctx.prisma.project.findFirst({
          where: { id: input.projectId, organization_id: orgId, deleted_at: null },
        }),
      ]);

      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const data = template.template_data as {
        phases?: Array<{ name: string; color: string; position: number }>;
        statuses?: Array<{
          name: string;
          color: string;
          statusType: string;
          isDefault?: boolean;
          position: number;
        }>;
        milestones?: Array<{ name: string; color: string; dueDaysFromStart: number }>;
      };

      const createdPhases: Array<{ id: string; index: number }> = [];

      // Create phases (non-destructive: only if none exist)
      const existingPhaseCount = await ctx.prisma.projectPhase.count({
        where: { project_id: input.projectId },
      });

      if (existingPhaseCount === 0 && data.phases?.length) {
        for (let i = 0; i < data.phases.length; i++) {
          const p = data.phases[i];
          const phase = await ctx.prisma.projectPhase.create({
            data: {
              project_id: input.projectId,
              name: p.name,
              color: p.color,
              position: p.position,
              status: 'not_started',
            },
          });
          createdPhases.push({ id: phase.id, index: i });
        }
      }

      // Create statuses if none exist
      const existingStatusCount = await ctx.prisma.taskStatus.count({
        where: { project_id: input.projectId },
      });

      if (existingStatusCount === 0 && data.statuses?.length) {
        await ctx.prisma.taskStatus.createMany({
          data: data.statuses.map((s) => ({
            project_id: input.projectId,
            name: s.name,
            color: s.color,
            status_type: s.statusType as 'not_started' | 'in_progress' | 'done' | 'cancelled',
            is_default: s.isDefault ?? false,
            position: s.position,
          })),
        });
      }

      // Create milestones
      if (data.milestones?.length) {
        const startDate = project.start_date ?? new Date();
        await ctx.prisma.projectMilestone.createMany({
          data: data.milestones.map((m) => ({
            project_id: input.projectId,
            name: m.name,
            color: m.color,
            due_date: new Date(startDate.getTime() + m.dueDaysFromStart * 24 * 60 * 60 * 1000),
            status: 'pending' as const,
            notify_on_due: true,
            created_by: userId,
          })),
        });
      }

      // Increment usage count
      await ctx.prisma.projectTemplate.update({
        where: { id: input.templateId },
        data: { usage_count: { increment: 1 } },
      });

      return { success: true, phasesCreated: createdPhases.length };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const template = await ctx.prisma.projectTemplate.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });

      if (template.created_by !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the creator can delete a template' });
      }

      return ctx.prisma.projectTemplate.delete({ where: { id: input.id } });
    }),
});
