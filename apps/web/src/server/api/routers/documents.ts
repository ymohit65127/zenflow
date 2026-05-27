import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-routers
// ─────────────────────────────────────────────────────────────────────────────

const versionsRouter = createTRPCRouter({
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Main documents router
// ─────────────────────────────────────────────────────────────────────────────

export const documentsRouter = createTRPCRouter({
  versions: versionsRouter,

  list: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const docs = await ctx.prisma.document.findMany({
      where: { organization_id: orgId, parent_id: null, deleted_at: null },
      include: {
        _count: { select: { children: true } },
      },
      orderBy: { updated_at: 'desc' },
    });

    // Fetch owners in bulk
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
        icon: z.string().optional(),
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
          content: { type: 'doc', content: '' } as object,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      return ctx.prisma.document.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.content !== undefined ? { content: input.content as object } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.cover_url !== undefined ? { cover_url: input.cover_url } : {}),
          ...(input.word_count !== undefined ? { word_count: input.word_count } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
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
        include: {
          _count: { select: { children: true } },
        },
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

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      if (!input.query.trim()) return [];
      return ctx.prisma.document.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          title: { contains: input.query, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          type: true,
          icon: true,
          owner_id: true,
          updated_at: true,
        },
        take: 20,
        orderBy: { updated_at: 'desc' },
      });
    }),

  stats: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const userId = ctx.session.user.id as string;

    const [total, folders, documents, sharedWithMe] = await Promise.all([
      ctx.prisma.document.count({
        where: { organization_id: orgId, deleted_at: null },
      }),
      ctx.prisma.document.count({
        where: { organization_id: orgId, deleted_at: null, type: 'FOLDER' },
      }),
      ctx.prisma.document.count({
        where: { organization_id: orgId, deleted_at: null, type: 'DOCUMENT' },
      }),
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

    // Fetch owners in bulk
    const ownerIds = [...new Set(docs.map((d) => d.owner_id))];
    const owners = await ctx.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true, avatar_url: true },
    });
    const ownerMap = new Map(owners.map((u) => [u.id, u]));

    return docs.map((d) => ({ ...d, owner: ownerMap.get(d.owner_id) ?? null }));
  }),
});
