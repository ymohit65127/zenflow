import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";

export const auditLogRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        actor_id: z.string().optional(),
        entity_type: z.string().optional(),
        entity_id: z.string().optional(),
        action: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.auditLog.findMany({
        where: {
          organization_id: orgId,
          ...(input.actor_id && { user_id: input.actor_id }),
          ...(input.entity_type && { resource_type: input.entity_type }),
          ...(input.entity_id && { resource_id: input.entity_id }),
          ...(input.action && { action: { contains: input.action } }),
          ...((input.from ?? input.to)
            ? {
                created_at: {
                  ...(input.from && { gte: new Date(input.from) }),
                  ...(input.to && { lte: new Date(input.to) }),
                },
              }
            : {}),
          ...(input.cursor && { created_at: { lt: new Date(input.cursor) } }),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { created_at: "desc" },
        take: input.limit,
      });
    }),

  listActors: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const logs = await ctx.prisma.auditLog.findMany({
      where: { organization_id: orgId, user_id: { not: null } },
      select: { user_id: true, user: { select: { name: true } } },
      distinct: ["user_id"],
      take: 100,
    });
    return logs.map((l: any) => ({
      actor_id: l.user_id as string,
      actor_name: l.user?.name ?? "Unknown",
    }));
  }),

  listEntityTypes: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const logs = await ctx.prisma.auditLog.findMany({
      where: { organization_id: orgId },
      select: { resource_type: true },
      distinct: ["resource_type"],
      take: 50,
    });
    return logs.map((l: any) => l.resource_type as string);
  }),
});
