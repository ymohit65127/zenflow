import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const versionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      return ctx.prisma.documentVersion.findMany({
        where: { document_id: input.documentId },
        orderBy: { version: 'desc' },
        take: 50,
      });
    }),

  save: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        content: z.record(z.unknown()),
        changeSummary: z.string().max(255).optional(),
        isNamed: z.boolean().optional(),
        versionName: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true, version: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      const newVersion = doc.version + 1;

      const [versionRecord] = await ctx.prisma.$transaction([
        ctx.prisma.documentVersion.create({
          data: {
            document_id: input.documentId,
            version: newVersion,
            content: input.content as object,
            created_by: userId,
          },
        }),
        ctx.prisma.document.update({
          where: { id: input.documentId },
          data: { version: newVersion },
        }),
      ]);

      return versionRecord;
    }),

  restore: protectedProcedure
    .input(z.object({ documentId: z.string(), versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      const version = await ctx.prisma.documentVersion.findFirst({
        where: { id: input.versionId, document_id: input.documentId },
      });
      if (!version) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });

      // Save current as a new version before restoring
      const newVersion = doc.version + 1;
      await ctx.prisma.$transaction([
        ctx.prisma.documentVersion.create({
          data: {
            document_id: input.documentId,
            version: newVersion,
            content: doc.content as object,
            created_by: userId,
          },
        }),
        ctx.prisma.document.update({
          where: { id: input.documentId },
          data: {
            content: version.content as object,
            version: newVersion,
          },
        }),
      ]);

      return ctx.prisma.document.findUnique({ where: { id: input.documentId } });
    }),

  get: protectedProcedure
    .input(z.object({ versionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.prisma.documentVersion.findUnique({
        where: { id: input.versionId },
      });
      if (!version) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });
      return version;
    }),
});
