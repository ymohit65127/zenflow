import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const favoritesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    return ctx.prisma.docFavorite.findMany({
      where: { user_id: userId },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            space_id: true,
            updated_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  toggle: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const orgId = ctx.session.user.organizationId as string;

      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      const existing = await ctx.prisma.docFavorite.findFirst({
        where: { user_id: userId, document_id: input.documentId },
      });

      if (existing) {
        await ctx.prisma.docFavorite.delete({ where: { id: existing.id } });
        return { favorited: false };
      } else {
        await ctx.prisma.docFavorite.create({
          data: { user_id: userId, document_id: input.documentId },
        });
        return { favorited: true };
      }
    }),

  add: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      return ctx.prisma.docFavorite.upsert({
        where: {
          user_id_document_id: {
            user_id: userId,
            document_id: input.documentId,
          },
        },
        create: { user_id: userId, document_id: input.documentId },
        update: {},
      });
    }),

  remove: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const fav = await ctx.prisma.docFavorite.findFirst({
        where: { user_id: userId, document_id: input.documentId },
      });
      if (!fav) return null;
      return ctx.prisma.docFavorite.delete({ where: { id: fav.id } });
    }),
});
