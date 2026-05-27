// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const workflowTemplatesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.workflowTemplate.findMany({
        where: {
          is_published: true,
          OR: [
            { org_id: null },       // global templates
            { org_id: orgId },      // org-specific templates
          ],
          ...(input.category ? { category: input.category } : {}),
          ...(input.difficulty ? { difficulty: input.difficulty } : {}),
          ...(input.search
            ? {
                OR: [
                  { name: { contains: input.search, mode: 'insensitive' as const } },
                  { description: { contains: input.search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ install_count: 'desc' }, { created_at: 'desc' }],
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const template = await ctx.prisma.workflowTemplate.findFirst({
        where: {
          id: input.id,
          is_published: true,
          OR: [{ org_id: null }, { org_id: orgId }],
        },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });
      return template;
    }),

  install: protectedProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      name: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const template = await ctx.prisma.workflowTemplate.findFirst({
        where: {
          id: input.templateId,
          is_published: true,
          OR: [{ org_id: null }, { org_id: orgId }],
        },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      // Determine trigger_type from first trigger node
      const nodes = template.nodes as Array<{ type: string; config: Record<string, unknown> }>;
      const triggerNode = nodes.find((n) => n.type.startsWith('trigger_'));
      const triggerType = triggerNode?.type.replace('trigger_', '') as 'event' | 'schedule' | 'webhook' | 'manual' | 'api' ?? 'manual';

      // Create workflow from template
      const workflow = await ctx.prisma.workflow.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          name: input.name,
          description: template.description ?? null,
          trigger_type: triggerType,
          trigger_config: triggerNode?.config ?? {},
          status: 'draft',
          version: 1,
          nodes: template.nodes as object,
          edges: template.edges as object,
          error_handling: 'stop',
          max_retries: 3,
          timeout_minutes: 30,
        },
      });

      // Increment install count
      await ctx.prisma.workflowTemplate.update({
        where: { id: input.templateId },
        data: { install_count: { increment: 1 } },
      });

      return workflow;
    }),

  // Save as template (org-level)
  saveAsTemplate: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.string().min(1),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const workflow = await ctx.prisma.workflow.findFirst({
        where: { id: input.workflowId, organization_id: orgId },
      });
      if (!workflow) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.prisma.workflowTemplate.create({
        data: {
          org_id: orgId,
          name: input.name,
          description: input.description ?? null,
          category: input.category,
          difficulty: input.difficulty,
          nodes: workflow.nodes as object,
          edges: workflow.edges as object,
          required_integrations: [],
          is_published: true,
          created_by: userId,
        },
      });
    }),
});
