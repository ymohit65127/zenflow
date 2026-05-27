import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ─── Workflows v2 Sub-routers ─────────────────────────────────────────────────
import { workflowRunsRouter } from './workflows/runs';
import { workflowTemplatesRouter } from './workflows/templates';
import { workflowApprovalsRouter } from './workflows/approvals';
import { workflowWebhooksRouter } from './workflows/webhooks';
import { workflowIntegrationsRouter } from './workflows/integrations';

// ─────────────────────────────────────────────────────────────────────────────
// v1 Sub-routers (kept for backwards compatibility)
// ─────────────────────────────────────────────────────────────────────────────

const runsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.workflowId, organization_id: orgId },
        select: { id: true },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      return ctx.prisma.workflowRun.findMany({
        where: { workflow_id: input.workflowId },
        orderBy: { started_at: 'desc' },
        take: 100,
      });
    }),
});

const stepsRouter = createTRPCRouter({
  save: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        steps: z.array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            type: z.enum([
              'CONDITION',
              'ACTION_EMAIL',
              'ACTION_WEBHOOK',
              'ACTION_CREATE_RECORD',
              'ACTION_UPDATE_RECORD',
              'ACTION_ASSIGN',
              'ACTION_NOTIFY',
              'ACTION_DELAY',
              'ACTION_API_CALL',
            ]),
            config: z.record(z.unknown()).default({}),
            sort_order: z.number().default(0),
            parent_id: z.string().nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.workflowId, organization_id: orgId },
        select: { id: true },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });

      // Delete old steps and re-insert
      await ctx.prisma.workflowStep.deleteMany({
        where: { workflow_id: input.workflowId },
      });

      const created = await ctx.prisma.workflowStep.createMany({
        data: input.steps.map((s) => ({
          workflow_id: input.workflowId,
          name: s.name,
          type: s.type,
          config: s.config as object,
          sort_order: s.sort_order,
          parent_id: s.parent_id ?? null,
        })),
      });

      return { count: created.count };
    }),
});

const integrationsRouter = createTRPCRouter({
  list: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.integration.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });
  }),

  connect: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        name: z.string(),
        credentials: z.record(z.unknown()).optional(),
        settings: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.integration.upsert({
        where: {
          // Use a composite-based approach: check existing
          id: (
            await ctx.prisma.integration.findFirst({
              where: { organization_id: orgId, provider: input.provider },
              select: { id: true },
            })
          )?.id ?? 'new',
        },
        create: {
          organization_id: orgId,
          provider: input.provider,
          name: input.name,
          status: 'ACTIVE',
          credentials: (input.credentials ?? {}) as object,
          settings: (input.settings ?? {}) as object,
        },
        update: {
          name: input.name,
          status: 'ACTIVE',
          credentials: (input.credentials ?? {}) as object,
          settings: (input.settings ?? {}) as object,
          last_sync_at: new Date(),
        },
      });
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const integration = await ctx.prisma.integration.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!integration) throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found' });
      return ctx.prisma.integration.update({
        where: { id: input.id },
        data: { status: 'DISCONNECTED' },
      });
    }),
});

const webhooksRouter = createTRPCRouter({
  list: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.webhook.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        secret: z.string().optional(),
        events: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.webhook.create({
        data: {
          organization_id: orgId,
          url: input.url,
          secret: input.secret ?? null,
          events: input.events,
          is_active: true,
        },
      });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Main workflows router
// ─────────────────────────────────────────────────────────────────────────────

export const workflowsRouter = createTRPCRouter({
  // v1 Nested routers (legacy)
  runs: runsRouter,
  steps: stepsRouter,
  integrations: integrationsRouter,
  webhooks: webhooksRouter,

  // ── Workflows v2 ────────────────────────────────────────────────────────────
  runsV2: workflowRunsRouter,
  templates: workflowTemplatesRouter,
  approvals: workflowApprovalsRouter,
  webhooksV2: workflowWebhooksRouter,
  integrationsV2: workflowIntegrationsRouter,

  list: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.workflow.findMany({
      where: { organization_id: orgId, status: { not: 'ARCHIVED' } },
      include: {
        creator: { select: { id: true, name: true, avatar_url: true } },
        _count: { select: { steps: true, runs: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          steps: { orderBy: { sort_order: 'asc' } },
          runs: { orderBy: { started_at: 'desc' }, take: 5 },
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      return workflow;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        trigger_type: z.enum([
          'SCHEDULE',
          'WEBHOOK',
          'RECORD_CREATED',
          'RECORD_UPDATED',
          'RECORD_DELETED',
          'FIELD_CHANGED',
          'FORM_SUBMITTED',
          'EMAIL_RECEIVED',
          'MANUAL',
        ]),
        trigger_config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.workflow.create({
        data: {
          organization_id: orgId,
          creator_id: userId,
          name: input.name,
          description: input.description ?? null,
          trigger_type: input.trigger_type,
          trigger_config: (input.trigger_config ?? {}) as object,
          status: 'DRAFT',
          is_active: false,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        trigger_config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      return ctx.prisma.workflow.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.trigger_config !== undefined
            ? { trigger_config: input.trigger_config as object }
            : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      return ctx.prisma.workflow.update({
        where: { id: input.id },
        data: { status: 'ARCHIVED', is_active: false },
      });
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      return ctx.prisma.workflow.update({
        where: { id: input.id },
        data: { status: 'ACTIVE', is_active: true },
      });
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      return ctx.prisma.workflow.update({
        where: { id: input.id },
        data: { status: 'PAUSED', is_active: false },
      });
    }),

  trigger: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });

      const now = new Date();
      const run = await ctx.prisma.workflowRun.create({
        data: {
          workflow_id: input.id,
          status: 'RUNNING',
          trigger_data: { triggered_by: 'manual', triggered_at: now.toISOString() } as object,
          started_at: now,
        },
      });

      // Immediately mark as COMPLETED (demo)
      const completed = await ctx.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          result_data: { steps_executed: workflow.run_count, message: 'Manual run completed successfully' } as object,
        },
      });

      // Increment run_count + last_run_at
      await ctx.prisma.workflow.update({
        where: { id: input.id },
        data: {
          run_count: { increment: 1 },
          last_run_at: now,
        },
      });

      return completed;
    }),

  stats: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, active, paused, runsToday, totalRuns] = await Promise.all([
      ctx.prisma.workflow.count({
        where: { organization_id: orgId, status: { not: 'ARCHIVED' } },
      }),
      ctx.prisma.workflow.count({
        where: { organization_id: orgId, status: 'ACTIVE' },
      }),
      ctx.prisma.workflow.count({
        where: { organization_id: orgId, status: 'PAUSED' },
      }),
      ctx.prisma.workflowRun.count({
        where: {
          workflow: { organization_id: orgId },
          started_at: { gte: today },
        },
      }),
      ctx.prisma.workflowRun.count({
        where: { workflow: { organization_id: orgId } },
      }),
    ]);

    return { total, active, paused, runsToday, totalRuns };
  }),
});
