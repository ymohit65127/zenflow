import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const serialLotRouter = createTRPCRouter({
  // ─── SERIAL NUMBERS ───────────────────────────────────────────────────────

  listSerials: protectedProcedure
    .input(
      z.object({
        product_id: z.string().optional(),
        status: z.enum(['in_stock', 'sold', 'returned', 'damaged', 'expired']).optional(),
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
            product: { organization_id: orgId },
            ...(input.product_id ? { product_id: input.product_id } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.search
              ? { serial_number: { contains: input.search, mode: 'insensitive' } }
              : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invSerialNumber.count({
          where: {
            product: { organization_id: orgId },
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
        serial_number: z.string().min(1),
        warehouse_id: z.string().optional(),
        location_id: z.string().optional(),
        purchased_at: z.string().optional(),
        expires_at: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.prisma.invSerialNumber.findFirst({
        where: { product_id: input.product_id, serial_number: input.serial_number },
      });
      if (exists)
        throw new TRPCError({ code: 'CONFLICT', message: 'Serial number already exists for this product' });

      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.invSerialNumber.create({
        data: {
          organization_id: orgId,
          product_id: input.product_id,
          serial_number: input.serial_number,
          status: 'in_stock',
          warehouse_id: input.warehouse_id ?? null,
          location_id: input.location_id ?? null,
          purchased_at: input.purchased_at ? new Date(input.purchased_at) : null,
          expires_at: input.expires_at ? new Date(input.expires_at) : null,
          notes: input.notes ?? null,
        },
      });
    }),

  updateSerialStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['in_stock', 'sold', 'returned', 'damaged', 'expired']),
        sold_to: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.invSerialNumber.update({
        where: { id: input.id },
        data: {
          status: input.status,
          sold_to: input.sold_to ?? null,
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
            product: { organization_id: orgId },
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
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { expiry_date: 'asc' },
        }),
        ctx.prisma.invLot.count({
          where: {
            product: { organization_id: orgId },
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
        lot_number: z.string().min(1),
        manufacture_date: z.string().optional(),
        expiry_date: z.string().optional(),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const exists = await ctx.prisma.invLot.findFirst({
        where: { product_id: input.product_id, lot_number: input.lot_number },
      });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'Lot number already exists for this product' });

      return ctx.prisma.invLot.create({
        data: {
          organization_id: orgId,
          product_id: input.product_id,
          lot_number: input.lot_number,
          manufacture_date: input.manufacture_date ? new Date(input.manufacture_date) : null,
          expiry_date: input.expiry_date ? new Date(input.expiry_date) : null,
          quantity: input.quantity,
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
          product: { select: { id: true, name: true, sku: true, organization_id: true } },
        },
      });
      if (!lot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lot not found' });
      if (lot.product.organization_id !== orgId) throw new TRPCError({ code: 'FORBIDDEN' });
      return lot;
    }),
});
