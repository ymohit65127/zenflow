// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateTransferNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invStockTransfer.findFirst({
    where: { org_id: orgId, transfer_number: { startsWith: 'TRF-' } },
    orderBy: { created_at: 'desc' },
    select: { transfer_number: true },
  });
  const num = last
    ? parseInt(last.transfer_number.replace('TRF-', '') || '0', 10)
    : 0;
  return `TRF-${String(num + 1).padStart(5, '0')}`;
}

export const transfersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'in_transit', 'received', 'cancelled']).optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invStockTransfer.findMany({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
          },
          include: {
            from_warehouse: { select: { id: true, name: true, code: true } },
            to_warehouse: { select: { id: true, name: true, code: true } },
            _count: { select: { lines: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invStockTransfer.count({
          where: { org_id: orgId, ...(input.status ? { status: input.status } : {}) },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          from_warehouse: true,
          to_warehouse: true,
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
              from_location: { select: { id: true, name: true, code: true } },
              to_location: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      return transfer;
    }),

  create: protectedProcedure
    .input(
      z.object({
        from_warehouse_id: z.string(),
        to_warehouse_id: z.string(),
        scheduled_date: z.string().optional(),
        notes: z.string().optional(),
        lines: z.array(
          z.object({
            product_id: z.string(),
            variant_id: z.string().optional(),
            from_location_id: z.string().optional(),
            to_location_id: z.string().optional(),
            quantity_requested: z.number().positive(),
            unit_cost: z.number().min(0).default(0),
            lot_id: z.string().optional(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      if (input.from_warehouse_id === input.to_warehouse_id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Source and destination warehouses must differ' });
      }

      const transferNumber = await generateTransferNumber(ctx.prisma, orgId);

      return ctx.prisma.invStockTransfer.create({
        data: {
          org_id: orgId,
          transfer_number: transferNumber,
          from_warehouse_id: input.from_warehouse_id,
          to_warehouse_id: input.to_warehouse_id,
          status: 'draft',
          scheduled_date: input.scheduled_date ? new Date(input.scheduled_date) : null,
          notes: input.notes ?? null,
          created_by: ctx.session.user.id,
          lines: {
            create: input.lines.map((line) => ({
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              from_location_id: line.from_location_id ?? null,
              to_location_id: line.to_location_id ?? null,
              quantity_requested: line.quantity_requested,
              quantity_shipped: 0,
              quantity_received: 0,
              unit_cost: line.unit_cost,
              lot_id: line.lot_id ?? null,
            })),
          },
        },
        include: {
          from_warehouse: true,
          to_warehouse: true,
          lines: { include: { product: { select: { name: true, sku: true } } } },
        },
      });
    }),

  ship: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        lines: z.array(
          z.object({
            line_id: z.string(),
            quantity_shipped: z.number().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, org_id: orgId },
        include: { lines: true },
      });
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      if (transfer.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft transfers can be shipped' });
      }

      await ctx.prisma.$transaction(async (tx) => {
        for (const shipLine of input.lines) {
          const line = transfer.lines.find((l) => l.id === shipLine.line_id);
          if (!line) continue;
          if (shipLine.quantity_shipped <= 0) continue;

          // Check source stock
          const srcLevel = await tx.invStockLevel.findUnique({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: line.variant_id ?? null,
                warehouse_id: transfer.from_warehouse_id,
                location_id: line.from_location_id ?? null,
              },
            },
          });
          const available = Number(srcLevel?.quantity_on_hand ?? 0);
          const fromWarehouse = await tx.invWarehouse.findUnique({
            where: { id: transfer.from_warehouse_id },
          });
          if (available < shipLine.quantity_shipped && !fromWarehouse?.allow_negative_stock) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient stock for product ${line.product_id}. Available: ${available}, Requested: ${shipLine.quantity_shipped}`,
            });
          }

          // Deduct from source
          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: line.variant_id ?? null,
                warehouse_id: transfer.from_warehouse_id,
                location_id: line.from_location_id ?? null,
              },
            },
            create: {
              org_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.from_warehouse_id,
              location_id: line.from_location_id ?? null,
              quantity_on_hand: -shipLine.quantity_shipped,
              average_cost: Number(line.unit_cost),
              total_value: 0,
              last_movement_at: new Date(),
            },
            update: {
              quantity_on_hand: { decrement: shipLine.quantity_shipped },
              last_movement_at: new Date(),
            },
          });

          // Create transfer_out movement
          await tx.invStockMovement.create({
            data: {
              org_id: orgId,
              movement_type: 'transfer_out',
              reference_type: 'stock_transfer',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.from_warehouse_id,
              from_location_id: line.from_location_id ?? null,
              lot_id: line.lot_id ?? null,
              quantity: shipLine.quantity_shipped,
              unit_cost: Number(line.unit_cost),
              total_cost: shipLine.quantity_shipped * Number(line.unit_cost),
              running_stock: available - shipLine.quantity_shipped,
              created_by: ctx.session.user.id,
            },
          });

          await tx.invStockTransferLine.update({
            where: { id: shipLine.line_id },
            data: { quantity_shipped: shipLine.quantity_shipped },
          });
        }

        await tx.invStockTransfer.update({
          where: { id: input.id },
          data: { status: 'in_transit', shipped_date: new Date() },
        });
      });

      return ctx.prisma.invStockTransfer.findUnique({
        where: { id: input.id },
        include: { lines: { include: { product: { select: { name: true, sku: true } } } }, from_warehouse: true, to_warehouse: true },
      });
    }),

  receive: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        lines: z.array(
          z.object({
            line_id: z.string(),
            quantity_received: z.number().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, org_id: orgId },
        include: { lines: true },
      });
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      if (transfer.status !== 'in_transit') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only in-transit transfers can be received' });
      }

      await ctx.prisma.$transaction(async (tx) => {
        for (const recLine of input.lines) {
          const line = transfer.lines.find((l) => l.id === recLine.line_id);
          if (!line || recLine.quantity_received <= 0) continue;

          // Add to destination
          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: line.variant_id ?? null,
                warehouse_id: transfer.to_warehouse_id,
                location_id: line.to_location_id ?? null,
              },
            },
            create: {
              org_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.to_warehouse_id,
              location_id: line.to_location_id ?? null,
              quantity_on_hand: recLine.quantity_received,
              average_cost: Number(line.unit_cost),
              total_value: recLine.quantity_received * Number(line.unit_cost),
              last_movement_at: new Date(),
            },
            update: {
              quantity_on_hand: { increment: recLine.quantity_received },
              last_movement_at: new Date(),
            },
          });

          // Create transfer_in movement
          await tx.invStockMovement.create({
            data: {
              org_id: orgId,
              movement_type: 'transfer_in',
              reference_type: 'stock_transfer',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.to_warehouse_id,
              to_location_id: line.to_location_id ?? null,
              lot_id: line.lot_id ?? null,
              quantity: recLine.quantity_received,
              unit_cost: Number(line.unit_cost),
              total_cost: recLine.quantity_received * Number(line.unit_cost),
              running_stock: recLine.quantity_received,
              created_by: ctx.session.user.id,
            },
          });

          await tx.invStockTransferLine.update({
            where: { id: recLine.line_id },
            data: { quantity_received: recLine.quantity_received },
          });
        }

        await tx.invStockTransfer.update({
          where: { id: input.id },
          data: { status: 'received', received_date: new Date() },
        });
      });

      return { success: true };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      if (transfer.status === 'received') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot cancel a received transfer' });
      }
      return ctx.prisma.invStockTransfer.update({
        where: { id: input.id },
        data: { status: 'cancelled' },
      });
    }),
});
