import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// Sub-routers
import { spacesRouter } from '@/server/api/routers/documents/spaces';
import { versionsRouter } from '@/server/api/routers/documents/versions';
import { commentsRouter } from '@/server/api/routers/documents/comments';
import { favoritesRouter } from '@/server/api/routers/documents/favorites';
import { permissionsRouter } from '@/server/api/routers/documents/permissions';
import { searchRouter } from '@/server/api/routers/documents/search';
import { exportRouter } from '@/server/api/routers/documents/export';

// ─────────────────────────────────────────────────────────────────────────────
// Main documents router
// ─────────────────────────────────────────────────────────────────────────────

export const documentsRouter = createTRPCRouter({
  // Sub-routers
  spaces: spacesRouter,
  versions: versionsRouter,
  comments: commentsRouter,
  favorites: favoritesRouter,
  permissions: permissionsRouter,
  search: searchRouter,
  export: exportRouter,

  // ── Core document procedures ────────────────────────────────────────────────

  list: protectedProcedure
    .input(
      z.object({
        spaceId: z.string().optional(),
        parentId: z.string().nullable().optional(),
        includeArchived: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const docs = await ctx.prisma.document.findMany({
        where: {
          organization_id: orgId,
          parent_id: input.parentId !== undefined ? input.parentId : null,
          deleted_at: null,
          ...(input.spaceId ? { space_id: input.spaceId } : {}),
          ...(!input.includeArchived ? { is_archived: false } : {}),
        },
        include: {
          _count: { select: { children: true } },
        },
        orderBy: { updated_at: 'desc' },
      });

      const ownerIds = [...new Set(docs.map((d) => d.owner_id))];
      const owners = await ctx.prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, avatar_url: true },
      });
      const ownerMap = new Map(owners.map((u) => [u.id, u]));

      return docs.map((d) => ({ ...d, owner: ownerMap.get(d.owner_id) ?? null }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          parent: { select: { id: true, title: true, type: true, icon: true } },
          children: {
            where: { deleted_at: null },
            select: { id: true, title: true, type: true, icon: true, updated_at: true },
            orderBy: { updated_at: 'desc' },
          },
          shares: {
            include: { user: { select: { id: true, name: true, avatar_url: true } } },
          },
        },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });

      const owner = await ctx.prisma.user.findUnique({
        where: { id: doc.owner_id },
        select: { id: true, name: true, avatar_url: true },
      });

      // Increment view count (fire and forget)
      ctx.prisma.docV2
        .updateMany({
          where: { id: doc.id },
          data: { views_count: { increment: 1 }, last_viewed_at: new Date() },
        })
        .catch(() => {});

      return { ...doc, owner: owner ?? null };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).default('Untitled'),
        type: z
          .enum(['DOCUMENT', 'FOLDER', 'DATABASE', 'SPREADSHEET', 'WHITEBOARD', 'TEMPLATE'])
          .default('DOCUMENT'),
        parent_id: z.string().nullable().optional(),
        space_id: z.string().nullable().optional(),
        icon: z.string().optional(),
        content: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      return ctx.prisma.document.create({
        data: {
          organization_id: orgId,
          owner_id: userId,
          title: input.title,
          type: input.type,
          parent_id: input.parent_id ?? null,
          icon: input.icon ?? null,
          status: 'DRAFT',
          content: (input.content ?? { type: 'doc', content: [] }) as object,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.record(z.unknown()).optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
        icon: z.string().nullable().optional(),
        cover_url: z.string().nullable().optional(),
        word_count: z.number().optional(),
        space_id: z.string().nullable().optional(),
        parent_id: z.string().nullable().optional(),
        is_archived: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      const { id, ...data } = input;
      return ctx.prisma.document.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.content !== undefined ? { content: data.content as object } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.icon !== undefined ? { icon: data.icon } : {}),
          ...(data.cover_url !== undefined ? { cover_url: data.cover_url } : {}),
          ...(data.word_count !== undefined ? { word_count: data.word_count } : {}),
          ...(data.space_id !== undefined ? { space_id: data.space_id } : {}),
          ...(data.parent_id !== undefined ? { parent_id: data.parent_id } : {}),
          ...(data.is_archived !== undefined ? { is_archived: data.is_archived, archived_at: data.is_archived ? new Date() : null } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), permanent: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      if (input.permanent) {
        return ctx.prisma.document.delete({ where: { id: input.id } });
      }
      return ctx.prisma.document.update({
        where: { id: input.id },
        data: { deleted_at: new Date(), status: 'ARCHIVED' },
      });
    }),

  getChildren: protectedProcedure
    .input(z.object({ parentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.document.findMany({
        where: { organization_id: orgId, parent_id: input.parentId, deleted_at: null },
        include: { _count: { select: { children: true } } },
        orderBy: [{ type: 'asc' }, { updated_at: 'desc' }],
      });
    }),

  share: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        userId: z.string(),
        permission: z.enum(['VIEW', 'COMMENT', 'EDIT', 'MANAGE']).default('VIEW'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      return ctx.prisma.documentShare.create({
        data: {
          document_id: input.documentId,
          user_id: input.userId,
          permission: input.permission,
        },
      });
    }),

  getShares: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, organization_id: orgId, deleted_at: null },
        select: { id: true },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      return ctx.prisma.documentShare.findMany({
        where: { document_id: input.documentId },
        include: { user: { select: { id: true, name: true, email: true, avatar_url: true } } },
        orderBy: { shared_at: 'desc' },
      });
    }),

  stats: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const userId = ctx.session.user.id as string;

    const [total, folders, documents, sharedWithMe] = await Promise.all([
      ctx.prisma.document.count({ where: { organization_id: orgId, deleted_at: null } }),
      ctx.prisma.document.count({ where: { organization_id: orgId, deleted_at: null, type: 'FOLDER' } }),
      ctx.prisma.document.count({ where: { organization_id: orgId, deleted_at: null, type: 'DOCUMENT' } }),
      ctx.prisma.documentShare.count({
        where: { user_id: userId, document: { organization_id: orgId, deleted_at: null } },
      }),
    ]);

    return { total, folders, documents, sharedWithMe };
  }),

  recent: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const docs = await ctx.prisma.document.findMany({
      where: { organization_id: orgId, deleted_at: null, type: { not: 'FOLDER' } },
      orderBy: { updated_at: 'desc' },
      take: 10,
    });

    const ownerIds = [...new Set(docs.map((d) => d.owner_id))];
    const owners = await ctx.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true, avatar_url: true },
    });
    const ownerMap = new Map(owners.map((u) => [u.id, u]));

    return docs.map((d) => ({ ...d, owner: ownerMap.get(d.owner_id) ?? null }));
  }),

  starred: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const userId = ctx.session.user.id as string;
    const favs = await ctx.prisma.docFavorite.findMany({
      where: { user_id: userId },
      include: {
        document: {
          select: { id: true, title: true, icon: true, updated_at: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    return favs.map((f) => f.document).filter(Boolean);
  }),
});
