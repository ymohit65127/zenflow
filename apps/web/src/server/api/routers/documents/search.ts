import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const searchRouter = createTRPCRouter({
  query: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        spaceId: z.string().optional(),
        limit: z.number().int().max(50).default(20),
        offset: z.number().int().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      if (!input.query.trim()) return { results: [], total: 0 };

      // Use Prisma ILIKE for broad compatibility (falls back gracefully if FTS not set up)
      const where = {
        organization_id: orgId,
        deleted_at: null,
        is_archived: false,
        ...(input.spaceId ? { space_id: input.spaceId } : {}),
        OR: [
          { title: { contains: input.query, mode: 'insensitive' as const } },
        ],
      };

      const [results, total] = await Promise.all([
        ctx.prisma.docV2.findMany({
          where,
          select: {
            id: true,
            title: true,
            icon: true,
            space_id: true,
            updated_at: true,
            breadcrumb_path: true,
          },
          orderBy: { updated_at: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.docV2.count({ where }),
      ]);

      return { results, total };
    }),
});
