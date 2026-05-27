import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const AUDIT_ACTIONS = [
  'create_form',
  'edit_form',
  'delete_form',
  'publish_form',
  'archive_form',
  'submit',
  'edit_submission',
  'delete_submission',
  'approve',
  'reject',
] as const;

export const auditLogRouter = createTRPCRouter({
  /** Query audit log for a form with optional filters */
  query: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        action: z.enum(AUDIT_ACTIONS).optional(),
        actorId: z.string().optional(),
        submissionId: z.string().uuid().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      const where: Record<string, unknown> = { form_id: input.formId };
      if (input.action) where['action'] = input.action;
      if (input.actorId) where['actor_id'] = input.actorId;
      if (input.submissionId) where['submission_id'] = input.submissionId;
      if (input.from || input.to) {
        const createdAt: Record<string, Date> = {};
        if (input.from) createdAt['gte'] = new Date(input.from);
        if (input.to) createdAt['lte'] = new Date(input.to);
        where['created_at'] = createdAt;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [entries, total] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx.prisma as any).formAuditLog.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx.prisma as any).formAuditLog.count({ where }),
      ]);

      return { entries, total };
    }),

  /** Write an audit log entry (internal / admin use) */
  write: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        submissionId: z.string().uuid().optional(),
        action: z.enum(AUDIT_ACTIONS),
        oldData: z.unknown().optional(),
        newData: z.unknown(),
        ipAddress: z.string().max(45).optional(),
        userAgent: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const actorId = ctx.session.user.id as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formAuditLog.create({
        data: {
          form_id: input.formId,
          submission_id: input.submissionId ?? null,
          action: input.action,
          actor_id: actorId,
          actor_type: 'user',
          old_data: input.oldData !== undefined ? (input.oldData as object) : null,
          new_data: input.newData as object,
          ip_address: input.ipAddress ?? null,
          user_agent: input.userAgent ?? null,
        },
      });
    }),
});
