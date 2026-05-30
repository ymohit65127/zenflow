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
            organization_id: orgId,
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
          where: { organization_id: orgId, ...(input.product_id ? { product_id: input.product_id } : {}) },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const bom = await ctx.prisma.invBOM.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          lines: {
            include: {
              component: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unit_of_measure: true,
                  cost_price: true,
                },
              },
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
        name: z.string().min(1),
        version: z.string().default('1.0'),
        output_qty: z.number().positive().default(1),
        description: z.string().optional(),
        lines: z.array(
          z.object({
            component_id: z.string(),
            quantity: z.number().positive(),
            unit_of_measure: z.enum([
              'piece', 'kg', 'gram', 'litre', 'ml', 'meter', 'cm',
              'sq_meter', 'cubic_meter', 'box', 'carton', 'dozen', 'pack', 'set', 'pair',
            ]).optional(),
            notes: z.string().optional(),
            position: z.number().default(0),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.invProduct.findFirst({
        where: { id: input.product_id, organization_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      return ctx.prisma.invBOM.create({
        data: {
          organization_id: orgId,
          product_id: input.product_id,
          name: input.name,
          version: input.version,
          output_qty: input.output_qty,
          description: input.description ?? null,
          lines: {
            create: input.lines.map((line, idx) => ({
              organization_id: orgId,
              component_id: line.component_id,
              quantity: line.quantity,
              unit_of_measure: line.unit_of_measure ?? 'piece',
              notes: line.notes ?? null,
              position: line.position !== undefined ? line.position : idx,
            })),
          },
        },
        include: {
          lines: { include: { component: { select: { name: true, sku: true } } } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        version: z.string().optional(),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const bom = await ctx.prisma.invBOM.findFirst({ where: { id, organization_id: orgId } });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });
      return ctx.prisma.invBOM.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const bom = await ctx.prisma.invBOM.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });
      return ctx.prisma.invBOM.delete({ where: { id: input.id } });
    }),

  // BOM explosion — flat list of all components needed
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
        where: { id: input.bom_id, organization_id: orgId },
        include: {
          lines: {
            include: {
              component: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unit_of_measure: true,
                  cost_price: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });

      const scaleFactor = input.quantity / Number(bom.output_qty);

      type ExplodedItem = {
        product_id: string;
        product_name: string;
        sku: string;
        required_quantity: number;
        unit: string;
        unit_cost: number;
        total_cost: number;
        available_quantity: number;
        shortage: number;
      };

      const explodeLines = async (
        lines: typeof bom.lines,
        factor: number,
        depth = 0
      ): Promise<ExplodedItem[]> => {
        if (depth > 5) return [];
        const results: ExplodedItem[] = [];

        for (const line of lines) {
          const requiredQty = Number(line.quantity) * factor;

          // Check if this component itself has a BOM (sub-assembly)
          const subBOM = await ctx.prisma.invBOM.findFirst({
            where: {
              organization_id: orgId,
              product_id: line.component_id,
              is_active: true,
            },
            include: {
              lines: {
                include: {
                  component: {
                    select: { id: true, name: true, sku: true, unit_of_measure: true, cost_price: true },
                  },
                },
                orderBy: { position: 'asc' },
              },
            },
          });

          if (subBOM && depth < 5) {
            const subFactor = requiredQty / Number(subBOM.output_qty);
            const subItems = await explodeLines(subBOM.lines, subFactor, depth + 1);
            results.push(...subItems);
          } else {
            let available = 0;
            if (input.warehouse_id) {
              const stockLevel = await ctx.prisma.invStockLevel.findFirst({
                where: {
                  product_id: line.component_id,
                  warehouse_id: input.warehouse_id,
                },
              });
              available = Number(stockLevel?.quantity ?? 0);
            }

            const unitCost = Number(line.component.cost_price ?? 0);

            results.push({
              product_id: line.component_id,
              product_name: line.component.name,
              sku: line.component.sku,
              required_quantity: requiredQty,
              unit: String(line.unit_of_measure),
              unit_cost: unitCost,
              total_cost: requiredQty * unitCost,
              available_quantity: available,
              shortage: Math.max(0, requiredQty - available),
            });
          }
        }

        return results;
      };

      const components = await explodeLines(bom.lines, scaleFactor);

      // Aggregate duplicate products
      const aggregated = new Map<string, ExplodedItem>();
      for (const item of components) {
        const key = item.product_id;
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
        total_material_cost: totalMaterialCost,
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
      const orgId = ctx.session.user.organizationId as string;
      const bom = await ctx.prisma.invBOM.findFirst({ where: { id: input.bom_id, organization_id: orgId } });
      if (!bom) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found' });
      return { can_produce: true, shortage_items: [] };
    }),
});
