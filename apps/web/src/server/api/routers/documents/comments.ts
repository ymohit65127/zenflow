// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const commentsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        showResolved: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      return ctx.prisma.docComment.findMany({
        where: {
          document_id: input.documentId,
          deleted_at: null,
          parent_comment_id: null,
          ...(!input.showResolved ? { is_resolved: false } : {}),
        },
        include: {
          author: { select: { id: true, name: true, avatar_url: true } },
          replies: {
            where: { deleted_at: null },
            include: {
              author: { select: { id: true, name: true, avatar_url: true } },
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { created_at: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        parentCommentId: z.string().optional(),
        blockId: z.string().optional(),
        selectedText: z.string().max(500).optional(),
        content: z.string().min(1),
        contentHtml: z.string().optional(),
        mentions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      return ctx.prisma.docComment.create({
        data: {
          document_id: input.documentId,
          parent_comment_id: input.parentCommentId ?? null,
          block_id: input.blockId ?? null,
          selected_text: input.selectedText ?? null,
          content: input.content,
          content_html: input.contentHtml ?? null,
          mentions: input.mentions ?? [],
          created_by: userId,
        },
        include: {
          author: { select: { id: true, name: true, avatar_url: true } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().min(1),
        contentHtml: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const comment = await ctx.prisma.docComment.findUnique({ where: { id: input.id } });
      if (!comment) throw new TRPCError({ code: 'NOT_FOUND' });
      if (comment.created_by !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your comment' });
      }
      return ctx.prisma.docComment.update({
        where: { id: input.id },
        data: {
          content: input.content,
          content_html: input.contentHtml ?? null,
          edited_at: new Date(),
        },
      });
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      return ctx.prisma.docComment.update({
        where: { id: input.id },
        data: {
          is_resolved: true,
          resolved_by: userId,
          resolved_at: new Date(),
        },
      });
    }),

  unresolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.docComment.update({
        where: { id: input.id },
        data: {
          is_resolved: false,
          resolved_by: null,
          resolved_at: null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      const comment = await ctx.prisma.docComment.findUnique({ where: { id: input.id } });
      if (!comment) throw new TRPCError({ code: 'NOT_FOUND' });
      if (comment.created_by !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your comment' });
      }
      return ctx.prisma.docComment.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),
});
