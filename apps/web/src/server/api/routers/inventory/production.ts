import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateOrderNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invProductionOrder.findFirst({
    where: { organization_id: orgId, order_number: { startsWith: 'MO-' } },
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
          .enum(['draft', 'released', 'in_progress', 'completed', 'cancelled'])
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
            organization_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.product_id ? { product_id: input.product_id } : {}),
          },
          include: {
            bom: { select: { id: true, name: true, version: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invProductionOrder.count({
          where: {
            organization_id: orgId,
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
        where: { id: input.id, organization_id: orgId },
        include: {
          bom: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              lines: {
                include: {
                  component: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
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
        bom_id: z.string(),
        planned_qty: z.number().positive(),
        warehouse_id: z.string(),
        planned_start: z.string().optional(),
        planned_end: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const orderNumber = await generateOrderNumber(ctx.prisma, orgId);

      return ctx.prisma.invProductionOrder.create({
        data: {
          organization_id: orgId,
          order_number: orderNumber,
          product_id: input.product_id,
          bom_id: input.bom_id,
          planned_qty: input.planned_qty,
          warehouse_id: input.warehouse_id,
          planned_start: input.planned_start ? new Date(input.planned_start) : null,
          planned_end: input.planned_end ? new Date(input.planned_end) : null,
          status: 'draft',
          notes: input.notes ?? null,
          created_by: ctx.session.user.id,
        },
      });
    }),

  release: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          bom: {
            include: {
              lines: { include: { component: { select: { id: true, name: true } } } },
            },
          },
        },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (order.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft orders can be released' });
      }

      if (!order.bom) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No BOM attached to this order' });
      }

      const scaleFactor = Number(order.planned_qty) / Number(order.bom.output_qty);

      // Reserve component stock
      await ctx.prisma.$transaction(async (tx) => {
        for (const line of order.bom!.lines) {
          const reqQty = Number(line.quantity) * scaleFactor;

          const stockLevel = await tx.invStockLevel.findFirst({
            where: {
              product_id: line.component_id,
              warehouse_id: order.warehouse_id ?? undefined,
            },
          });

          const available =
            Number(stockLevel?.quantity ?? 0) -
            Number(stockLevel?.reserved_qty ?? 0);

          if (available < reqQty) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient stock for component: ${line.component.name}. Available: ${available}, Required: ${reqQty.toFixed(2)}`,
            });
          }

          if (stockLevel) {
            await tx.invStockLevel.update({
              where: { id: stockLevel.id },
              data: { reserved_qty: { increment: reqQty } },
            });
          }
        }

        await tx.invProductionOrder.update({
          where: { id: input.id },
          data: { status: 'released' },
        });
      });

      return { success: true };
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (!['released', 'draft'].includes(order.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order must be released to start' });
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
        where: { id: input.id, organization_id: orgId },
        include: {
          bom: {
            include: {
              lines: {
                include: {
                  component: { select: { id: true, name: true, cost_price: true } },
                },
              },
            },
          },
        },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (!['released', 'in_progress'].includes(order.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order must be released or in-progress to complete' });
      }

      if (!order.bom) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No BOM attached to this order' });
      }

      const producedQty = input.actual_quantity ?? Number(order.planned_qty);
      const scaleFactor = Number(order.planned_qty) / Number(order.bom.output_qty);

      await ctx.prisma.$transaction(async (tx) => {
        // 1. Consume components (production_input movements)
        for (const line of order.bom!.lines) {
          const consumeQty = Number(line.quantity) * scaleFactor;
          const unitCost = Number(line.component.cost_price ?? 0);

          const stockLevel = await tx.invStockLevel.findFirst({
            where: {
              product_id: line.component_id,
              warehouse_id: order.warehouse_id ?? undefined,
            },
          });

          if (stockLevel) {
            await tx.invStockLevel.update({
              where: { id: stockLevel.id },
              data: {
                quantity: { decrement: consumeQty },
                reserved_qty: { decrement: Math.min(consumeQty, Number(stockLevel.reserved_qty)) },
              },
            });
          }

          await tx.invStockMovement.create({
            data: {
              organization_id: orgId,
              movement_type: 'production_input',
              reference_type: 'production_order',
              reference_id: input.id,
              product_id: line.component_id,
              variant_id: null,
              warehouse_id: order.warehouse_id ?? '',
              quantity: consumeQty,
              unit_cost: unitCost,
              total_cost: consumeQty * unitCost,
              notes: `Component consumption for MO: ${order.order_number}`,
            },
          });
        }

        // 2. Produce finished goods (production_output movement)
        const componentCost = order.bom!.lines.reduce(
          (sum: number, line) =>
            sum +
            Number(line.quantity) *
              scaleFactor *
              Number(line.component.cost_price ?? 0),
          0
        );
        const unitCostFinished = producedQty > 0 ? componentCost / producedQty : 0;

        if (order.product_id && order.warehouse_id) {
          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: order.product_id,
                variant_id: null as unknown as string,
                warehouse_id: order.warehouse_id,
                location_id: null as unknown as string,
              },
            },
            create: {
              organization_id: orgId,
              product_id: order.product_id,
              variant_id: null,
              warehouse_id: order.warehouse_id,
              location_id: null,
              quantity: producedQty,
              avg_cost: unitCostFinished,
            },
            update: {
              quantity: { increment: producedQty },
            },
          });

          await tx.invStockMovement.create({
            data: {
              organization_id: orgId,
              movement_type: 'production_output',
              reference_type: 'production_order',
              reference_id: input.id,
              product_id: order.product_id,
              variant_id: null,
              warehouse_id: order.warehouse_id,
              quantity: producedQty,
              unit_cost: unitCostFinished,
              total_cost: producedQty * unitCostFinished,
              notes: `Production output for MO: ${order.order_number}`,
            },
          });
        }

        await tx.invProductionOrder.update({
          where: { id: input.id },
          data: { status: 'completed', actual_end: new Date(), produced_qty: producedQty },
        });
      });

      return { success: true, produced_quantity: producedQty };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const order = await ctx.prisma.invProductionOrder.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          bom: { include: { lines: true } },
        },
      });
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Production order not found' });
      if (order.status === 'completed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot cancel a completed order' });
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Release reservations if order was released
        if (['released', 'in_progress'].includes(order.status) && order.bom) {
          const scaleFactor = Number(order.planned_qty) / Number(order.bom.output_qty);
          for (const line of order.bom.lines) {
            const reqQty = Number(line.quantity) * scaleFactor;

            const stockLevel = await tx.invStockLevel.findFirst({
              where: {
                product_id: line.component_id,
                warehouse_id: order.warehouse_id ?? undefined,
              },
            });
            if (stockLevel) {
              await tx.invStockLevel.update({
                where: { id: stockLevel.id },
                data: { reserved_qty: { decrement: Math.min(reqQty, Number(stockLevel.reserved_qty)) } },
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
