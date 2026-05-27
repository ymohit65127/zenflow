// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const spacesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.docSpace.findMany({
      where: { org_id: orgId, is_archived: false },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { documents: true } },
      },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const space = await ctx.prisma.docSpace.findFirst({
        where: { id: input.id, org_id: orgId, is_archived: false },
        include: { _count: { select: { documents: true } } },
      });
      if (!space) throw new TRPCError({ code: 'NOT_FOUND', message: 'Space not found' });
      return space;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        icon: z.string().max(100).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        description: z.string().optional(),
        visibility: z.enum(['private', 'team', 'org']).default('org'),
        team_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.docSpace.create({
        data: {
          ...input,
          org_id: orgId,
          owner_id: userId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().max(200).optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        visibility: z.enum(['private', 'team', 'org']).optional(),
        position: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const space = await ctx.prisma.docSpace.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!space) throw new TRPCError({ code: 'NOT_FOUND', message: 'Space not found' });
      if (space.owner_id !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the owner can update this space' });
      }
      const { id, ...data } = input;
      return ctx.prisma.docSpace.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const space = await ctx.prisma.docSpace.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!space) throw new TRPCError({ code: 'NOT_FOUND', message: 'Space not found' });
      if (space.owner_id !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the owner can delete this space' });
      }
      // Soft-archive all documents inside
      await ctx.prisma.document.updateMany({
        where: { space_id: input.id },
        data: { is_archived: true, archived_at: new Date() },
      });
      return ctx.prisma.docSpace.update({
        where: { id: input.id },
        data: { is_archived: true },
      });
    }),
});
