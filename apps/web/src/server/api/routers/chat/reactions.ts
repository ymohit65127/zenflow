import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function refreshReactionSummary(prisma: any, messageId: string) {
  const reactions = await prisma.chatReaction.groupBy({
    by: ['emoji'],
    where: { message_id: messageId },
    _count: { emoji: true },
  });
  const summary = Object.fromEntries(
    reactions.map((r: { emoji: string; _count: { emoji: number } }) => [r.emoji, r._count.emoji])
  );
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { reactions_summary: summary },
  });
  return summary;
}

export const reactionsRouter = createTRPCRouter({
  /** Add a reaction to a message */
  add: protectedProcedure
    .input(z.object({ message_id: z.string(), emoji: z.string().max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.message_id },
        select: { id: true, channel_id: true, is_deleted: true },
      });
      if (!message || message.is_deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      // Upsert reaction (ignore duplicate)
      await ctx.prisma.chatReaction
        .create({
          data: {
            message_id: input.message_id,
            user_id: userId,
            emoji: input.emoji,
          },
        })
        .catch(() => {
          // Unique constraint violation → already reacted, ignore
        });

      const summary = await refreshReactionSummary(ctx.prisma, input.message_id);
      return { ok: true, summary };
    }),

  /** Remove a reaction from a message */
  remove: protectedProcedure
    .input(z.object({ message_id: z.string(), emoji: z.string().max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.prisma.chatReaction
        .delete({
          where: {
            message_id_user_id_emoji: {
              message_id: input.message_id,
              user_id: userId,
              emoji: input.emoji,
            },
          },
        })
        .catch(() => {
          // Not found, ignore
        });

      const summary = await refreshReactionSummary(ctx.prisma, input.message_id);
      return { ok: true, summary };
    }),

  /** Get reaction summary for a message */
  summary: protectedProcedure
    .input(z.object({ message_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const reactions = await ctx.prisma.chatReaction.findMany({
        where: { message_id: input.message_id },
      });

      // Fetch user info for unique user_ids
      const userIds = [...new Set(reactions.map((r) => r.user_id))];
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Group by emoji
      const grouped: Record<string, { count: number; users: { id: string; name: string }[]; hasReacted: boolean }> = {};
      const currentUserId = ctx.session.user.id;
      for (const r of reactions) {
        if (!grouped[r.emoji]) {
          grouped[r.emoji] = { count: 0, users: [], hasReacted: false };
        }
        grouped[r.emoji]!.count += 1;
        const u = userMap.get(r.user_id);
        if (u) grouped[r.emoji]!.users.push(u);
        if (r.user_id === currentUserId) {
          grouped[r.emoji]!.hasReacted = true;
        }
      }
      return grouped;
    }),
});
