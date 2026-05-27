// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const PROBABILITY_WEIGHT = { low: 1, medium: 2, high: 3 } as const;
const IMPACT_WEIGHT = { low: 1, medium: 2, high: 3 } as const;

export const risksRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.projectRisk.findMany({
        where: { project_id: input.projectId },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
        orderBy: [{ risk_score: 'desc' }, { created_at: 'desc' }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z
          .enum(['technical', 'resource', 'external', 'schedule', 'budget', 'quality', 'other'])
          .default('other'),
        probability: z.enum(['low', 'medium', 'high']).default('medium'),
        impact: z.enum(['low', 'medium', 'high']).default('medium'),
        status: z
          .enum(['identified', 'monitoring', 'mitigated', 'accepted', 'closed'])
          .default('identified'),
        mitigationPlan: z.string().optional(),
        contingencyPlan: z.string().optional(),
        ownerId: z.string().optional(),
        reviewDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const riskScore =
        PROBABILITY_WEIGHT[input.probability] * IMPACT_WEIGHT[input.impact];

      return ctx.prisma.projectRisk.create({
        data: {
          project_id: input.projectId,
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          probability: input.probability,
          impact: input.impact,
          risk_score: riskScore,
          status: input.status,
          mitigation_plan: input.mitigationPlan ?? null,
          contingency_plan: input.contingencyPlan ?? null,
          owner_id: input.ownerId ?? null,
          review_date: input.reviewDate ?? null,
          created_by: userId,
        },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        category: z
          .enum(['technical', 'resource', 'external', 'schedule', 'budget', 'quality', 'other'])
          .optional(),
        probability: z.enum(['low', 'medium', 'high']).optional(),
        impact: z.enum(['low', 'medium', 'high']).optional(),
        status: z
          .enum(['identified', 'monitoring', 'mitigated', 'accepted', 'closed'])
          .optional(),
        mitigationPlan: z.string().nullable().optional(),
        contingencyPlan: z.string().nullable().optional(),
        ownerId: z.string().nullable().optional(),
        reviewDate: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const risk = await ctx.prisma.projectRisk.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
      });
      if (!risk) throw new TRPCError({ code: 'NOT_FOUND', message: 'Risk not found' });

      const { id, ...data } = input;

      const probability = data.probability ?? risk.probability as 'low' | 'medium' | 'high';
      const impact = data.impact ?? risk.impact as 'low' | 'medium' | 'high';
      const riskScore = PROBABILITY_WEIGHT[probability] * IMPACT_WEIGHT[impact];

      return ctx.prisma.projectRisk.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.probability !== undefined ? { probability: data.probability } : {}),
          ...(data.impact !== undefined ? { impact: data.impact } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.mitigationPlan !== undefined ? { mitigation_plan: data.mitigationPlan } : {}),
          ...(data.contingencyPlan !== undefined ? { contingency_plan: data.contingencyPlan } : {}),
          ...(data.ownerId !== undefined ? { owner_id: data.ownerId } : {}),
          ...(data.reviewDate !== undefined ? { review_date: data.reviewDate } : {}),
          risk_score: riskScore,
        },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const risk = await ctx.prisma.projectRisk.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
      });
      if (!risk) throw new TRPCError({ code: 'NOT_FOUND', message: 'Risk not found' });

      return ctx.prisma.projectRisk.delete({ where: { id: input.id } });
    }),
});
