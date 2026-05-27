import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const permissionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      return ctx.prisma.docPermission.findMany({
        where: { document_id: input.documentId },
        orderBy: { created_at: 'asc' },
      });
    }),

  set: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        subjectType: z.enum(['user', 'team', 'public']),
        subjectId: z.string().optional(),
        permissionLevel: z.enum(['view', 'comment', 'edit', 'manage']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true, owner_id: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      if (doc.owner_id !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the owner can change permissions' });
      }

      return ctx.prisma.docPermission.upsert({
        where: {
          document_id_subject_type_subject_id: {
            document_id: input.documentId,
            subject_type: input.subjectType,
            subject_id: input.subjectId ?? '',
          },
        },
        create: {
          document_id: input.documentId,
          subject_type: input.subjectType,
          subject_id: input.subjectId ?? '',
          permission_level: input.permissionLevel,
          granted_by: userId,
        },
        update: { permission_level: input.permissionLevel },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const perm = await ctx.prisma.docPermission.findUnique({ where: { id: input.id } });
      if (!perm) throw new TRPCError({ code: 'NOT_FOUND' });

      const doc = await ctx.prisma.document.findUnique({
        where: { id: perm.document_id },
        select: { owner_id: true },
      });
      if (doc?.owner_id !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the owner can remove permissions' });
      }
      return ctx.prisma.docPermission.delete({ where: { id: input.id } });
    }),
});
