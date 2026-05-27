import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ─── Channels Sub-Router ─────────────────────────────────────────────────────

const channelsRouter = createTRPCRouter({
  /** List all channels the current user is a member of */
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const userId = ctx.session.user.id;

    const memberships = await ctx.prisma.channelMember.findMany({
      where: { user_id: userId, channel: { organization_id: orgId, is_archived: false } },
      include: {
        channel: {
          include: {
            messages: {
              where: { is_deleted: false },
              orderBy: { created_at: 'desc' },
              take: 1,
              include: { user: { select: { id: true, name: true } } },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { channel: { last_message_at: 'desc' } },
    });

    return memberships.map((m) => {
      const lastMessage = m.channel.messages[0] ?? null;
      const lastReadAt = m.last_read_at;
      // unread: count messages after last_read_at (approximate via boolean)
      return {
        membership: {
          id: m.id,
          role: m.role,
          last_read_at: lastReadAt,
          notifications: m.notifications,
        },
        channel: {
          id: m.channel.id,
          name: m.channel.name,
          type: m.channel.type,
          description: m.channel.description,
          icon: m.channel.icon,
          last_message_at: m.channel.last_message_at,
          member_count: m.channel._count.members,
          last_message: lastMessage
            ? {
                content: lastMessage.is_deleted ? 'This message was deleted' : lastMessage.content,
                user_name: lastMessage.user.name,
                created_at: lastMessage.created_at,
              }
            : null,
        },
      };
    });
  }),

  /** List all public channels in the org (for browsing) */
  getAll: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const channels = await ctx.prisma.channel.findMany({
        where: {
          organization_id: orgId,
          type: 'PUBLIC',
          is_archived: false,
          ...(input.search
            ? { name: { contains: input.search, mode: 'insensitive' } }
            : {}),
        },
        include: {
          _count: { select: { members: true } },
          members: { where: { user_id: userId }, select: { id: true } },
        },
        orderBy: { last_message_at: 'desc' },
      });

      return channels.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        icon: c.icon,
        last_message_at: c.last_message_at,
        member_count: c._count.members,
        is_member: c.members.length > 0,
      }));
    }),

  /** Single channel with members */
  get: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const channel = await ctx.prisma.channel.findFirst({
        where: { id: input.channelId, organization_id: orgId },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, avatar_url: true } },
            },
          },
        },
      });

      if (!channel) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });
      }

      // Verify membership (for private channels)
      const isMember = channel.members.some((m) => m.user_id === userId);
      if (channel.type !== 'PUBLIC' && !isMember) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this channel' });
      }

      return channel;
    }),

  /** Create a new channel */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        description: z.string().max(500).optional(),
        type: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const channel = await ctx.prisma.channel.create({
        data: {
          organization_id: orgId,
          name: input.name,
          ...(input.description !== undefined ? { description: input.description } : {}),
          type: input.type,
          members: {
            create: { user_id: userId, role: 'OWNER' },
          },
        },
      });

      // System message
      await ctx.prisma.chatMessage.create({
        data: {
          channel_id: channel.id,
          user_id: userId,
          content: `Channel #${input.name} was created`,
          type: 'SYSTEM',
        },
      });

      return channel;
    }),

  /** Join a public channel */
  join: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const channel = await ctx.prisma.channel.findFirst({
        where: { id: input.channelId, organization_id: orgId, type: 'PUBLIC' },
      });
      if (!channel) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });
      }

      const existing = await ctx.prisma.channelMember.findUnique({
        where: { channel_id_user_id: { channel_id: input.channelId, user_id: userId } },
      });
      if (existing) return existing;

      const member = await ctx.prisma.channelMember.create({
        data: { channel_id: input.channelId, user_id: userId, role: 'MEMBER' },
      });

      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      await ctx.prisma.chatMessage.create({
        data: {
          channel_id: input.channelId,
          user_id: userId,
          content: `${user?.name ?? 'Someone'} joined the channel`,
          type: 'SYSTEM',
        },
      });

      return member;
    }),

  /** Leave a channel */
  leave: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const member = await ctx.prisma.channelMember.findUnique({
        where: { channel_id_user_id: { channel_id: input.channelId, user_id: userId } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Membership not found' });
      }

      await ctx.prisma.channelMember.delete({
        where: { channel_id_user_id: { channel_id: input.channelId, user_id: userId } },
      });

      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      await ctx.prisma.chatMessage.create({
        data: {
          channel_id: input.channelId,
          user_id: userId,
          content: `${user?.name ?? 'Someone'} left the channel`,
          type: 'SYSTEM',
        },
      });

      return { success: true };
    }),

  /** Create or get existing DM between 2 users */
  createDM: protectedProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      if (userId === input.targetUserId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot DM yourself' });
      }

      // Find existing DM channel between these two users
      const existing = await ctx.prisma.channel.findFirst({
        where: {
          organization_id: orgId,
          type: 'DIRECT',
          members: {
            every: {
              user_id: { in: [userId, input.targetUserId] },
            },
          },
          AND: [
            { members: { some: { user_id: userId } } },
            { members: { some: { user_id: input.targetUserId } } },
          ],
        },
        include: { members: true },
      });

      if (existing && existing.members.length === 2) return existing;

      const targetUser = await ctx.prisma.user.findFirst({
        where: { id: input.targetUserId, organization_id: orgId },
        select: { name: true },
      });
      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const channel = await ctx.prisma.channel.create({
        data: {
          organization_id: orgId,
          type: 'DIRECT',
          members: {
            create: [
              { user_id: userId, role: 'MEMBER' },
              { user_id: input.targetUserId, role: 'MEMBER' },
            ],
          },
        },
        include: { members: true },
      });

      return channel;
    }),

  /** Archive a channel (owner/admin only) */
  archive: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const member = await ctx.prisma.channelMember.findUnique({
        where: { channel_id_user_id: { channel_id: input.channelId, user_id: userId } },
      });
      if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
      }

      return ctx.prisma.channel.update({
        where: { id: input.channelId, organization_id: orgId },
        data: { is_archived: true },
      });
    }),
});

// ─── Messages Sub-Router ──────────────────────────────────────────────────────

const messagesRouter = createTRPCRouter({
  /** List messages in a channel (cursor-based, last 50) */
  list: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      // Ensure user has access
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

      const messages = await ctx.prisma.chatMessage.findMany({
        where: {
          channel_id: input.channelId,
          thread_id: null, // top-level messages only
          ...(input.cursor ? { created_at: { lt: new Date(input.cursor) } } : {}),
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
        orderBy: { created_at: 'desc' },
        take: input.limit + 1,
      });

      const hasMore = messages.length > input.limit;
      const items = hasMore ? messages.slice(0, input.limit) : messages;
      const nextCursor = hasMore ? items[items.length - 1]?.created_at.toISOString() : undefined;

      return { messages: items.reverse(), nextCursor, hasMore };
    }),

  /** Send a message */
  send: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        content: z.string().min(1).max(10000),
        type: z.enum(['TEXT', 'IMAGE', 'FILE', 'GIF']).default('TEXT'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const channel = await ctx.prisma.channel.findFirst({
        where: { id: input.channelId, organization_id: orgId },
        include: { members: { where: { user_id: userId } } },
      });
      if (!channel) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });
      }
      // Auto-join public channels on send
      if (channel.members.length === 0) {
        if (channel.type !== 'PUBLIC') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member' });
        }
        await ctx.prisma.channelMember.create({
          data: { channel_id: input.channelId, user_id: userId, role: 'MEMBER' },
        });
      }

      const [message] = await ctx.prisma.$transaction([
        ctx.prisma.chatMessage.create({
          data: {
            channel_id: input.channelId,
            user_id: userId,
            content: input.content,
            type: input.type,
          },
          include: {
            user: { select: { id: true, name: true, avatar_url: true } },
            _count: { select: { replies: true } },
          },
        }),
        ctx.prisma.channel.update({
          where: { id: input.channelId },
          data: { last_message_at: new Date() },
        }),
      ]);

      return message;
    }),

  /** Edit own message */
  edit: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
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
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit others\' messages' });
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

  /** Soft-delete own message */
  delete: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }
      if (message.user_id !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete others\' messages' });
      }

      return ctx.prisma.chatMessage.update({
        where: { id: input.messageId },
        data: { is_deleted: true, deleted_at: new Date(), content: '' },
      });
    }),

  /** Toggle emoji reaction */
  react: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        emoji: z.string().min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.messageId },
      });
      if (!message || message.is_deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      const reactions = (message.reactions as Record<string, string[]>) ?? {};
      const users: string[] = reactions[input.emoji] ?? [];
      const hasReacted = users.includes(userId);

      const updatedUsers = hasReacted
        ? users.filter((id) => id !== userId)
        : [...users, userId];

      const updatedReactions = { ...reactions };
      if (updatedUsers.length === 0) {
        delete updatedReactions[input.emoji];
      } else {
        updatedReactions[input.emoji] = updatedUsers;
      }

      return ctx.prisma.chatMessage.update({
        where: { id: input.messageId },
        data: { reactions: updatedReactions },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
      });
    }),

  /** Get thread replies for a parent message */
  getThread: protectedProcedure
    .input(z.object({ parentMessageId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const parent = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.parentMessageId },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
      });
      if (!parent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      const replies = await ctx.prisma.chatMessage.findMany({
        where: { thread_id: input.parentMessageId },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { replies: true } },
        },
        orderBy: { created_at: 'asc' },
      });

      return { parent, replies };
    }),

  /** Reply to a message (creates message with thread_id) */
  reply: protectedProcedure
    .input(
      z.object({
        parentMessageId: z.string().uuid(),
        content: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const parent = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.parentMessageId },
      });
      if (!parent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent message not found' });
      }

      const [reply] = await ctx.prisma.$transaction([
        ctx.prisma.chatMessage.create({
          data: {
            channel_id: parent.channel_id,
            user_id: userId,
            thread_id: input.parentMessageId,
            content: input.content,
            type: 'TEXT',
          },
          include: {
            user: { select: { id: true, name: true, avatar_url: true } },
            _count: { select: { replies: true } },
          },
        }),
        ctx.prisma.channel.update({
          where: { id: parent.channel_id },
          data: { last_message_at: new Date() },
        }),
      ]);

      return reply;
    }),
});

// ─── Members Sub-Router ───────────────────────────────────────────────────────

const membersRouter = createTRPCRouter({
  /** List org users (for @mention / DM picker) */
  list: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      return ctx.prisma.user.findMany({
        where: {
          organization_id: orgId,
          is_active: true,
          deleted_at: null,
          id: { not: userId },
          ...(input.search
            ? {
                OR: [
                  { name: { contains: input.search, mode: 'insensitive' } },
                  { email: { contains: input.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, email: true, avatar_url: true },
        orderBy: { name: 'asc' },
        take: 50,
      });
    }),
});

// ─── Unread Sub-Router ────────────────────────────────────────────────────────

const unreadRouter = createTRPCRouter({
  /** Get unread counts per channel the user is a member of */
  counts: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const userId = ctx.session.user.id;

    const memberships = await ctx.prisma.channelMember.findMany({
      where: { user_id: userId, channel: { organization_id: orgId } },
      select: { channel_id: true, last_read_at: true },
    });

    const counts: Record<string, number> = {};

    await Promise.all(
      memberships.map(async (m) => {
        const count = await ctx.prisma.chatMessage.count({
          where: {
            channel_id: m.channel_id,
            is_deleted: false,
            user_id: { not: userId },
            thread_id: null,
            ...(m.last_read_at ? { created_at: { gt: m.last_read_at } } : {}),
          },
        });
        counts[m.channel_id] = count;
      })
    );

    return counts;
  }),

  /** Mark a channel as read (update last_read_at) */
  markRead: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.prisma.channelMember.updateMany({
        where: { channel_id: input.channelId, user_id: userId },
        data: { last_read_at: new Date() },
      });

      return { success: true };
    }),
});

// ─── Chat Router ──────────────────────────────────────────────────────────────

export const chatRouter = createTRPCRouter({
  channels: channelsRouter,
  messages: messagesRouter,
  members: membersRouter,
  unread: unreadRouter,
});
