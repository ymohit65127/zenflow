// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const CrmEntityTypeEnum = z.enum(['contact', 'deal', 'account', 'lead']);

export const crmNotesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        entityType: CrmEntityTypeEnum,
        entityId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmNote.findMany({
        where: {
          organization_id: orgId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          deleted_at: null,
        },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
          updater: { select: { id: true, name: true } },
        },
        orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        entityType: CrmEntityTypeEnum,
        entityId: z.string(),
        content: z.string().min(1),
        isPinned: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      return ctx.prisma.crmNote.create({
        data: {
          organization_id: orgId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          content: input.content,
          is_pinned: input.isPinned,
          created_by: userId,
        },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().min(1),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      const existing = await ctx.prisma.crmNote.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });

      return ctx.prisma.crmNote.update({
        where: { id: input.id },
        data: {
          content: input.content,
          ...(input.isPinned !== undefined && { is_pinned: input.isPinned }),
          updated_by: userId,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmNote.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });

      return ctx.prisma.crmNote.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  pin: protectedProcedure
    .input(z.object({ id: z.string(), isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmNote.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });

      return ctx.prisma.crmNote.update({
        where: { id: input.id },
        data: { is_pinned: input.isPinned },
      });
    }),
});
