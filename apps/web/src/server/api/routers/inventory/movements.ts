// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// Movement types that reduce stock
const OUTBOUND_TYPES = [
  'sale_delivery',
  'transfer_out',
  'adjustment_out',
  'production_input',
  'return_out',
  'scrapped',
] as const;

// All valid movement types
const MOVEMENT_TYPE_ENUM = z.enum([
  'purchase_receipt',
  'sale_delivery',
  'transfer_out',
  'transfer_in',
  'adjustment_in',
  'adjustment_out',
  'production_input',
  'production_output',
  'return_in',
  'return_out',
  'opening_balance',
  'scrapped',
]);

export const movementsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        product_id: z.string().optional(),
        warehouse_id: z.string().optional(),
        movement_type: MOVEMENT_TYPE_ENUM.optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invStockMovement.findMany({
          where: {
            org_id: orgId,
            ...(input.product_id ? { product_id: input.product_id } : {}),
            ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
            ...(input.movement_type ? { movement_type: input.movement_type } : {}),
            ...(input.from_date || input.to_date
              ? {
                  movement_date: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, sku: true, variant_attributes: true } },
            warehouse: { select: { id: true, name: true, code: true } },
            from_location: { select: { id: true, name: true, code: true } },
            to_location: { select: { id: true, name: true, code: true } },
            lot: { select: { id: true, lot_number: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { movement_date: 'desc' },
        }),
        ctx.prisma.invStockMovement.count({
          where: {
            org_id: orgId,
            ...(input.product_id ? { product_id: input.product_id } : {}),
            ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
            ...(input.movement_type ? { movement_type: input.movement_type } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  getByReference: protectedProcedure
    .input(
      z.object({
        reference_type: z.string(),
        reference_id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.invStockMovement.findMany({
        where: {
          org_id: orgId,
          reference_type: input.reference_type,
          reference_id: input.reference_id,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { movement_date: 'desc' },
      });
    }),

  // Core stock movement engine
  create: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        variant_id: z.string().optional(),
        warehouse_id: z.string(),
        from_location_id: z.string().optional(),
        to_location_id: z.string().optional(),
        lot_id: z.string().optional(),
        serial_number: z.string().optional(),
        quantity: z.number().positive(),
        movement_type: MOVEMENT_TYPE_ENUM,
        unit_cost: z.number().min(0).default(0),
        reference_type: z.string().optional(),
        reference_id: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const isOutbound = (OUTBOUND_TYPES as readonly string[]).includes(input.movement_type);
      const signedQty = isOutbound ? -Math.abs(input.quantity) : Math.abs(input.quantity);
      const locationId = input.to_location_id ?? input.from_location_id ?? null;

      // All operations in a transaction
      const movement = await ctx.prisma.$transaction(async (tx) => {
        // 1. Verify warehouse belongs to org
        const warehouse = await tx.invWarehouse.findFirst({
          where: { id: input.warehouse_id, org_id: orgId },
        });
        if (!warehouse) throw new TRPCError({ code: 'NOT_FOUND', message: 'Warehouse not found' });

        // 2. Get current stock level
        const existing = await tx.invStockLevel.findUnique({
          where: {
            product_id_variant_id_warehouse_id_location_id: {
              product_id: input.product_id,
              variant_id: input.variant_id ?? null,
              warehouse_id: input.warehouse_id,
              location_id: locationId,
            },
          },
        });

        const currentQty = Number(existing?.quantity_on_hand ?? 0);
        const newQty = currentQty + signedQty;

        // 3. Check negative stock
        if (newQty < 0 && !warehouse.allow_negative_stock) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient stock. Available: ${currentQty}, Requested: ${input.quantity}`,
          });
        }

        // 4. Compute new average cost (weighted average for inbound)
        let newAvgCost = Number(existing?.average_cost ?? input.unit_cost);
        if (!isOutbound && input.unit_cost > 0) {
          const prevTotal = currentQty * newAvgCost;
          const addedTotal = input.quantity * input.unit_cost;
          const postQty = Math.max(newQty, 0);
          newAvgCost = postQty > 0 ? (prevTotal + addedTotal) / postQty : input.unit_cost;
        }

        // 5. Upsert InvStockLevel
        await tx.invStockLevel.upsert({
          where: {
            product_id_variant_id_warehouse_id_location_id: {
              product_id: input.product_id,
              variant_id: input.variant_id ?? null,
              warehouse_id: input.warehouse_id,
              location_id: locationId,
            },
          },
          create: {
            org_id: orgId,
            product_id: input.product_id,
            variant_id: input.variant_id ?? null,
            warehouse_id: input.warehouse_id,
            location_id: locationId,
            quantity_on_hand: signedQty,
            average_cost: input.unit_cost,
            total_value: Math.abs(signedQty) * input.unit_cost,
            last_movement_at: new Date(),
          },
          update: {
            quantity_on_hand: { increment: signedQty },
            average_cost: newAvgCost,
            total_value: newQty * newAvgCost,
            last_movement_at: new Date(),
          },
        });

        // 6. Create the movement record
        const mov = await tx.invStockMovement.create({
          data: {
            org_id: orgId,
            movement_type: input.movement_type,
            reference_type: input.reference_type ?? null,
            reference_id: input.reference_id ?? null,
            product_id: input.product_id,
            variant_id: input.variant_id ?? null,
            warehouse_id: input.warehouse_id,
            from_location_id: input.from_location_id ?? null,
            to_location_id: input.to_location_id ?? null,
            lot_id: input.lot_id ?? null,
            serial_number: input.serial_number ?? null,
            quantity: Math.abs(input.quantity),
            unit_cost: input.unit_cost,
            total_cost: Math.abs(input.quantity) * input.unit_cost,
            running_stock: newQty,
            created_by: ctx.session.user.id,
            notes: input.notes ?? null,
          },
          include: {
            product: { select: { name: true, sku: true } },
            warehouse: { select: { name: true } },
          },
        });

        // 7. Update serial number status if tracked
        if (input.serial_number) {
          await tx.invSerialNumber.updateMany({
            where: { product_id: input.product_id, serial_number: input.serial_number },
            data: {
              status: isOutbound ? 'sold' : 'available',
              warehouse_id: isOutbound ? null : input.warehouse_id,
              location_id: isOutbound ? null : input.to_location_id,
            },
          });
        }

        return mov;
      });

      return movement;
    }),
});
