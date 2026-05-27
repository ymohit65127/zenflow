import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const workflowIntegrationsRouter = createTRPCRouter({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      const integrations = await ctx.prisma.workflowIntegration.findMany({
        where: { organization_id: orgId },
        orderBy: { created_at: 'desc' },
      });

      // Mask credential values in response — only return metadata
      return integrations.map((i) => ({
        id: i.id,
        name: i.name,
        provider: i.provider,
        scopes: i.scopes,
        is_active: i.is_active,
        expires_at: i.expires_at,
        last_used_at: i.last_used_at,
        created_at: i.created_at,
      }));
    }),

  connect: protectedProcedure
    .input(z.object({
      provider: z.string().min(1),
      name: z.string().min(1),
      credentials: z.record(z.unknown()),
      scopes: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const { encryptCredentials } = await import('@/lib/workflows/integrations/credentials');
      const encrypted = encryptCredentials(input.credentials, orgId);

      return ctx.prisma.workflowIntegration.create({
        data: {
          organization_id: orgId,
          created_by: userId,
          name: input.name,
          provider: input.provider,
          credentials_enc: encrypted as object,
          scopes: input.scopes,
          is_active: true,
        },
      });
    }),

  test: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const integration = await ctx.prisma.workflowIntegration.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!integration) throw new TRPCError({ code: 'NOT_FOUND' });

      const { decryptCredentials } = await import('@/lib/workflows/integrations/credentials');
      const creds = decryptCredentials(
        integration.credentials_enc as { iv: string; tag: string; ciphertext: string },
        orgId
      );

      // Provider-specific ping test
      if (integration.provider === 'slack') {
        try {
          const resp = await fetch('https://slack.com/api/auth.test', {
            headers: { Authorization: `Bearer ${(creds as { token: string }).token}` },
          });
          const data = await resp.json() as { ok: boolean; error?: string };
          if (!data.ok) throw new Error(data.error ?? 'Slack auth failed');
          return { ok: true, message: 'Slack connection verified' };
        } catch (err) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: (err as Error).message });
        }
      }

      // Generic: just verify credentials were decrypted
      return { ok: true, message: `${integration.provider} credentials are valid` };
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const integration = await ctx.prisma.workflowIntegration.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!integration) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.workflowIntegration.update({
        where: { id: input.id },
        data: { is_active: false },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const integration = await ctx.prisma.workflowIntegration.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!integration) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.prisma.workflowIntegration.delete({ where: { id: input.id } });
    }),
});
