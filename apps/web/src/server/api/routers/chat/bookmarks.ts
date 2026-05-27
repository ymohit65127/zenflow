// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const bookmarksRouter = createTRPCRouter({
  /** Bookmark a message */
  save: protectedProcedure
    .input(
      z.object({
        message_id: z.string(),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.message_id },
      });
      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      return ctx.prisma.chatBookmark.upsert({
        where: {
          user_id_message_id: {
            user_id: userId,
            message_id: input.message_id,
          },
        },
        create: {
          user_id: userId,
          message_id: input.message_id,
          note: input.note ?? null,
        },
        update: {
          note: input.note ?? null,
        },
      });
    }),

  /** Remove a bookmark */
  remove: protectedProcedure
    .input(z.object({ message_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.prisma.chatBookmark
        .delete({
          where: {
            user_id_message_id: {
              user_id: userId,
              message_id: input.message_id,
            },
          },
        })
        .catch(() => {
          // Not found, ignore
        });

      return { ok: true };
    }),

  /** List all bookmarks for the current user */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const bookmarks = await ctx.prisma.chatBookmark.findMany({
        where: {
          user_id: userId,
          ...(input.cursor ? { created_at: { lt: new Date(input.cursor) } } : {}),
        },
        take: input.limit + 1,
        orderBy: { created_at: 'desc' },
        include: {
          message: {
            include: {
              user: { select: { id: true, name: true, avatar_url: true } },
              channel: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });

      const hasMore = bookmarks.length > input.limit;
      const items = hasMore ? bookmarks.slice(0, input.limit) : bookmarks;
      const nextCursor = hasMore
        ? items[items.length - 1]?.created_at.toISOString()
        : undefined;

      return { bookmarks: items, hasMore, nextCursor };
    }),

  /** Check if a message is bookmarked */
  check: protectedProcedure
    .input(z.object({ message_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const bookmark = await ctx.prisma.chatBookmark.findUnique({
        where: {
          user_id_message_id: {
            user_id: userId,
            message_id: input.message_id,
          },
        },
      });
      return { bookmarked: !!bookmark, note: bookmark?.note ?? null };
    }),
});
