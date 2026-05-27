// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateOrderNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invProductionOrder.findFirst({
    where: { org_id: orgId, order_number: { startsWith: 'MO-' } },
    orderBy: { created_at: 'desc' },
    select: { order_number: true },
  });
  const num = last
    ? parseInt(last.order_number.replace('MO-', '') || '0', 10)
    : 0;
  return `MO-${String(num + 1).padStart(5, '0')}`;
}

export const productionRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'])
          .optional(),
        product_id: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invProductionOrder.findMany({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.product_id ? { product_id: input.product_id } : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, sku: true, variant_attributes: true } },
            warehouse: { select: { id: true, name: true } },
            bom: { select: { id: true, name: true, version: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invProductionOrder.count({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, sku: true, variant_attributes: true } },
          warehouse: true,
          bom: {
            include: {
              lines: {
                include: {
                  component_product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
                  component_variant: { select: { id: true, sku: true } },
                },
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      return order;
    }),

  create: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        variant_id: z.string().optional(),
        bom_id: z.string(),
        quantity: z.number().positive(),
        warehouse_id: z.string(),
        scheduled_start: z.string().optional(),
        scheduled_end: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const orderNumber = await generateOrderNumber(ctx.prisma, orgId);

      return ctx.prisma.invProductionOrder.create({
        data: {
          org_id: orgId,
          order_number: orderNumber,
          product_id: input.product_id,
          variant_id: input.variant_id ?? null,
          bom_id: input.bom_id,
          quantity: input.quantity,
          warehouse_id: input.warehouse_id,
          scheduled_start: input.scheduled_start ? new Date(input.scheduled_start) : null,
          scheduled_end: input.scheduled_end ? new Date(input.scheduled_end) : null,
          status: 'draft',
          notes: input.notes ?? null,
          created_by: ctx.session.user.id,
        },
      });
    }),

  confirm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          bom: {
            include: {
              lines: { include: { component_product: { select: { id: true, name: true } } } },
            },
          },
        },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (order.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft orders can be confirmed' });
      }

      const scaleFactor = Number(order.quantity) / Number(order.bom.quantity);

      // Reserve component stock
      await ctx.prisma.$transaction(async (tx) => {
        for (const line of order.bom.lines) {
          const scrapFactor = 1 + Number(line.scrap_percent) / 100;
          const reqQty = Number(line.quantity) * scaleFactor * scrapFactor;

          const stockLevel = await tx.invStockLevel.findFirst({
            where: {
              product_id: line.component_product_id,
              variant_id: line.component_variant_id ?? null,
              warehouse_id: order.warehouse_id,
            },
          });

          const available =
            Number(stockLevel?.quantity_on_hand ?? 0) -
            Number(stockLevel?.quantity_reserved ?? 0);

          if (available < reqQty) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient stock for component: ${line.component_product.name}. Available: ${available}, Required: ${reqQty.toFixed(2)}`,
            });
          }

          if (stockLevel) {
            await tx.invStockLevel.update({
              where: { id: stockLevel.id },
              data: { quantity_reserved: { increment: reqQty } },
            });
          }
        }

        await tx.invProductionOrder.update({
          where: { id: input.id },
          data: { status: 'confirmed' },
        });
      });

      return { success: true };
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (order.status !== 'confirmed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only confirmed orders can be started' });
      }
      return ctx.prisma.invProductionOrder.update({
        where: { id: input.id },
        data: { status: 'in_progress', actual_start: new Date() },
      });
    }),

  complete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        actual_quantity: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          bom: {
            include: {
              lines: {
                include: {
                  component_product: { select: { id: true, name: true, purchase_price: true } },
                },
              },
            },
          },
          product: { select: { id: true, name: true } },
        },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (!['confirmed', 'in_progress'].includes(order.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order must be confirmed or in-progress to complete' });
      }

      const producedQty = input.actual_quantity ?? Number(order.quantity);
      const scaleFactor = Number(order.quantity) / Number(order.bom.quantity);

      await ctx.prisma.$transaction(async (tx) => {
        // 1. Consume components (production_input movements)
        for (const line of order.bom.lines) {
          const scrapFactor = 1 + Number(line.scrap_percent) / 100;
          const consumeQty = Number(line.quantity) * scaleFactor * scrapFactor;
          const unitCost = Number(line.component_product.purchase_price ?? 0);

          // Release reservation and deduct stock
          const stockLevel = await tx.invStockLevel.findFirst({
            where: {
              product_id: line.component_product_id,
              variant_id: line.component_variant_id ?? null,
              warehouse_id: order.warehouse_id,
            },
          });

          if (stockLevel) {
            await tx.invStockLevel.update({
              where: { id: stockLevel.id },
              data: {
                quantity_on_hand: { decrement: consumeQty },
                quantity_reserved: { decrement: Math.min(consumeQty, Number(stockLevel.quantity_reserved)) },
                last_movement_at: new Date(),
              },
            });
          }

          await tx.invStockMovement.create({
            data: {
              org_id: orgId,
              movement_type: 'production_input',
              reference_type: 'production_order',
              reference_id: input.id,
              product_id: line.component_product_id,
              variant_id: line.component_variant_id ?? null,
              warehouse_id: order.warehouse_id,
              quantity: consumeQty,
              unit_cost: unitCost,
              total_cost: consumeQty * unitCost,
              running_stock: Number(stockLevel?.quantity_on_hand ?? 0) - consumeQty,
              created_by: ctx.session.user.id,
              notes: `Component consumption for MO: ${order.order_number}`,
            },
          });
        }

        // 2. Produce finished goods (production_output movement)
        const componentCost = order.bom.lines.reduce(
          (sum, line) =>
            sum +
            Number(line.quantity) *
              scaleFactor *
              (1 + Number(line.scrap_percent) / 100) *
              Number(line.component_product.purchase_price ?? 0),
          0
        );
        const unitCostFinished = (componentCost + Number(order.bom.overhead_cost)) / producedQty;

        await tx.invStockLevel.upsert({
          where: {
            product_id_variant_id_warehouse_id_location_id: {
              product_id: order.product_id,
              variant_id: order.variant_id ?? null,
              warehouse_id: order.warehouse_id,
              location_id: null,
            },
          },
          create: {
            org_id: orgId,
            product_id: order.product_id,
            variant_id: order.variant_id ?? null,
            warehouse_id: order.warehouse_id,
            location_id: null,
            quantity_on_hand: producedQty,
            average_cost: unitCostFinished,
            total_value: producedQty * unitCostFinished,
            last_movement_at: new Date(),
          },
          update: {
            quantity_on_hand: { increment: producedQty },
            last_movement_at: new Date(),
          },
        });

        await tx.invStockMovement.create({
          data: {
            org_id: orgId,
            movement_type: 'production_output',
            reference_type: 'production_order',
            reference_id: input.id,
            product_id: order.product_id,
            variant_id: order.variant_id ?? null,
            warehouse_id: order.warehouse_id,
            quantity: producedQty,
            unit_cost: unitCostFinished,
            total_cost: producedQty * unitCostFinished,
            running_stock: producedQty,
            created_by: ctx.session.user.id,
            notes: `Production output for MO: ${order.order_number}`,
          },
        });

        await tx.invProductionOrder.update({
          where: { id: input.id },
          data: { status: 'completed', actual_end: new Date() },
        });
      });

      return { success: true, produced_quantity: producedQty };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          bom: { include: { lines: true } },
        },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (order.status === 'completed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot cancel a completed order' });
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Release reservations if order was confirmed
        if (['confirmed', 'in_progress'].includes(order.status)) {
          const scaleFactor = Number(order.quantity) / Number(order.bom.quantity);
          for (const line of order.bom.lines) {
            const scrapFactor = 1 + Number(line.scrap_percent) / 100;
            const reqQty = Number(line.quantity) * scaleFactor * scrapFactor;

            const stockLevel = await tx.invStockLevel.findFirst({
              where: {
                product_id: line.component_product_id,
                variant_id: line.component_variant_id ?? null,
                warehouse_id: order.warehouse_id,
              },
            });
            if (stockLevel) {
              await tx.invStockLevel.update({
                where: { id: stockLevel.id },
                data: { quantity_reserved: { decrement: Math.min(reqQty, Number(stockLevel.quantity_reserved)) } },
              });
            }
          }
        }

        await tx.invProductionOrder.update({
          where: { id: input.id },
          data: { status: 'cancelled' },
        });
      });

      return { success: true };
    }),
});
