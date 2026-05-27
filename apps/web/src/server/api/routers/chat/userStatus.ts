import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const userStatusRouter = createTRPCRouter({
  /** Set the current user's status */
  set: protectedProcedure
    .input(
      z.object({
        status: z.enum(['online', 'away', 'dnd', 'offline']).default('online'),
        status_text: z.string().max(100).optional(),
        status_emoji: z.string().max(50).optional(),
        expires_in_minutes: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { expires_in_minutes, ...rest } = input;
      const expiresAt = expires_in_minutes
        ? new Date(Date.now() + expires_in_minutes * 60_000)
        : null;

      return ctx.prisma.chatUserStatus.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          status: rest.status,
          status_text: rest.status_text ?? null,
          status_emoji: rest.status_emoji ?? null,
          status_expires_at: expiresAt,
          last_seen_at: new Date(),
        },
        update: {
          status: rest.status,
          status_text: rest.status_text ?? null,
          status_emoji: rest.status_emoji ?? null,
          status_expires_at: expiresAt,
          last_seen_at: new Date(),
        },
      });
    }),

  /** Get the current user's own status */
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return ctx.prisma.chatUserStatus.findUnique({ where: { user_id: userId } }) ?? null;
  }),

  /** Get statuses for a list of user IDs */
  getMany: protectedProcedure
    .input(z.object({ user_ids: z.array(z.string()).min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const statuses = await ctx.prisma.chatUserStatus.findMany({
        where: { user_id: { in: input.user_ids } },
      });
      // Return as a map for easy lookup
      return Object.fromEntries(statuses.map((s) => [s.user_id, s]));
    }),

  /** Clear status (set to offline, clear text/emoji) */
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return ctx.prisma.chatUserStatus.upsert({
      where: { user_id: userId },
      create: { user_id: userId, status: 'offline', last_seen_at: new Date() },
      update: {
        status: 'offline',
        status_text: null,
        status_emoji: null,
        status_expires_at: null,
        last_seen_at: new Date(),
      },
    });
  }),
});
