import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateTransferNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invStockTransfer.findFirst({
    where: { organization_id: orgId, transfer_number: { startsWith: 'TRF-' } },
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
            organization_id: orgId,
            ...(input.status ? { status: input.status } : {}),
          },
          include: {
            _count: { select: { lines: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invStockTransfer.count({
          where: { organization_id: orgId, ...(input.status ? { status: input.status } : {}) },
        }),
      ]);
      // Fetch warehouse names separately since there are no direct relations
      const warehouseIds = new Set<string>();
      items.forEach((t) => {
        warehouseIds.add(t.from_warehouse_id);
        warehouseIds.add(t.to_warehouse_id);
      });
      const warehouses = await ctx.prisma.invWarehouse.findMany({
        where: { id: { in: [...warehouseIds] } },
        select: { id: true, name: true, code: true },
      });
      const whMap = new Map(warehouses.map((w) => [w.id, w]));
      const enriched = items.map((t) => ({
        ...t,
        from_warehouse: whMap.get(t.from_warehouse_id) ?? null,
        to_warehouse: whMap.get(t.to_warehouse_id) ?? null,
      }));
      return { items: enriched, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
            },
          },
        },
      });
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      // Fetch warehouse names
      const warehouses = await ctx.prisma.invWarehouse.findMany({
        where: { id: { in: [transfer.from_warehouse_id, transfer.to_warehouse_id] } },
        select: { id: true, name: true, code: true },
      });
      const whMap = new Map(warehouses.map((w) => [w.id, w]));
      return {
        ...transfer,
        from_warehouse: whMap.get(transfer.from_warehouse_id) ?? null,
        to_warehouse: whMap.get(transfer.to_warehouse_id) ?? null,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        from_warehouse_id: z.string(),
        to_warehouse_id: z.string(),
        notes: z.string().optional(),
        lines: z.array(
          z.object({
            product_id: z.string(),
            variant_id: z.string().optional(),
            quantity: z.number().positive(),
            unit_cost: z.number().min(0).default(0),
            lot_id: z.string().optional(),
            serial_id: z.string().optional(),
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

      const transfer = await ctx.prisma.invStockTransfer.create({
        data: {
          organization_id: orgId,
          transfer_number: transferNumber,
          from_warehouse_id: input.from_warehouse_id,
          to_warehouse_id: input.to_warehouse_id,
          status: 'draft',
          notes: input.notes ?? null,
          requested_by: ctx.session.user.id,
          lines: {
            create: input.lines.map((line) => ({
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              quantity: line.quantity,
              unit_cost: line.unit_cost,
              lot_id: line.lot_id ?? null,
              serial_id: line.serial_id ?? null,
            })),
          },
        },
        include: {
          lines: { include: { product: { select: { name: true, sku: true } } } },
        },
      });
      return transfer;
    }),

  ship: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { lines: true },
      });
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      if (transfer.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft transfers can be shipped' });
      }

      await ctx.prisma.$transaction(async (tx) => {
        for (const line of transfer.lines) {
          const qty = Number(line.quantity);
          if (qty <= 0) continue;

          // Check source stock
          const srcLevel = await tx.invStockLevel.findUnique({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: (line.variant_id ?? null) as unknown as string,
                warehouse_id: transfer.from_warehouse_id,
                location_id: null as unknown as string,
              },
            },
          });
          const available = Number(srcLevel?.quantity ?? 0);

          if (available < qty) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient stock for product ${line.product_id}. Available: ${available}, Requested: ${qty}`,
            });
          }

          // Deduct from source
          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: (line.variant_id ?? null) as unknown as string,
                warehouse_id: transfer.from_warehouse_id,
                location_id: null as unknown as string,
              },
            },
            create: {
              organization_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.from_warehouse_id,
              location_id: null,
              quantity: -qty,
              avg_cost: Number(line.unit_cost),
            },
            update: {
              quantity: { decrement: qty },
            },
          });

          // Create transfer_out movement
          await tx.invStockMovement.create({
            data: {
              organization_id: orgId,
              movement_type: 'transfer_out',
              reference_type: 'stock_transfer',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.from_warehouse_id,
              lot_id: line.lot_id ?? null,
              quantity: qty,
              unit_cost: Number(line.unit_cost),
              total_cost: qty * Number(line.unit_cost),
            },
          });
        }

        await tx.invStockTransfer.update({
          where: { id: input.id },
          data: { status: 'in_transit', shipped_at: new Date() },
        });
      });

      return ctx.prisma.invStockTransfer.findUnique({
        where: { id: input.id },
        include: { lines: { include: { product: { select: { name: true, sku: true } } } } },
      });
    }),

  receive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { lines: true },
      });
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      if (transfer.status !== 'in_transit') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only in-transit transfers can be received' });
      }

      await ctx.prisma.$transaction(async (tx) => {
        for (const line of transfer.lines) {
          const qty = Number(line.quantity);
          if (qty <= 0) continue;

          // Add to destination
          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: (line.variant_id ?? null) as unknown as string,
                warehouse_id: transfer.to_warehouse_id,
                location_id: null as unknown as string,
              },
            },
            create: {
              organization_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.to_warehouse_id,
              location_id: null,
              quantity: qty,
              avg_cost: Number(line.unit_cost),
            },
            update: {
              quantity: { increment: qty },
            },
          });

          // Create transfer_in movement
          await tx.invStockMovement.create({
            data: {
              organization_id: orgId,
              movement_type: 'transfer_in',
              reference_type: 'stock_transfer',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: transfer.to_warehouse_id,
              lot_id: line.lot_id ?? null,
              quantity: qty,
              unit_cost: Number(line.unit_cost),
              total_cost: qty * Number(line.unit_cost),
            },
          });

          await tx.invStockTransferLine.update({
            where: { id: line.id },
            data: { received_qty: qty },
          });
        }

        await tx.invStockTransfer.update({
          where: { id: input.id },
          data: { status: 'received', received_at: new Date() },
        });
      });

      return { success: true };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const transfer = await ctx.prisma.invStockTransfer.findFirst({
        where: { id: input.id, organization_id: orgId },
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
