import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

export const apiTokensRouter = createTRPCRouter({
  /** List API tokens for a form (never returns the raw token — only prefix + metadata) */
  list: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formApiToken.findMany({
        where: { form_id: input.formId, revoked_at: null },
        select: {
          id: true,
          label: true,
          token_prefix: true,
          scope: true,
          last_used_at: true,
          expires_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }),

  /**
   * Generate a new API token.
   * Returns the raw token ONCE — only the SHA-256 hash is stored in the DB.
   * Format: zf_{prefix}_{randomHex}
   */
  create: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        label: z.string().min(1).max(100),
        scope: z.enum(['read', 'read_approve']).default('read'),
        expiresAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND' });

      // Generate token components
      const prefix = crypto.randomBytes(4).toString('hex'); // 8 hex chars
      const rawSecret = crypto.randomBytes(32).toString('hex'); // 64 hex chars
      const rawToken = `zf_${prefix}_${rawSecret}`;
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await (ctx.prisma as any).formApiToken.create({
        data: {
          form_id: input.formId,
          created_by: userId,
          label: input.label,
          token_hash: tokenHash,
          token_prefix: prefix,
          scope: input.scope,
          expires_at: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });

      // Return the raw token only on creation
      return {
        id: created.id,
        label: created.label,
        token_prefix: created.token_prefix,
        scope: created.scope,
        expires_at: created.expires_at,
        created_at: created.created_at,
        /** Raw token shown ONCE — store it securely */
        raw_token: rawToken,
      };
    }),

  /** Revoke a token (sets revoked_at) */
  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = await (ctx.prisma as any).formApiToken.findFirst({
        where: { id: input.id },
        include: { form: { select: { organization_id: true } } },
      });
      if (!token || token.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (token.revoked_at) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token already revoked' });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formApiToken.update({
        where: { id: input.id },
        data: { revoked_at: new Date() },
        select: { id: true, label: true, revoked_at: true },
      });
    }),
});
