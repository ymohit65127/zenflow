import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';

export const reportsRouter = createTRPCRouter({
  // Stock valuation: sum up avg_cost * quantity per product/warehouse
  stockValuation: protectedProcedure
    .input(
      z.object({
        warehouse_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const levels = await ctx.prisma.invStockLevel.findMany({
        where: {
          organization_id: orgId,
          ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
          quantity: { gt: 0 },
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, unit_of_measure: true, category_id: true },
          },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
      });

      const totalValue = levels.reduce((sum, l) => sum + Number(l.quantity) * Number(l.avg_cost), 0);
      const totalItems = levels.length;

      const byWarehouse: Record<string, { name: string; value: number; skus: number }> = {};
      for (const l of levels) {
        if (!byWarehouse[l.warehouse_id]) {
          byWarehouse[l.warehouse_id] = { name: l.warehouse.name, value: 0, skus: 0 };
        }
        byWarehouse[l.warehouse_id]!.value += Number(l.quantity) * Number(l.avg_cost);
        byWarehouse[l.warehouse_id]!.skus += 1;
      }

      return {
        items: levels.map((l) => ({
          product_id: l.product_id,
          product_name: l.product.name,
          sku: l.product.sku,
          warehouse_name: l.warehouse.name,
          quantity_on_hand: Number(l.quantity),
          average_cost: Number(l.avg_cost),
          total_value: Number(l.quantity) * Number(l.avg_cost),
          unit_of_measure: String(l.product.unit_of_measure),
        })),
        totalValue,
        totalItems,
        byWarehouse: Object.entries(byWarehouse).map(([id, v]) => ({ warehouse_id: id, ...v })),
      };
    }),

  // ABC Analysis: classify products A/B/C by sales value
  abcAnalysis: protectedProcedure
    .input(
      z.object({
        from_date: z.string(),
        to_date: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const movements = await ctx.prisma.invStockMovement.groupBy({
        by: ['product_id'],
        where: {
          organization_id: orgId,
          movement_type: 'issue',
          moved_at: {
            gte: new Date(input.from_date),
            lte: new Date(input.to_date),
          },
        },
        _sum: { total_cost: true },
        orderBy: { _sum: { total_cost: 'desc' } },
      });

      if (movements.length === 0) return { items: [], total_value: 0 };

      const productIds = movements.map((m) => m.product_id);
      const products = await ctx.prisma.invProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const totalValue = movements.reduce((s, m) => s + Number(m._sum?.total_cost ?? 0), 0);
      let cumulative = 0;

      const items = movements.map((m) => {
        const usageValue = Number(m._sum?.total_cost ?? 0);
        cumulative += usageValue;
        const cumulativePct = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;
        const product = productMap.get(m.product_id);

        return {
          product_id: m.product_id,
          sku: product?.sku ?? '',
          name: product?.name ?? '',
          usage_value: usageValue,
          cumulative_pct: cumulativePct,
          classification: cumulativePct <= 70 ? 'A' : cumulativePct <= 90 ? 'B' : 'C',
        } as const;
      });

      return { items, total_value: totalValue };
    }),

  // Slow-moving: products with no outbound movements in last N days
  slowMoving: protectedProcedure
    .input(
      z.object({
        days_no_movement: z.number().int().min(1).default(90),
        warehouse_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days_no_movement);

      // Products with stock but no recent outbound movement
      const levelsWithStock = await ctx.prisma.invStockLevel.findMany({
        where: {
          organization_id: orgId,
          quantity: { gt: 0 },
          ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
      });

      const recentMovements = await ctx.prisma.invStockMovement.findMany({
        where: {
          organization_id: orgId,
          movement_type: 'issue',
          moved_at: { gte: cutoff },
        },
        select: { product_id: true },
        distinct: ['product_id'],
      });
      const recentProductIds = new Set(recentMovements.map((m) => m.product_id));

      const slowItems = levelsWithStock.filter((l) => !recentProductIds.has(l.product_id));

      return {
        items: slowItems.map((l) => ({
          product_id: l.product_id,
          sku: l.product.sku,
          product_name: l.product.name,
          warehouse_name: l.warehouse.name,
          quantity_on_hand: Number(l.quantity),
          total_value: Number(l.quantity) * Number(l.avg_cost),
          last_updated: l.updated_at,
          days_since_update: Math.floor((Date.now() - l.updated_at.getTime()) / 86400000),
        })),
        days_threshold: input.days_no_movement,
        total_value_at_risk: slowItems.reduce((s, l) => s + Number(l.quantity) * Number(l.avg_cost), 0),
      };
    }),

  // Reorder report: products below reorder point
  reorderReport: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const products = await ctx.prisma.invProduct.findMany({
      where: { organization_id: orgId, is_active: true, deleted_at: null, reorder_point: { not: null } },
      include: {
        stock_levels: { where: { organization_id: orgId } },
      },
    });

    return products
      .map((p) => {
        const totalOnHand = p.stock_levels.reduce((s, l) => s + Number(l.quantity), 0);
        const reorderPoint = Number(p.reorder_point ?? 0);
        if (totalOnHand > reorderPoint) return null;
        return {
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          current_stock: totalOnHand,
          reorder_point: reorderPoint,
          reorder_qty: Number(p.reorder_qty ?? reorderPoint),
          purchase_price: Number(p.cost_price ?? 0),
        };
      })
      .filter(Boolean);
  }),

  // Movement history for a product
  movementHistory: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invStockMovement.findMany({
          where: {
            organization_id: orgId,
            product_id: input.product_id,
            ...(input.from_date || input.to_date
              ? {
                  moved_at: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { moved_at: 'desc' },
        }),
        ctx.prisma.invStockMovement.count({
          where: { organization_id: orgId, product_id: input.product_id },
        }),
      ]);
      return { items, total };
    }),
});
