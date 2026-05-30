import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const costCentersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ include_inactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.accCostCenter.findMany({
        where: {
          org_id: orgId,
          ...(input.include_inactive ? {} : { is_active: true }),
        },
        orderBy: [{ code: 'asc' }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        code: z.string().max(20),
        name: z.string().max(200),
        description: z.string().optional(),
        manager_id: z.string().optional(),
        parent_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const exists = await ctx.prisma.accCostCenter.findUnique({
        where: { org_id_code: { org_id: orgId, code: input.code } },
      });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'Cost center code already exists' });
      return ctx.prisma.accCostCenter.create({
        data: {
          org_id: orgId,
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          manager_id: input.manager_id ?? null,
          parent_id: input.parent_id ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        manager_id: z.string().optional(),
        parent_id: z.string().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;
      const cc = await ctx.prisma.accCostCenter.findFirst({ where: { id, org_id: orgId } });
      if (!cc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cost center not found' });
      return ctx.prisma.accCostCenter.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const cc = await ctx.prisma.accCostCenter.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!cc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cost center not found' });
      // Check for children
      const children = await ctx.prisma.accCostCenter.count({ where: { parent_id: input.id } });
      if (children > 0)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete cost center with children' });
      return ctx.prisma.accCostCenter.delete({ where: { id: input.id } });
    }),
});
