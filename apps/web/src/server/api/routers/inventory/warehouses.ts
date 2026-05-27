// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const warehousesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.invWarehouse.findMany({
      where: { org_id: orgId, is_active: true },
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
        where: { id: input.id, org_id: orgId },
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
        description: z.string().optional(),
        address: z
          .object({
            line1: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            country: z.string().optional(),
            postal_code: z.string().optional(),
          })
          .optional(),
        allow_negative_stock: z.boolean().default(false),
        is_default: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.invWarehouse.findFirst({
        where: { org_id: orgId, code: input.code },
      });
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Warehouse code already exists' });

      if (input.is_default) {
        await ctx.prisma.invWarehouse.updateMany({
          where: { org_id: orgId },
          data: { is_default: false },
        });
      }

      return ctx.prisma.invWarehouse.create({
        data: {
          org_id: orgId,
          name: input.name,
          code: input.code,
          description: input.description ?? null,
          address: input.address ?? null,
          allow_negative_stock: input.allow_negative_stock,
          is_default: input.is_default,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        address: z.record(z.any()).optional(),
        allow_negative_stock: z.boolean().optional(),
        is_default: z.boolean().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.invWarehouse.findFirst({
        where: { id, org_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });

      if (data.is_default) {
        await ctx.prisma.invWarehouse.updateMany({
          where: { org_id: orgId, id: { not: id } },
          data: { is_default: false },
        });
      }

      return ctx.prisma.invWarehouse.update({ where: { id }, data });
    }),

  // Location CRUD
  addLocation: protectedProcedure
    .input(
      z.object({
        warehouse_id: z.string(),
        parent_id: z.string().optional(),
        name: z.string().min(1),
        code: z.string().min(1),
        location_type: z.enum(['zone', 'aisle', 'rack', 'bin', 'shelf']),
        capacity: z.number().optional(),
        capacity_unit: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const wh = await ctx.prisma.invWarehouse.findFirst({
        where: { id: input.warehouse_id, org_id: orgId },
      });
      if (!wh) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });

      const existing = await ctx.prisma.invLocation.findFirst({
        where: { warehouse_id: input.warehouse_id, code: input.code },
      });
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Location code already exists' });

      return ctx.prisma.invLocation.create({
        data: {
          warehouse_id: input.warehouse_id,
          parent_id: input.parent_id ?? null,
          name: input.name,
          code: input.code,
          location_type: input.location_type,
          capacity: input.capacity ?? null,
          capacity_unit: input.capacity_unit ?? null,
        },
      });
    }),

  listLocations: protectedProcedure
    .input(z.object({ warehouse_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const wh = await ctx.prisma.invWarehouse.findFirst({
        where: { id: input.warehouse_id, org_id: orgId },
      });
      if (!wh) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });
      return ctx.prisma.invLocation.findMany({
        where: { warehouse_id: input.warehouse_id, is_active: true },
        include: {
          children: {
            include: { children: { include: { children: true } } },
          },
        },
        orderBy: { name: 'asc' },
      });
    }),
});
