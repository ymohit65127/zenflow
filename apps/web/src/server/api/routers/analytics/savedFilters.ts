import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const FilterItemSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z.unknown(),
});

export const savedFiltersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ module: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.analyticsSavedFilter.findMany({
        where: {
          organization_id: orgId,
          user_id: userId,
          ...(input.module ? { module: input.module } : {}),
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const filter = await ctx.prisma.analyticsSavedFilter.findFirst({
        where: { id: input.id, organization_id: orgId, user_id: userId },
      });
      if (!filter) throw new TRPCError({ code: 'NOT_FOUND' });
      return filter;
    }),

  create: protectedProcedure
    .input(z.object({
      module: z.string().min(1),
      name: z.string().min(1),
      filters: z.array(FilterItemSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.analyticsSavedFilter.create({
        data: {
          organization_id: orgId,
          user_id: userId,
          module: input.module,
          name: input.name,
          filters: input.filters as object,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      filters: z.array(FilterItemSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const existing = await ctx.prisma.analyticsSavedFilter.findFirst({
        where: { id: input.id, organization_id: orgId, user_id: userId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsSavedFilter.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.filters !== undefined ? { filters: input.filters as object } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const existing = await ctx.prisma.analyticsSavedFilter.findFirst({
        where: { id: input.id, organization_id: orgId, user_id: userId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.analyticsSavedFilter.delete({ where: { id: input.id } });
    }),
});
