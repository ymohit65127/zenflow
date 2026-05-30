import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const stockLevelsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        product_id: z.string().optional(),
        warehouse_id: z.string().optional(),
        low_stock_only: z.boolean().optional(),
        out_of_stock_only: z.boolean().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      const levels = await ctx.prisma.invStockLevel.findMany({
        where: {
          organization_id: orgId,
          ...(input.product_id ? { product_id: input.product_id } : {}),
          ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit_of_measure: true,
              reorder_point: true,
              reorder_qty: true,
            },
          },
          warehouse: { select: { id: true, name: true, code: true } },
        },
        take: input.limit,
        skip: input.offset,
        orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
      });

      // Apply soft filters that need computed fields
      let filtered = levels;
      if (input.low_stock_only) {
        filtered = filtered.filter(
          (l) =>
            l.product.reorder_point !== null &&
            Number(l.quantity) <= Number(l.product.reorder_point) &&
            Number(l.quantity) > 0
        );
      }
      if (input.out_of_stock_only) {
        filtered = filtered.filter((l) => Number(l.quantity) <= 0);
      }

      return filtered.map((l) => ({
        ...l,
        quantity_on_hand: Number(l.quantity),
        quantity_reserved: Number(l.reserved_qty),
        quantity_available: Number(l.quantity) - Number(l.reserved_qty),
        average_cost: Number(l.avg_cost),
        is_low_stock:
          l.product.reorder_point !== null &&
          Number(l.quantity) <= Number(l.product.reorder_point) &&
          Number(l.quantity) > 0,
        is_out_of_stock: Number(l.quantity) <= 0,
      }));
    }),

  getAvailableQuantity: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        variant_id: z.string().optional(),
        warehouse_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const levels = await ctx.prisma.invStockLevel.findMany({
        where: {
          organization_id: orgId,
          product_id: input.product_id,
          ...(input.variant_id ? { variant_id: input.variant_id } : {}),
          ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
        },
      });
      const total = levels.reduce(
        (sum, l) => sum + Number(l.quantity) - Number(l.reserved_qty),
        0
      );
      return { available: total, levels };
    }),

  summary: protectedProcedure
    .input(z.object({ warehouse_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const levels = await ctx.prisma.invStockLevel.findMany({
        where: {
          organization_id: orgId,
          ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
        },
        include: {
          product: { select: { reorder_point: true } },
        },
      });

      const totalSKUs = new Set(levels.map((l) => l.product_id)).size;
      const totalValue = levels.reduce((sum, l) => sum + Number(l.quantity) * Number(l.avg_cost), 0);
      const lowStock = levels.filter(
        (l) =>
          l.product.reorder_point !== null &&
          Number(l.quantity) <= Number(l.product.reorder_point) &&
          Number(l.quantity) > 0
      ).length;
      const outOfStock = levels.filter((l) => Number(l.quantity) <= 0).length;

      return { totalSKUs, totalValue, lowStock, outOfStock };
    }),

  reorderAlerts: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const products = await ctx.prisma.invProduct.findMany({
      where: { organization_id: orgId, is_active: true, deleted_at: null, reorder_point: { not: null } },
      include: {
        stock_levels: { where: { organization_id: orgId } },
      },
    });

    return products
      .map((p) => {
        const totalOnHand = p.stock_levels.reduce(
          (s, l) => s + Number(l.quantity),
          0
        );
        const reorderPoint = Number(p.reorder_point ?? 0);
        if (totalOnHand > reorderPoint) return null;
        return {
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          current_stock: totalOnHand,
          reorder_point: reorderPoint,
          reorder_qty: Number(p.reorder_qty ?? reorderPoint),
        };
      })
      .filter(Boolean);
  }),
});
