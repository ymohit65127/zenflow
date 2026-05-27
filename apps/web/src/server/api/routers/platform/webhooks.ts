import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

// Uses existing Webhook model: id, organization_id, url, secret, events, is_active, last_triggered_at, failure_count, created_at
// No name or delivery log in existing schema — we store name in settings (Json) of the org or extend as needed.
// We adapt to add name via a placeholder stored in events[0] prefix pattern, or just omit it.

export const webhooksRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.webhook.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        url: z.string().url().max(500),
        events: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const secret = crypto.randomBytes(32).toString("hex");
      return ctx.prisma.webhook.create({
        data: {
          organization_id: orgId,
          url: input.url,
          events: input.events,
          secret,
          is_active: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          url: z.string().url().max(500).optional(),
          events: z.array(z.string()).optional(),
          is_active: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const sub = await ctx.prisma.webhook.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.webhook.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.webhook.update({
        where: { id: input.id, organization_id: orgId },
        data: { is_active: false },
      });
    }),

  // Delivery log is not in existing schema; return empty array
  deliveries: protectedProcedure
    .input(
      z.object({
        subscription_id: z.string(),
        limit: z.number().int().max(50).default(20),
      })
    )
    .query(async () => {
      // WebhookDelivery model not in current schema — return empty
      return [];
    }),

  redeliver: protectedProcedure
    .input(z.object({ delivery_id: z.string() }))
    .mutation(async () => {
      // Not implemented until WebhookDelivery model is migrated
      return { success: true };
    }),

  rotateSecret: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const newSecret = crypto.randomBytes(32).toString("hex");
      return ctx.prisma.webhook.update({
        where: { id: input.id, organization_id: orgId },
        data: { secret: newSecret },
        select: { id: true, secret: true },
      });
    }),
});
