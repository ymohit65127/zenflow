import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma as _prismaInstance } from '@zenflow/db';

type PrismaInstance = typeof _prismaInstance;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateTicketNumber(prisma: PrismaInstance, orgId: string): Promise<string> {
  const last = await prisma.ticket.findFirst({
    where: { organization_id: orgId },
    orderBy: { ticket_number: 'desc' },
    select: { ticket_number: true },
  });
  if (!last) return 'TKT-0001';
  const num = parseInt(last.ticket_number.replace(/\D/g, ''), 10);
  return `TKT-${String(isNaN(num) ? 1 : num + 1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

const ticketsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        category_id: z.string().optional(),
        assignee_id: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const skip = (input.page - 1) * input.limit;

      const where = {
        organization_id: orgId,
        deleted_at: null,
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.category_id ? { category_id: input.category_id } : {}),
        ...(input.assignee_id
          ? { assignments: { some: { user_id: input.assignee_id } } }
          : {}),
        ...(input.search
          ? {
              OR: [
                { subject: { contains: input.search, mode: 'insensitive' as const } },
                { ticket_number: { contains: input.search, mode: 'insensitive' as const } },
                { description: { contains: input.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.ticket.findMany({
          where,
          include: {
            creator: { select: { id: true, name: true, avatar_url: true } },
            category: { select: { id: true, name: true, color: true } },
            assignments: { include: { user: { select: { id: true, name: true, avatar_url: true } } } },
            _count: { select: { replies: true } },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.ticket.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const ticket = await ctx.prisma.ticket.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true, email: true } },
          category: { select: { id: true, name: true, color: true } },
          sla_policy: true,
          assignments: { include: { user: { select: { id: true, name: true, avatar_url: true } } } },
          replies: {
            orderBy: { created_at: 'asc' },
          },
        },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });
      return ticket;
    }),

  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        type: z.enum(['QUESTION', 'PROBLEM', 'FEATURE_REQUEST', 'BUG', 'OTHER']).default('QUESTION'),
        channel: z.enum(['WEB', 'EMAIL', 'CHAT', 'PHONE', 'API']).default('WEB'),
        category_id: z.string().optional(),
        sla_policy_id: z.string().optional(),
        tags: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;
      const ticket_number = await generateTicketNumber(ctx.prisma, orgId);

      return ctx.prisma.ticket.create({
        data: {
          organization_id: orgId,
          creator_id: userId,
          ticket_number,
          subject: input.subject,
          description: input.description ?? null,
          priority: input.priority,
          type: input.type,
          channel: input.channel,
          category_id: input.category_id ?? null,
          sla_policy_id: input.sla_policy_id ?? null,
          tags: input.tags,
          status: 'OPEN',
        },
        include: {
          creator: { select: { id: true, name: true, avatar_url: true } },
          category: { select: { id: true, name: true, color: true } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        subject: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        type: z.enum(['QUESTION', 'PROBLEM', 'FEATURE_REQUEST', 'BUG', 'OTHER']).optional(),
        category_id: z.string().optional().nullable(),
        sla_policy_id: z.string().optional().nullable(),
        tags: z.array(z.string()).optional(),
        due_at: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, due_at, ...rest } = input;

      const existing = await ctx.prisma.ticket.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      return ctx.prisma.ticket.update({
        where: { id },
        data: {
          ...rest,
          ...(due_at !== undefined ? { due_at: due_at ? new Date(due_at) : null } : {}),
        },
      });
    }),

  assign: protectedProcedure
    .input(z.object({ ticket_id: z.string(), user_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const ticket = await ctx.prisma.ticket.findFirst({
        where: { id: input.ticket_id, organization_id: orgId, deleted_at: null },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      await ctx.prisma.ticketAssignment.upsert({
        where: { ticket_id_user_id: { ticket_id: input.ticket_id, user_id: input.user_id } },
        create: { ticket_id: input.ticket_id, user_id: input.user_id },
        update: {},
      });

      return ctx.prisma.ticket.update({
        where: { id: input.ticket_id },
        data: { status: 'IN_PROGRESS' },
      });
    }),

  reply: protectedProcedure
    .input(
      z.object({
        ticket_id: z.string(),
        content: z.string().min(1),
        is_internal: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id;

      const ticket = await ctx.prisma.ticket.findFirst({
        where: { id: input.ticket_id, organization_id: orgId, deleted_at: null },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      const reply = await ctx.prisma.ticketReply.create({
        data: {
          ticket_id: input.ticket_id,
          user_id: userId,
          content: input.content,
          is_internal: input.is_internal,
        },
      });

      // Mark first response time if not set
      if (!ticket.first_response_at && !input.is_internal) {
        await ctx.prisma.ticket.update({
          where: { id: input.ticket_id },
          data: { first_response_at: new Date() },
        });
      }

      return reply;
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const ticket = await ctx.prisma.ticket.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      return ctx.prisma.ticket.update({
        where: { id: input.id },
        data: { status: 'RESOLVED', resolved_at: new Date() },
      });
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const ticket = await ctx.prisma.ticket.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      return ctx.prisma.ticket.update({
        where: { id: input.id },
        data: { status: 'CLOSED', closed_at: new Date() },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [open, inProgress, resolvedToday, respondedTickets] = await Promise.all([
      ctx.prisma.ticket.count({
        where: { organization_id: orgId, deleted_at: null, status: 'OPEN' },
      }),
      ctx.prisma.ticket.count({
        where: { organization_id: orgId, deleted_at: null, status: 'IN_PROGRESS' },
      }),
      ctx.prisma.ticket.count({
        where: { organization_id: orgId, deleted_at: null, status: 'RESOLVED', resolved_at: { gte: startOfDay } },
      }),
      ctx.prisma.ticket.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          first_response_at: { not: null },
          created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { created_at: true, first_response_at: true },
      }),
    ]);

    let avgResponseTimeHours = 0;
    if (respondedTickets.length > 0) {
      const totalMs = respondedTickets.reduce((sum, t) => {
        if (!t.first_response_at) return sum;
        return sum + (t.first_response_at.getTime() - t.created_at.getTime());
      }, 0);
      avgResponseTimeHours = Math.round((totalMs / respondedTickets.length / 3_600_000) * 10) / 10;
    }

    return { open, inProgress, resolvedToday, avgResponseTimeHours };
  }),
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categoriesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.ticketCategory.findMany({
      where: { organization_id: orgId },
      include: {
        _count: { select: { tickets: { where: { deleted_at: null } } } },
        children: { select: { id: true, name: true, color: true } },
      },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        color: z.string().optional(),
        parent_id: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.ticketCategory.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          parent_id: input.parent_id ?? null,
        },
      });
    }),
});

// ---------------------------------------------------------------------------
// SLA
// ---------------------------------------------------------------------------

const slaRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.slaPolicy.findMany({
      where: { organization_id: orgId },
      orderBy: { name: 'asc' },
    });
  }),
});

// ---------------------------------------------------------------------------
// Knowledge Base
// ---------------------------------------------------------------------------

const kbRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
        category_id: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const skip = (input.page - 1) * input.limit;

      const where = {
        organization_id: orgId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.category_id ? { category_id: input.category_id } : {}),
        ...(input.search
          ? {
              OR: [
                { title: { contains: input.search, mode: 'insensitive' as const } },
                { content: { contains: input.search, mode: 'insensitive' as const } },
                { tags: { has: input.search } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.knowledgeBaseArticle.findMany({
          where,
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            status: true,
            tags: true,
            views: true,
            helpful_count: true,
            not_helpful_count: true,
            created_at: true,
            updated_at: true,
            category_id: true,
          },
          orderBy: { updated_at: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.knowledgeBaseArticle.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const article = await ctx.prisma.knowledgeBaseArticle.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });

      // Increment view count
      await ctx.prisma.knowledgeBaseArticle.update({
        where: { id: input.id },
        data: { views: { increment: 1 } },
      });

      return article;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        excerpt: z.string().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
        tags: z.array(z.string()).default([]),
        category_id: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const slug = input.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
        '-' +
        Date.now().toString(36);

      return ctx.prisma.knowledgeBaseArticle.create({
        data: {
          organization_id: orgId,
          title: input.title,
          slug,
          content: input.content,
          excerpt: input.excerpt,
          status: input.status,
          tags: input.tags,
          category_id: input.category_id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        excerpt: z.string().optional().nullable(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
        tags: z.array(z.string()).optional(),
        category_id: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...rest } = input;

      const existing = await ctx.prisma.knowledgeBaseArticle.findFirst({
        where: { id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });

      return ctx.prisma.knowledgeBaseArticle.update({
        where: { id },
        data: rest,
      });
    }),
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const helpdeskRouter = createTRPCRouter({
  tickets: ticketsRouter,
  categories: categoriesRouter,
  sla: slaRouter,
  kb: kbRouter,
});
