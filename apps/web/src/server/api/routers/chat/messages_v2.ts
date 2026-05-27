// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const messagesV2Router = createTRPCRouter({
  /** Cursor-based paginated message list (upgraded) */
  list: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        direction: z.enum(['before', 'after']).default('before'),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      // Access check
      const channel = await ctx.prisma.channel.findFirst({
        where: { id: input.channelId, organization_id: orgId },
        include: { members: { where: { user_id: userId } } },
      });
      if (!channel) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });
      }
      if (channel.type !== 'PUBLIC' && channel.members.length === 0) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member' });
      }

      const cursorDate = input.cursor ? new Date(input.cursor) : undefined;

      const messages = await ctx.prisma.chatMessage.findMany({
        where: {
          channel_id: input.channelId,
          thread_id: null, // top-level only
          is_deleted: false,
          ...(cursorDate && input.direction === 'before'
            ? { created_at: { lt: cursorDate } }
            : {}),
          ...(cursorDate && input.direction === 'after'
            ? { created_at: { gt: cursorDate } }
            : {}),
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
        orderBy: { created_at: input.direction === 'before' ? 'desc' : 'asc' },
        take: input.limit + 1,
      });

      const hasMore = messages.length > input.limit;
      const items = hasMore ? messages.slice(0, input.limit) : messages;

      // Return in chronological order
      if (input.direction === 'before') items.reverse();

      const nextCursor = hasMore
        ? (input.direction === 'before'
            ? items[0]?.created_at.toISOString()
            : items[items.length - 1]?.created_at.toISOString())
        : undefined;

      return { messages: items, hasMore, nextCursor };
    }),

  /** Edit a message */
  edit: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        content: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }
      if (message.user_id !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Cannot edit others' messages" });
      }
      if (message.is_deleted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot edit a deleted message' });
      }

      return ctx.prisma.chatMessage.update({
        where: { id: input.messageId },
        data: { content: input.content, is_edited: true, edited_at: new Date() },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
      });
    }),

  /** Pin a message in a channel */
  pin: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      return ctx.prisma.chatMessage.update({
        where: { id: input.messageId },
        data: { is_pinned: true, pinned_by: userId, pinned_at: new Date() },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
      });
    }),

  /** Unpin a message */
  unpin: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      return ctx.prisma.chatMessage.update({
        where: { id: input.messageId },
        data: { is_pinned: false, pinned_by: null, pinned_at: null },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
      });
    }),

  /** Mark channel as read */
  markRead: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.prisma.channelMember.updateMany({
        where: { channel_id: input.channelId, user_id: userId },
        data: { last_read_at: new Date() },
      });

      return { ok: true };
    }),

  /** Get pinned messages for a channel */
  pinned: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.chatMessage.findMany({
        where: {
          channel_id: input.channelId,
          is_pinned: true,
          is_deleted: false,
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
        },
        orderBy: { pinned_at: 'desc' },
      });
    }),
});
