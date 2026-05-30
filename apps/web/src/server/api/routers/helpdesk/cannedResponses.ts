import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const CannedResponseSchema = z.object({
  name: z.string().min(1).max(200),
  shortcut: z.string().min(1).max(50),
  content: z.string().min(1),
  is_shared: z.boolean().default(true),
});

export const cannedResponsesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.hdCannedResponse.findMany({
        where: {
          organization_id: orgId,
        },
        orderBy: [{ name: 'asc' }],
      });
    }),

  searchByShortcut: protectedProcedure
    .input(z.object({ q: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.hdCannedResponse.findMany({
        where: {
          organization_id: orgId,
          shortcut: { contains: input.q, mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
        take: 10,
      });
    }),

  create: protectedProcedure
    .input(CannedResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      // Check shortcut uniqueness
      const existing = await ctx.prisma.hdCannedResponse.findFirst({
        where: { organization_id: orgId, shortcut: input.shortcut },
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Shortcut already in use' });

      return ctx.prisma.hdCannedResponse.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          name: input.name,
          shortcut: input.shortcut,
          content: input.content,
          is_shared: input.is_shared,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(CannedResponseSchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;
      const existing = await ctx.prisma.hdCannedResponse.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Canned response not found' });

      // Check shortcut uniqueness (exclude self)
      const shortcutConflict = await ctx.prisma.hdCannedResponse.findFirst({
        where: { organization_id: orgId, shortcut: rest.shortcut, id: { not: id } },
      });
      if (shortcutConflict) throw new TRPCError({ code: 'CONFLICT', message: 'Shortcut already in use' });

      return ctx.prisma.hdCannedResponse.update({
        where: { id },
        data: {
          name: rest.name,
          shortcut: rest.shortcut,
          content: rest.content,
          is_shared: rest.is_shared,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdCannedResponse.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Canned response not found' });
      return ctx.prisma.hdCannedResponse.delete({ where: { id: input.id } });
    }),

  // No usage_count in schema — kept as no-op for API compatibility
  incrementUsage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.hdCannedResponse.findFirst({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Canned response not found' });
      return existing;
    }),

  // No category field in schema — return empty array
  listCategories: protectedProcedure.query(async () => {
    return [] as string[];
  }),
});
