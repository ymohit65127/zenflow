import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const searchRouter = createTRPCRouter({
  /** Full-text search across all channels the user is a member of */
  global: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).default(20),
        channel_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const orgId = ctx.session.user.organizationId;

      // Escape special characters and build search terms
      const terms = input.query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(Boolean);

      if (terms.length === 0) return { results: [] };

      // Use Prisma contains search as fallback (works without PostgreSQL FTS)
      const orConditions = terms.map((term) => ({
        content: { contains: term, mode: 'insensitive' as const },
      }));

      const messages = await ctx.prisma.chatMessage.findMany({
        where: {
          is_deleted: false,
          channel: { organization_id: orgId },
          // Only channels the user is a member of
          channel_id: input.channel_id
            ? input.channel_id
            : {
                in: await ctx.prisma.channelMember
                  .findMany({
                    where: { user_id: userId },
                    select: { channel_id: true },
                  })
                  .then((ms) => ms.map((m) => m.channel_id)),
              },
          OR: orConditions,
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          channel: { select: { id: true, name: true, type: true } },
        },
        orderBy: { created_at: 'desc' },
        take: input.limit,
      });

      return { results: messages };
    }),

  /** Search within a specific channel */
  inChannel: protectedProcedure
    .input(
      z.object({
        channel_id: z.string(),
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const terms = input.query
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (terms.length === 0) return { results: [], hasMore: false };

      const orConditions = terms.map((term) => ({
        content: { contains: term, mode: 'insensitive' as const },
      }));

      const messages = await ctx.prisma.chatMessage.findMany({
        where: {
          channel_id: input.channel_id,
          channel: { organization_id: orgId },
          is_deleted: false,
          OR: orConditions,
          ...(input.cursor ? { created_at: { lt: new Date(input.cursor) } } : {}),
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
        },
        orderBy: { created_at: 'desc' },
        take: input.limit + 1,
      });

      const hasMore = messages.length > input.limit;
      const items = hasMore ? messages.slice(0, input.limit) : messages;
      const nextCursor = hasMore ? items[items.length - 1]?.created_at.toISOString() : undefined;

      return { results: items, hasMore, nextCursor };
    }),
});
