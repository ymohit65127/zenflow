import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";

// Uses the existing Notification model which has:
// id, organization_id, user_id, type, title, body, data(Json), is_read, read_at, created_at

export const notificationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        unread_only: z.boolean().default(false),
        limit: z.number().int().max(100).default(30),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      return ctx.prisma.notification.findMany({
        where: {
          user_id: userId,
          ...(input.unread_only && { is_read: false }),
          ...(input.cursor && { created_at: { lt: new Date(input.cursor) } }),
        },
        orderBy: { created_at: "desc" },
        take: input.limit,
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      return ctx.prisma.notification.updateMany({
        where: { id: { in: input.ids }, user_id: userId },
        data: { is_read: true, read_at: new Date() },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    return ctx.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    return ctx.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }),

  // Notification preferences stored in user metadata JSON (no dedicated table in existing schema)
  "preferences.get": protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    const user = await ctx.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    const prefs = (user?.metadata as any)?.notification_preferences ?? {};
    return Object.entries(prefs).map(([event_type, channels]) => ({
      event_type,
      channels,
    }));
  }),

  "preferences.set": protectedProcedure
    .input(
      z.object({
        event_type: z.string().min(1).max(100),
        channels: z.object({
          in_app: z.boolean(),
          email: z.boolean(),
          sms: z.boolean().default(false),
          push: z.boolean().default(false),
        }),
        quiet_start: z.string().max(5).optional(),
        quiet_end: z.string().max(5).optional(),
        timezone: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });
      const existing = (user?.metadata as any) ?? {};
      const existingPrefs = existing.notification_preferences ?? {};

      await ctx.prisma.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...existing,
            notification_preferences: {
              ...existingPrefs,
              [input.event_type]: {
                channels: input.channels,
                quiet_start: input.quiet_start ?? null,
                quiet_end: input.quiet_end ?? null,
                timezone: input.timezone ?? null,
              },
            },
          },
        },
      });

      return { success: true };
    }),
});
