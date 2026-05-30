import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@zenflow/db';

export const warehousesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.invWarehouse.findMany({
      where: { organization_id: orgId, is_active: true },
      include: {
        _count: { select: { locations: true, stock_levels: true } },
      },
      orderBy: { name: 'asc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const wh = await ctx.prisma.invWarehouse.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          locations: {
            where: { parent_id: null },
            include: {
              children: {
                include: {
                  children: {
                    include: { children: true },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
          },
          _count: { select: { stock_levels: true } },
        },
      });
      if (!wh) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });
      return wh;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        code: z.string().min(1).toUpperCase(),
        address: z
          .object({
            line1: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            country: z.string().optional(),
            postal_code: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.invWarehouse.findFirst({
        where: { organization_id: orgId, code: input.code },
      });
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Warehouse code already exists' });

      return ctx.prisma.invWarehouse.create({
        data: {
          organization_id: orgId,
          name: input.name,
          code: input.code,
          address: input.address !== undefined ? input.address as Prisma.InputJsonValue : Prisma.JsonNull,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        address: z.record(z.any()).optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, address, ...rest } = input;
      const existing = await ctx.prisma.invWarehouse.findFirst({
        where: { id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });

      return ctx.prisma.invWarehouse.update({
        where: { id },
        data: {
          ...rest,
          ...(address !== undefined ? { address: address as Prisma.InputJsonValue } : {}),
        },
      });
    }),

  // Location CRUD
  addLocation: protectedProcedure
    .input(
      z.object({
        warehouse_id: z.string(),
        parent_id: z.string().optional(),
        name: z.string().min(1),
        code: z.string().min(1),
        location_type: z.enum(['zone', 'aisle', 'bin', 'shelf', 'floor']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const wh = await ctx.prisma.invWarehouse.findFirst({
        where: { id: input.warehouse_id, organization_id: orgId },
      });
      if (!wh) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });

      const existing = await ctx.prisma.invLocation.findFirst({
        where: { warehouse_id: input.warehouse_id, code: input.code },
      });
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Location code already exists' });

      return ctx.prisma.invLocation.create({
        data: {
          organization_id: orgId,
          warehouse_id: input.warehouse_id,
          parent_id: input.parent_id ?? null,
          name: input.name,
          code: input.code,
          location_type: input.location_type,
        },
      });
    }),

  listLocations: protectedProcedure
    .input(z.object({ warehouse_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const wh = await ctx.prisma.invWarehouse.findFirst({
        where: { id: input.warehouse_id, organization_id: orgId },
      });
      if (!wh) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });
      return ctx.prisma.invLocation.findMany({
        where: { warehouse_id: input.warehouse_id },
        include: {
          children: {
            include: { children: { include: { children: true } } },
          },
        },
        orderBy: { name: 'asc' },
      });
    }),
});
