// @ts-nocheck
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const ArticleSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).optional(),
  body: z.string().min(1),
  body_html: z.string().optional(),
  category_id: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  visibility: z.enum(['public', 'agents_only', 'org_only']).default('public'),
  tags: z.array(z.string()).default([]),
  meta_description: z.string().max(300).optional(),
  seo_keywords: z.string().max(500).optional(),
  featured_image_url: z.string().url().optional(),
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
      visibility: z.enum(['public', 'agents_only', 'org_only']).optional(),
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
          { body: { contains: input.search, mode: 'insensitive' } },
          { meta_description: { contains: input.search, mode: 'insensitive' } },
          { tags: { has: input.search } },
        ];
      }

      const [items, total] = await Promise.all([
        ctx.prisma.hdArticle.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, color: true } },
            _count: { select: { versions: true, feedback: true } },
          },
          orderBy: { updated_at: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.hdArticle.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const article = await ctx.prisma.hdArticle.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          category: true,
          versions: { orderBy: { version_number: 'desc' }, take: 10 },
          _count: { select: { feedback: true } },
        },
      });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
      return article;
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
        where: { organization_id: org.id, slug: input.slug, status: 'published', visibility: 'public' },
        include: { category: { select: { id: true, name: true } } },
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
          body: input.body,
          body_html: input.body_html ?? null,
          category_id: input.category_id ?? null,
          status: input.status,
          visibility: input.visibility,
          tags: input.tags,
          meta_description: input.meta_description ?? null,
          seo_keywords: input.seo_keywords ?? null,
          featured_image_url: input.featured_image_url ?? null,
          ...(input.status === 'published' ? { published_at: new Date() } : {}),
        },
      });

      // Create initial version
      await ctx.prisma.hdArticleVersion.create({
        data: {
          article_id: article.id,
          version_number: 1,
          title: article.title,
          body: article.body,
          body_html: article.body_html ?? null,
          changed_by: userId,
          change_note: input.change_note ?? 'Initial version',
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
          body: rest.body,
          body_html: rest.body_html ?? null,
          category_id: rest.category_id ?? null,
          status: rest.status,
          visibility: rest.visibility,
          tags: rest.tags,
          meta_description: rest.meta_description ?? null,
          seo_keywords: rest.seo_keywords ?? null,
          featured_image_url: rest.featured_image_url ?? null,
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
          body: rest.body,
          body_html: rest.body_html ?? null,
          changed_by: userId,
          change_note: change_note ?? null,
        },
      });

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
        data: { status: 'published', published_at: new Date() },
      });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdArticle.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
      return ctx.prisma.hdArticle.update({ where: { id: input.id }, data: { status: 'archived' } });
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
        data: { title: version.title, body: version.body, body_html: version.body_html },
      });

      await ctx.prisma.hdArticleVersion.create({
        data: {
          article_id: input.article_id,
          version_number: article._count.versions + 1,
          title: version.title,
          body: version.body,
          body_html: version.body_html ?? null,
          changed_by: userId,
          change_note: `Reverted to version ${version.version_number}`,
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
      ticket_id: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const feedback = await ctx.prisma.hdArticleFeedback.create({
        data: {
          article_id: input.article_id,
          ticket_id: input.ticket_id ?? null,
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
    return ctx.prisma.hdCategory.findMany({
      where: { organization_id: orgId, parent_id: null },
      include: {
        children: {
          include: { _count: { select: { articles: true } } },
          orderBy: { position: 'asc' },
        },
        _count: { select: { articles: true } },
      },
      orderBy: { position: 'asc' },
    });
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
