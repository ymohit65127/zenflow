// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const crmTerritoriesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.crmTerritory.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const territory = await ctx.prisma.crmTerritory.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!territory) throw new TRPCError({ code: 'NOT_FOUND', message: 'Territory not found' });
      return territory;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        rule_type: z.enum(['geography', 'industry', 'company_size', 'custom']),
        rules: z.array(
          z.object({
            field: z.string(),
            op: z.string(),
            values: z.array(z.string()),
          })
        ),
        owner_ids: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmTerritory.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          rule_type: input.rule_type,
          rules: input.rules,
          owner_ids: input.owner_ids,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          rule_type: z.enum(['geography', 'industry', 'company_size', 'custom']).optional(),
          rules: z.array(
            z.object({
              field: z.string(),
              op: z.string(),
              values: z.array(z.string()),
            })
          ).optional(),
          owner_ids: z.array(z.string()).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmTerritory.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Territory not found' });

      const { data } = input;
      return ctx.prisma.crmTerritory.update({
        where: { id: input.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description ?? null }),
          ...(data.rule_type !== undefined && { rule_type: data.rule_type }),
          ...(data.rules !== undefined && { rules: data.rules }),
          ...(data.owner_ids !== undefined && { owner_ids: data.owner_ids }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmTerritory.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Territory not found' });
      return ctx.prisma.crmTerritory.delete({ where: { id: input.id } });
    }),
});
