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

      const templates = await ctx.prisma.projectTemplate.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          ...(input.category ? { category: input.category } : {}),
        },
        orderBy: { created_at: 'desc' },
      });

      return templates.map((t) => ({
        ...t,
        template_data: t.config,
        creator: null as null,
        _count: { projects: 0 },
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const template = await ctx.prisma.projectTemplate.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      return { ...template, template_data: template.config };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.string().optional(),
        methodology: z
          .enum(['agile', 'waterfall', 'hybrid', 'kanban', 'scrum'])
          .default('agile'),
        templateData: TemplateDataSchema,
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const template = await ctx.prisma.projectTemplate.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          category: input.category ?? null,
          methodology: input.methodology,
          config: input.templateData,
          is_global: input.isPublic,
          created_by: userId,
        },
      });

      return { ...template, template_data: template.config };
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
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Load phases and milestones separately
      const phases = await ctx.prisma.projectPhase.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        orderBy: { position: 'asc' },
      });

      const milestones = await ctx.prisma.projectMilestone.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        orderBy: { due_date: 'asc' },
      });

      const tasks = await ctx.prisma.task.findMany({
        where: { project_id: input.projectId, deleted_at: null, parent_id: null },
        orderBy: { position: 'asc' },
        take: 50,
      });

      const startDate = project.start_date ?? new Date();

      const templateData = {
        phases: phases.map((p) => ({
          name: p.name,
          color: p.color ?? '#6B7280',
          position: p.position,
        })),
        statuses: [] as Array<{ name: string; color: string; statusType: string; isDefault: boolean; position: number }>,
        tasks: tasks.map((t) => ({
          title: t.title,
          phaseIndex: -1,
          taskType: t.type,
          priority: t.priority,
          estimatePoints: t.story_points ?? undefined,
        })),
        milestones: milestones.map((m) => ({
          name: m.name,
          color: '#F59E0B',
          dueDaysFromStart: Math.round(
            (m.due_date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
        })),
      };

      const template = await ctx.prisma.projectTemplate.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          category: null,
          methodology: 'agile',
          config: templateData,
          is_global: input.isPublic,
          created_by: userId,
        },
      });

      return { ...template, template_data: template.config };
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
          where: { id: input.templateId, organization_id: orgId, deleted_at: null },
        }),
        ctx.prisma.project.findFirst({
          where: { id: input.projectId, organization_id: orgId, deleted_at: null },
        }),
      ]);

      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const data = template.config as {
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
          if (!p) continue;
          const phase = await ctx.prisma.projectPhase.create({
            data: {
              project_id: input.projectId,
              organization_id: orgId,
              name: p.name,
              color: p.color,
              position: p.position,
              status: 'not_started',
            },
          });
          createdPhases.push({ id: phase.id, index: i });
        }
      }

      // Create milestones
      if (data.milestones?.length) {
        const startDate = project.start_date ?? new Date();
        await ctx.prisma.projectMilestone.createMany({
          data: data.milestones.map((m) => ({
            project_id: input.projectId,
            organization_id: orgId,
            name: m.name,
            due_date: new Date(startDate.getTime() + m.dueDaysFromStart * 24 * 60 * 60 * 1000),
            status: 'pending' as const,
            created_by: userId,
          })),
        });
      }

      return { success: true, phasesCreated: createdPhases.length };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const template = await ctx.prisma.projectTemplate.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });

      if (template.created_by !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the creator can delete a template' });
      }

      return ctx.prisma.projectTemplate.delete({ where: { id: input.id } });
    }),
});
