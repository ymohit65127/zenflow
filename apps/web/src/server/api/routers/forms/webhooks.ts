import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

export const webhooksRouter = createTRPCRouter({
  /** List webhook queue entries for a form */
  queueStatus: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        status: z.enum(['pending', 'delivered', 'failed']).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, unknown> = { form_id: input.formId };
      if (input.status) where['status'] = input.status;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formWebhookQueue.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: input.limit,
        skip: input.offset,
      });
    }),

  /** Manually retry a failed webhook delivery */
  retry: protectedProcedure
    .input(z.object({ queueId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry = await (ctx.prisma as any).formWebhookQueue.findFirst({
        where: { id: input.queueId },
        include: { form: { select: { organization_id: true, webhook_secret: true } } },
      });
      if (!entry || entry.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (entry.status === 'delivered') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Webhook already delivered' });
      }

      // Mark as pending again with incremented attempts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.prisma as any).formWebhookQueue.update({
        where: { id: input.queueId },
        data: { status: 'pending', next_at: new Date(), last_error: null },
      });

      // Fire immediately
      const payload = entry.payload as string;
      const secret = entry.form.webhook_secret as string | null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-ZenFlow-Delivery': input.queueId,
      };
      if (secret) {
        const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        headers['X-ZenFlow-Signature'] = `sha256=${sig}`;
      }

      try {
        const res = await fetch(entry.webhook_url as string, {
          method: 'POST',
          headers,
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (ctx.prisma as any).formWebhookQueue.update({
          where: { id: input.queueId },
          data: { status: 'delivered', attempts: { increment: 1 } },
        });
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (ctx.prisma as any).formWebhookQueue.update({
          where: { id: input.queueId },
          data: { status: 'failed', last_error: msg, attempts: { increment: 1 } },
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Retry failed: ${msg}` });
      }
    }),

  /** Test-fire the form's webhook with a sample payload */
  testFire: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webhookUrl = (form as any).webhook_url as string | null;
      if (!webhookUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No webhook URL configured on this form' });
      }

      const samplePayload = {
        event: 'test',
        form_id: form.id,
        form_title: form.title,
        timestamp: new Date().toISOString(),
        data: { sample_field: 'sample_value' },
      };
      const payloadStr = JSON.stringify(samplePayload);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const secret = (form as any).webhook_secret as string | null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-ZenFlow-Delivery': `test-${Date.now()}`,
      };
      if (secret) {
        const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
        headers['X-ZenFlow-Signature'] = `sha256=${sig}`;
      }

      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: payloadStr,
          signal: AbortSignal.timeout(10_000),
        });
        return { success: res.ok, status: res.status };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Test webhook failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    }),

  /** Update the form's webhook URL and secret */
  configure: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        webhook_url: z.string().url().optional(),
        webhook_secret: z.string().max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ctx.prisma.form.update({
        where: { id: input.formId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          webhook_url: input.webhook_url ?? null,
          webhook_secret: input.webhook_secret ?? null,
        } as Parameters<typeof ctx.prisma.form.update>[0]['data'],
      });
    }),
});
