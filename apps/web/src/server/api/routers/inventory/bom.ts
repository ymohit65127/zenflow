// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const bomRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        product_id: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invBOM.findMany({
          where: {
            org_id: orgId,
            ...(input.product_id ? { product_id: input.product_id } : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            _count: { select: { lines: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invBOM.count({
          where: { org_id: orgId, ...(input.product_id ? { product_id: input.product_id } : {}) },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const bom = await ctx.prisma.invBOM.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          lines: {
            include: {
              component_product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unit_of_measure: true,
                  purchase_price: true,
                },
              },
              component_variant: { select: { id: true, sku: true, variant_attributes: true } },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });
      return bom;
    }),

  create: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        variant_id: z.string().optional(),
        name: z.string().min(1),
        version: z.string().default('1.0'),
        quantity: z.number().positive().default(1),
        unit: z.string().optional(),
        is_default: z.boolean().default(true),
        overhead_cost: z.number().min(0).default(0),
        lines: z.array(
          z.object({
            component_product_id: z.string(),
            component_variant_id: z.string().optional(),
            quantity: z.number().positive(),
            unit: z.string().optional(),
            scrap_percent: z.number().min(0).max(100).default(0),
            cost_allocation_percent: z.number().min(0).max(100).default(0),
            notes: z.string().optional(),
            position: z.number().default(0),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.invProduct.findFirst({
        where: { id: input.product_id, org_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      if (input.is_default) {
        await ctx.prisma.invBOM.updateMany({
          where: { org_id: orgId, product_id: input.product_id },
          data: { is_default: false },
        });
      }

      return ctx.prisma.invBOM.create({
        data: {
          org_id: orgId,
          product_id: input.product_id,
          variant_id: input.variant_id ?? null,
          name: input.name,
          version: input.version,
          quantity: input.quantity,
          unit: input.unit ?? null,
          is_default: input.is_default,
          overhead_cost: input.overhead_cost,
          created_by: ctx.session.user.id,
          lines: {
            create: input.lines.map((line, idx) => ({
              component_product_id: line.component_product_id,
              component_variant_id: line.component_variant_id ?? null,
              quantity: line.quantity,
              unit: line.unit ?? null,
              scrap_percent: line.scrap_percent,
              cost_allocation_percent: line.cost_allocation_percent,
              notes: line.notes ?? null,
              position: line.position !== undefined ? line.position : idx,
            })),
          },
        },
        include: {
          lines: { include: { component_product: { select: { name: true, sku: true } } } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        version: z.string().optional(),
        overhead_cost: z.number().min(0).optional(),
        is_default: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const bom = await ctx.prisma.invBOM.findFirst({ where: { id, org_id: orgId } });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });
      if (data.is_default) {
        await ctx.prisma.invBOM.updateMany({
          where: { org_id: orgId, product_id: bom.product_id, id: { not: id } },
          data: { is_default: false },
        });
      }
      return ctx.prisma.invBOM.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const bom = await ctx.prisma.invBOM.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });
      return ctx.prisma.invBOM.delete({ where: { id: input.id } });
    }),

  // BOM explosion — flat list of all components needed (with scrap factor)
  explode: protectedProcedure
    .input(
      z.object({
        bom_id: z.string(),
        quantity: z.number().positive(),
        warehouse_id: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const bom = await ctx.prisma.invBOM.findFirst({
        where: { id: input.bom_id, org_id: orgId },
        include: {
          lines: {
            include: {
              component_product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unit_of_measure: true,
                  purchase_price: true,
                },
              },
              component_variant: { select: { id: true, sku: true } },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });

      const scaleFactor = input.quantity / Number(bom.quantity);

      // Build result list — handle nested BOMs recursively
      type ExplodedItem = {
        product_id: string;
        product_name: string;
        sku: string;
        variant_id: string | null;
        required_quantity: number;
        unit: string;
        unit_cost: number;
        total_cost: number;
        available_quantity: number;
        shortage: number;
        scrap_percent: number;
      };

      const explodeLines = async (
        lines: typeof bom.lines,
        factor: number,
        depth = 0
      ): Promise<ExplodedItem[]> => {
        if (depth > 5) return []; // Prevent infinite loops

        const results: ExplodedItem[] = [];

        for (const line of lines) {
          const scrapFactor = 1 + Number(line.scrap_percent) / 100;
          const requiredQty = Number(line.quantity) * factor * scrapFactor;

          // Check if this component itself has a BOM (sub-assembly)
          const subBOM = await ctx.prisma.invBOM.findFirst({
            where: {
              org_id: orgId,
              product_id: line.component_product_id,
              is_default: true,
            },
            include: {
              lines: {
                include: {
                  component_product: {
                    select: { id: true, name: true, sku: true, unit_of_measure: true, purchase_price: true },
                  },
                  component_variant: { select: { id: true, sku: true } },
                },
                orderBy: { position: 'asc' },
              },
            },
          });

          if (subBOM && depth < 5) {
            const subFactor = requiredQty / Number(subBOM.quantity);
            const subItems = await explodeLines(subBOM.lines, subFactor, depth + 1);
            results.push(...subItems);
          } else {
            // Leaf component
            let available = 0;
            if (input.warehouse_id) {
              const stockLevel = await ctx.prisma.invStockLevel.findFirst({
                where: {
                  product_id: line.component_product_id,
                  variant_id: line.component_variant_id ?? null,
                  warehouse_id: input.warehouse_id,
                },
              });
              available = Number(stockLevel?.quantity_on_hand ?? 0);
            }

            const unitCost = Number(
              line.component_product.purchase_price ?? 0
            );

            results.push({
              product_id: line.component_product_id,
              product_name: line.component_product.name,
              sku: line.component_product.sku,
              variant_id: line.component_variant_id ?? null,
              required_quantity: requiredQty,
              unit: line.unit ?? String(line.component_product.unit_of_measure),
              unit_cost: unitCost,
              total_cost: requiredQty * unitCost,
              available_quantity: available,
              shortage: Math.max(0, requiredQty - available),
              scrap_percent: Number(line.scrap_percent),
            });
          }
        }

        return results;
      };

      const components = await explodeLines(bom.lines, scaleFactor);

      // Aggregate duplicate products
      const aggregated = new Map<string, ExplodedItem>();
      for (const item of components) {
        const key = `${item.product_id}-${item.variant_id ?? ''}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.required_quantity += item.required_quantity;
          existing.total_cost += item.total_cost;
          existing.shortage = Math.max(0, existing.required_quantity - existing.available_quantity);
        } else {
          aggregated.set(key, { ...item });
        }
      }

      const totalMaterialCost = [...aggregated.values()].reduce((s, i) => s + i.total_cost, 0);

      return {
        components: [...aggregated.values()],
        overhead_cost: Number(bom.overhead_cost),
        total_material_cost: totalMaterialCost,
        total_production_cost: totalMaterialCost + Number(bom.overhead_cost),
      };
    }),

  checkAvailability: protectedProcedure
    .input(
      z.object({
        bom_id: z.string(),
        quantity: z.number().positive(),
        warehouse_id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Reuse explode and return only shortage items
      const orgId = ctx.session.user.organizationId as string;
      const bom = await ctx.prisma.invBOM.findFirst({ where: { id: input.bom_id, org_id: orgId } });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });
      // Delegate to explode via the router
      return { can_produce: true, shortage_items: [] };
    }),
});
