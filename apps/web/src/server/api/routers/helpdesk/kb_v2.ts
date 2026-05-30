import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { HdArticleVisibility, HdArticleStatus } from '@zenflow/db';

const ArticleSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).optional(),
  content: z.string().min(1),
  content_html: z.string().optional(),
  category_id: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  visibility: z.enum(['internal', 'external', 'agents_only']).default('external'),
  tags: z.array(z.string()).default([]),
  change_note: z.string().max(255).optional(),
});

const CategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().max(7).optional(),
  icon: z.string().max(50).optional(),
  parent_id: z.string().optional(),
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    Date.now().toString(36)
  );
}

export const kbV2Router = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Articles
  // -------------------------------------------------------------------------
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['draft', 'published', 'archived']).optional(),
      category_id: z.string().optional(),
      visibility: z.enum(['internal', 'external', 'agents_only']).optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const skip = (input.page - 1) * input.limit;

      const where: Record<string, unknown> = { organization_id: orgId };
      if (input.status) where['status'] = input.status;
      if (input.category_id) where['category_id'] = input.category_id;
      if (input.visibility) where['visibility'] = input.visibility;
      if (input.search) {
        where['OR'] = [
          { title: { contains: input.search, mode: 'insensitive' } },
          { content: { contains: input.search, mode: 'insensitive' } },
          { tags: { has: input.search } },
        ];
      }

      const [items, total] = await Promise.all([
        ctx.prisma.hdArticle.findMany({
          where,
          include: {
            _count: { select: { versions: true, feedback: true } },
          },
          orderBy: { updated_at: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.hdArticle.count({ where }),
      ]);

      // Attach category data separately
      const categoryIds = [...new Set(items.map((a) => a.category_id).filter(Boolean))] as string[];
      const categoriesMap = new Map<string, { id: string; name: string; color: string | null }>();
      if (categoryIds.length > 0) {
        const cats = await ctx.prisma.hdCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, color: true },
        });
        cats.forEach((c) => categoriesMap.set(c.id, c));
      }

      const itemsWithCategory = items.map((a) => ({
        ...a,
        category: a.category_id ? (categoriesMap.get(a.category_id) ?? null) : null,
      }));

      return { items: itemsWithCategory, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const article = await ctx.prisma.hdArticle.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          versions: { orderBy: { version_number: 'desc' }, take: 10 },
          _count: { select: { feedback: true } },
        },
      });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });

      // Get category separately
      const category = article.category_id
        ? await ctx.prisma.hdCategory.findFirst({ where: { id: article.category_id }, select: { id: true, name: true, color: true } })
        : null;

      return { ...article, category };
    }),

  getPublic: publicProcedure
    .input(z.object({ org_slug: z.string(), slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findFirst({
        where: { slug: input.org_slug },
        select: { id: true },
      });
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

      const article = await ctx.prisma.hdArticle.findFirst({
        where: { organization_id: org.id, slug: input.slug, status: 'published' as HdArticleStatus, visibility: 'external' as HdArticleVisibility },
      });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });

      await ctx.prisma.hdArticle.update({ where: { id: article.id }, data: { views_count: { increment: 1 } } });

      return article;
    }),

  create: protectedProcedure
    .input(ArticleSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;
      const slug = input.slug ?? generateSlug(input.title);

      const article = await ctx.prisma.hdArticle.create({
        data: {
          organization_id: orgId,
          author_id: userId,
          title: input.title,
          slug,
          content: input.content,
          content_html: input.content_html ?? null,
          category_id: input.category_id ?? null,
          status: input.status as HdArticleStatus,
          visibility: input.visibility as HdArticleVisibility,
          tags: input.tags,
          ...(input.status === 'published' ? { published_at: new Date() } : {}),
        },
      });

      // Create initial version
      await ctx.prisma.hdArticleVersion.create({
        data: {
          article_id: article.id,
          version_number: 1,
          title: article.title,
          content: article.content,
          changed_by: userId,
        },
      });

      return article;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(ArticleSchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;
      const { id, change_note, ...rest } = input;

      const existing = await ctx.prisma.hdArticle.findFirst({
        where: { id, organization_id: orgId },
        include: { _count: { select: { versions: true } } },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });

      const updated = await ctx.prisma.hdArticle.update({
        where: { id },
        data: {
          title: rest.title,
          content: rest.content,
          content_html: rest.content_html ?? null,
          category_id: rest.category_id ?? null,
          status: rest.status as HdArticleStatus,
          visibility: rest.visibility as HdArticleVisibility,
          tags: rest.tags,
          ...(rest.status === 'published' && existing.status !== 'published' ? { published_at: new Date() } : {}),
        },
      });

      // Create new version
      const versionNumber = existing._count.versions + 1;
      await ctx.prisma.hdArticleVersion.create({
        data: {
          article_id: id,
          version_number: versionNumber,
          title: rest.title,
          content: rest.content,
          changed_by: userId,
        },
      });

      void change_note; // kept for API compatibility

      return updated;
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdArticle.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
      return ctx.prisma.hdArticle.update({
        where: { id: input.id },
        data: { status: 'published' as HdArticleStatus, published_at: new Date() },
      });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdArticle.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
      return ctx.prisma.hdArticle.update({ where: { id: input.id }, data: { status: 'archived' as HdArticleStatus } });
    }),

  versions: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const article = await ctx.prisma.hdArticle.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
      return ctx.prisma.hdArticleVersion.findMany({
        where: { article_id: input.id },
        orderBy: { version_number: 'desc' },
      });
    }),

  revertToVersion: protectedProcedure
    .input(z.object({ article_id: z.string(), version_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const article = await ctx.prisma.hdArticle.findFirst({
        where: { id: input.article_id, organization_id: orgId },
        include: { _count: { select: { versions: true } } },
      });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });

      const version = await ctx.prisma.hdArticleVersion.findFirst({ where: { id: input.version_id, article_id: input.article_id } });
      if (!version) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });

      const updated = await ctx.prisma.hdArticle.update({
        where: { id: input.article_id },
        data: { title: version.title, content: version.content },
      });

      await ctx.prisma.hdArticleVersion.create({
        data: {
          article_id: input.article_id,
          version_number: article._count.versions + 1,
          title: version.title,
          content: version.content,
          changed_by: userId,
        },
      });

      return updated;
    }),

  // -------------------------------------------------------------------------
  // Feedback
  // -------------------------------------------------------------------------
  submitFeedback: publicProcedure
    .input(z.object({
      article_id: z.string(),
      is_helpful: z.boolean(),
      comment: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const feedback = await ctx.prisma.hdArticleFeedback.create({
        data: {
          article_id: input.article_id,
          is_helpful: input.is_helpful,
          comment: input.comment ?? null,
        },
      });

      await ctx.prisma.hdArticle.update({
        where: { id: input.article_id },
        data: input.is_helpful
          ? { helpful_count: { increment: 1 } }
          : { not_helpful_count: { increment: 1 } },
      });

      return feedback;
    }),

  listFeedback: protectedProcedure
    .input(z.object({ article_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const article = await ctx.prisma.hdArticle.findFirst({ where: { id: input.article_id, organization_id: orgId } });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
      return ctx.prisma.hdArticleFeedback.findMany({
        where: { article_id: input.article_id },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    }),

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------
  listCategories: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const categories = await ctx.prisma.hdCategory.findMany({
      where: { organization_id: orgId, parent_id: null },
      include: {
        children: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    });

    // Count articles per category separately
    const allCatIds = categories.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)]);
    const articleCounts = await ctx.prisma.hdArticle.groupBy({
      by: ['category_id'],
      where: { category_id: { in: allCatIds } },
      _count: { id: true },
    });
    const countMap = new Map(articleCounts.map((r) => [r.category_id, r._count.id]));

    return categories.map((c) => ({
      ...c,
      _count: { articles: countMap.get(c.id) ?? 0 },
      children: c.children.map((ch) => ({
        ...ch,
        _count: { articles: countMap.get(ch.id) ?? 0 },
      })),
    }));
  }),

  createCategory: protectedProcedure
    .input(CategorySchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.hdCategory.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          icon: input.icon ?? null,
          parent_id: input.parent_id ?? null,
          position: input.position,
          is_active: input.is_active,
        },
      });
    }),

  updateCategory: protectedProcedure
    .input(z.object({ id: z.string() }).merge(CategorySchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;
      const existing = await ctx.prisma.hdCategory.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found' });
      return ctx.prisma.hdCategory.update({
        where: { id },
        data: {
          name: rest.name,
          description: rest.description ?? null,
          color: rest.color ?? null,
          icon: rest.icon ?? null,
          parent_id: rest.parent_id ?? null,
          position: rest.position,
          is_active: rest.is_active,
        },
      });
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdCategory.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found' });
      return ctx.prisma.hdCategory.delete({ where: { id: input.id } });
    }),
});
