import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export const incomingWebhooksRouter = createTRPCRouter({
  /** Create a new incoming webhook for a channel */
  create: protectedProcedure
    .input(
      z.object({
        channel_id: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        icon_url: z.string().url().optional(),
        username: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const orgId = ctx.session.user.organizationId;

      // Verify channel belongs to org
      const channel = await ctx.prisma.channel.findFirst({
        where: { id: input.channel_id, organization_id: orgId },
      });
      if (!channel) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });
      }

      const token = generateSecureToken(32);

      const webhook = await ctx.prisma.chatIncomingWebhook.create({
        data: {
          organization_id: orgId,
          channel_id: input.channel_id,
          name: input.name,
          description: input.description ?? null,
          token,
          icon_url: input.icon_url ?? null,
          username: input.username ?? null,
          created_by: userId,
        },
      });

      // Return webhook with the URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      return {
        ...webhook,
        url: `${baseUrl}/api/chat/webhooks/${token}`,
      };
    }),

  /** List all webhooks for the org */
  list: protectedProcedure
    .input(z.object({ channel_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const webhooks = await ctx.prisma.chatIncomingWebhook.findMany({
        where: {
          organization_id: orgId,
          is_active: true,
          ...(input.channel_id ? { channel_id: input.channel_id } : {}),
        },
        include: {
          channel: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      return webhooks.map((wh) => ({
        ...wh,
        url: `${baseUrl}/api/chat/webhooks/${wh.token}`,
      }));
    }),

  /** Deactivate (soft-delete) a webhook */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const webhook = await ctx.prisma.chatIncomingWebhook.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!webhook) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook not found' });
      }

      return ctx.prisma.chatIncomingWebhook.update({
        where: { id: input.id },
        data: { is_active: false },
      });
    }),

  /** Regenerate token for a webhook */
  regenerateToken: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const webhook = await ctx.prisma.chatIncomingWebhook.findFirst({
        where: { id: input.id, organization_id: orgId, is_active: true },
      });
      if (!webhook) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook not found' });
      }

      const newToken = generateSecureToken(32);
      const updated = await ctx.prisma.chatIncomingWebhook.update({
        where: { id: input.id },
        data: { token: newToken },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      return {
        ...updated,
        url: `${baseUrl}/api/chat/webhooks/${newToken}`,
      };
    }),
});
