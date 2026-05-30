import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const CrmEntityTypeEnum = z.enum(['contact', 'deal', 'account', 'lead']);

export const crmEmailRouter = createTRPCRouter({
  getIntegrations: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const userId = ctx.session.user.id as string;
    return ctx.prisma.crmEmailIntegration.findMany({
      where: { organization_id: orgId, user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }),

  disconnect: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const integration = await ctx.prisma.crmEmailIntegration.findFirst({
        where: { id: input.integrationId, user_id: userId },
      });
      if (!integration) throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found' });

      return ctx.prisma.crmEmailIntegration.delete({ where: { id: input.integrationId } });
    }),

  syncNow: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const integration = await ctx.prisma.crmEmailIntegration.findFirst({
        where: { id: input.integrationId, user_id: userId },
      });
      if (!integration) throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found' });

      // Update last_synced_at to indicate sync was triggered
      await ctx.prisma.crmEmailIntegration.update({
        where: { id: input.integrationId },
        data: { last_synced_at: new Date() },
      });

      return { success: true, message: 'Email sync triggered' };
    }),

  getList: protectedProcedure
    .input(
      z.object({
        entityType: CrmEntityTypeEnum,
        entityId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const emails = await ctx.prisma.crmEmailLog.findMany({
        where: {
          organization_id: orgId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        take: (input.limit ?? 20) + 1,
        orderBy: { sent_at: 'desc' },
      });

      let nextCursor: string | undefined;
      if (emails.length > (input.limit ?? 20)) {
        const next = emails.pop();
        nextCursor = next?.id;
      }

      return { emails, nextCursor };
    }),

  getThread: protectedProcedure
    .input(
      z.object({
        entityType: CrmEntityTypeEnum,
        entityId: z.string(),
        threadId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmEmailLog.findMany({
        where: {
          organization_id: orgId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          message_id: input.threadId,
        },
        orderBy: { sent_at: 'asc' },
      });
    }),

  send: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        entityType: CrmEntityTypeEnum,
        entityId: z.string(),
        toEmails: z.array(z.string().email()),
        subject: z.string().max(500),
        htmlBody: z.string(),
        ccEmails: z.array(z.string().email()).default([]),
        threadId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const integration = await ctx.prisma.crmEmailIntegration.findFirst({
        where: { id: input.integrationId, user_id: userId },
      });
      if (!integration) throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found' });

      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@zenflow>`;

      return ctx.prisma.crmEmailLog.create({
        data: {
          organization_id: orgId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          direction: 'outbound',
          message_id: messageId,
          subject: input.subject,
          from_email: integration.email_address,
          to_emails: input.toEmails,
          cc_emails: input.ccEmails,
          body_html: input.htmlBody,
          sent_at: new Date(),
          integration_id: input.integrationId,
        },
      });
    }),

  // Stats for email integration page
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;

    const total = await ctx.prisma.crmEmailLog.count({ where: { organization_id: orgId } });

    return { total, opened: 0, bounced: 0 };
  }),
});
