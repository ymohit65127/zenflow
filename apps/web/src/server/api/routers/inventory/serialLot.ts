// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const serialLotRouter = createTRPCRouter({
  // ─── SERIAL NUMBERS ───────────────────────────────────────────────────────

  listSerials: protectedProcedure
    .input(
      z.object({
        product_id: z.string().optional(),
        status: z.enum(['available', 'sold', 'rma', 'scrapped', 'in_transit']).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invSerialNumber.findMany({
          where: {
            product: { org_id: orgId },
            ...(input.product_id ? { product_id: input.product_id } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.search
              ? { serial_number: { contains: input.search, mode: 'insensitive' } }
              : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, sku: true, variant_attributes: true } },
            warehouse: { select: { id: true, name: true } },
            location: { select: { id: true, name: true, code: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invSerialNumber.count({
          where: {
            product: { org_id: orgId },
            ...(input.product_id ? { product_id: input.product_id } : {}),
            ...(input.status ? { status: input.status } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  createSerial: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        variant_id: z.string().optional(),
        serial_number: z.string().min(1),
        warehouse_id: z.string().optional(),
        location_id: z.string().optional(),
        purchase_date: z.string().optional(),
        expiry_date: z.string().optional(),
        warranty_until: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.prisma.invSerialNumber.findFirst({
        where: { product_id: input.product_id, serial_number: input.serial_number },
      });
      if (exists)
        throw new TRPCError({ code: 'CONFLICT', message: 'Serial number already exists for this product' });

      return ctx.prisma.invSerialNumber.create({
        data: {
          product_id: input.product_id,
          variant_id: input.variant_id ?? null,
          serial_number: input.serial_number,
          status: 'available',
          warehouse_id: input.warehouse_id ?? null,
          location_id: input.location_id ?? null,
          purchase_date: input.purchase_date ? new Date(input.purchase_date) : null,
          expiry_date: input.expiry_date ? new Date(input.expiry_date) : null,
          warranty_until: input.warranty_until ? new Date(input.warranty_until) : null,
          notes: input.notes ?? null,
        },
      });
    }),

  updateSerialStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['available', 'sold', 'rma', 'scrapped', 'in_transit']),
        sale_reference: z.string().optional(),
        sold_to_contact_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.invSerialNumber.update({
        where: { id: input.id },
        data: {
          status: input.status,
          sale_reference: input.sale_reference ?? null,
          sold_to_contact_id: input.sold_to_contact_id ?? null,
        },
      });
    }),

  // ─── LOTS / BATCHES ───────────────────────────────────────────────────────

  listLots: protectedProcedure
    .input(
      z.object({
        product_id: z.string().optional(),
        expiring_within_days: z.number().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const now = new Date();
      const [items, total] = await Promise.all([
        ctx.prisma.invLot.findMany({
          where: {
            product: { org_id: orgId },
            ...(input.product_id ? { product_id: input.product_id } : {}),
            ...(input.expiring_within_days
              ? {
                  expiry_date: {
                    gte: now,
                    lte: new Date(now.getTime() + input.expiring_within_days * 86400000),
                  },
                }
              : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, sku: true, variant_attributes: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { expiry_date: 'asc' },
        }),
        ctx.prisma.invLot.count({
          where: {
            product: { org_id: orgId },
            ...(input.product_id ? { product_id: input.product_id } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  createLot: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        variant_id: z.string().optional(),
        lot_number: z.string().min(1),
        manufacture_date: z.string().optional(),
        expiry_date: z.string().optional(),
        quantity_received: z.number().positive(),
        cost_per_unit: z.number().min(0).default(0),
        supplier_lot_number: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.prisma.invLot.findFirst({
        where: { product_id: input.product_id, lot_number: input.lot_number },
      });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'Lot number already exists for this product' });

      return ctx.prisma.invLot.create({
        data: {
          product_id: input.product_id,
          variant_id: input.variant_id ?? null,
          lot_number: input.lot_number,
          manufacture_date: input.manufacture_date ? new Date(input.manufacture_date) : null,
          expiry_date: input.expiry_date ? new Date(input.expiry_date) : null,
          quantity_received: input.quantity_received,
          quantity_remaining: input.quantity_received,
          cost_per_unit: input.cost_per_unit,
          supplier_lot_number: input.supplier_lot_number ?? null,
          notes: input.notes ?? null,
        },
      });
    }),

  getLotTrace: protectedProcedure
    .input(z.object({ lot_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const lot = await ctx.prisma.invLot.findUnique({
        where: { id: input.lot_id },
        include: {
          product: { select: { id: true, name: true, sku: true, org_id: true } },
          movements: {
            include: {
              warehouse: { select: { id: true, name: true } },
              from_location: { select: { id: true, name: true } },
              to_location: { select: { id: true, name: true } },
            },
            orderBy: { movement_date: 'asc' },
          },
        },
      });
      if (!lot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lot not found' });
      if (lot.product.org_id !== orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      return lot;
    }),
});
