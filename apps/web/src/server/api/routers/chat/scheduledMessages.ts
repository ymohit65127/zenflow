import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const scheduledMessagesRouter = createTRPCRouter({
  /** Create a scheduled message */
  create: protectedProcedure
    .input(
      z.object({
        channel_id: z.string(),
        content: z.string().min(1).max(10000),
        scheduled_at: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const scheduledAt = new Date(input.scheduled_at);

      if (scheduledAt <= new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Scheduled time must be in the future',
        });
      }

      // Verify user has access to channel
      const channel = await ctx.prisma.channel.findFirst({
        where: {
          id: input.channel_id,
          organization_id: ctx.session.user.organizationId,
        },
      });
      if (!channel) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });
      }

      return ctx.prisma.chatScheduledMessage.create({
        data: {
          channel_id: input.channel_id,
          user_id: userId,
          content: input.content,
          scheduled_at: scheduledAt,
          status: 'pending',
        },
      });
    }),

  /** Cancel a scheduled message */
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const scheduled = await ctx.prisma.chatScheduledMessage.findUnique({
        where: { id: input.id },
      });
      if (!scheduled) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Scheduled message not found' });
      }
      if (scheduled.user_id !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot cancel others\' scheduled messages' });
      }
      if (scheduled.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel a message with status '${scheduled.status}'`,
        });
      }

      return ctx.prisma.chatScheduledMessage.update({
        where: { id: input.id },
        data: { status: 'cancelled' },
      });
    }),

  /** List pending scheduled messages for the current user */
  list: protectedProcedure
    .input(
      z.object({
        channel_id: z.string().optional(),
        status: z.enum(['pending', 'sent', 'cancelled']).default('pending'),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      return ctx.prisma.chatScheduledMessage.findMany({
        where: {
          user_id: userId,
          status: input.status,
          ...(input.channel_id ? { channel_id: input.channel_id } : {}),
        },
        include: {
          channel: { select: { id: true, name: true, channel_type: true } },
        },
        orderBy: { scheduled_at: 'asc' },
      });
    }),
});
