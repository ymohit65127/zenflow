import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const threadsRouter = createTRPCRouter({
  /** Get thread replies for a parent message */
  get: protectedProcedure
    .input(
      z.object({
        parent_id: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const parent = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.parent_id },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
      });
      if (!parent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      const replies = await ctx.prisma.chatMessage.findMany({
        where: {
          thread_id: input.parent_id,
          is_deleted: false,
          ...(input.cursor ? { created_at: { gt: new Date(input.cursor) } } : {}),
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
        orderBy: { created_at: 'asc' },
        take: input.limit,
      });

      return { parent, replies };
    }),

  /** Reply to a message in a thread */
  reply: protectedProcedure
    .input(
      z.object({
        parent_id: z.string(),
        content: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const parent = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.parent_id },
      });
      if (!parent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent message not found' });
      }

      const reply = await ctx.prisma.chatMessage.create({
        data: {
          channel_id: parent.channel_id,
          user_id: userId,
          thread_id: input.parent_id,
          content: input.content,
          type: 'TEXT',
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
      });

      await ctx.prisma.channel.update({
        where: { id: parent.channel_id },
        data: { last_message_at: new Date() },
      });

      return reply;
    }),
});
