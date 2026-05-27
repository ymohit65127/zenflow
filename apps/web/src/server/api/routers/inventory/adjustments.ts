// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateAdjNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invStockAdjustment.findFirst({
    where: { org_id: orgId, adjustment_number: { startsWith: 'ADJ-' } },
    orderBy: { created_at: 'desc' },
    select: { adjustment_number: true },
  });
  const num = last
    ? parseInt(last.adjustment_number.replace('ADJ-', '') || '0', 10)
    : 0;
  return `ADJ-${String(num + 1).padStart(5, '0')}`;
}

const ADJUSTMENT_REASON = z.enum([
  'damaged',
  'lost',
  'found',
  'correction',
  'audit',
  'expired',
  'sample',
  'other',
]);

export const adjustmentsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'posted']).optional(),
        warehouse_id: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invStockAdjustment.findMany({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
          },
          include: {
            warehouse: { select: { id: true, name: true, code: true } },
            _count: { select: { lines: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invStockAdjustment.count({
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
      const adj = await ctx.prisma.invStockAdjustment.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          warehouse: true,
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
              location: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });
      if (!adj) throw new TRPCError({ code: 'NOT_FOUND', message: 'Adjustment not found' });
      return adj;
    }),

  create: protectedProcedure
    .input(
      z.object({
        warehouse_id: z.string(),
        adjustment_date: z.string(),
        reason: ADJUSTMENT_REASON.default('correction'),
        notes: z.string().optional(),
        lines: z.array(
          z.object({
            product_id: z.string(),
            variant_id: z.string().optional(),
            location_id: z.string().optional(),
            lot_id: z.string().optional(),
            quantity_before: z.number(),
            quantity_after: z.number(),
            unit_cost: z.number().min(0).default(0),
            reason_note: z.string().optional(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const adjNumber = await generateAdjNumber(ctx.prisma, orgId);

      const lineData = input.lines.map((line) => {
        const change = line.quantity_after - line.quantity_before;
        return {
          product_id: line.product_id,
          variant_id: line.variant_id ?? null,
          location_id: line.location_id ?? null,
          lot_id: line.lot_id ?? null,
          quantity_before: line.quantity_before,
          quantity_after: line.quantity_after,
          quantity_change: change,
          unit_cost: line.unit_cost,
          value_change: change * line.unit_cost,
          reason_note: line.reason_note ?? null,
        };
      });

      return ctx.prisma.invStockAdjustment.create({
        data: {
          org_id: orgId,
          adjustment_number: adjNumber,
          warehouse_id: input.warehouse_id,
          adjustment_date: new Date(input.adjustment_date),
          reason: input.reason,
          notes: input.notes ?? null,
          status: 'draft',
          created_by: ctx.session.user.id,
          lines: { create: lineData },
        },
        include: {
          lines: { include: { product: { select: { name: true, sku: true } } } },
          warehouse: true,
        },
      });
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const adj = await ctx.prisma.invStockAdjustment.findFirst({
        where: { id: input.id, org_id: orgId },
        include: { lines: true },
      });
      if (!adj) throw new TRPCError({ code: 'NOT_FOUND', message: 'Adjustment not found' });
      if (adj.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Adjustment is already posted' });
      }

      let totalValueChange = 0;

      await ctx.prisma.$transaction(async (tx) => {
        for (const line of adj.lines) {
          const change = Number(line.quantity_change);
          if (change === 0) continue;

          const isIncrease = change > 0;
          const locationId = line.location_id ?? null;

          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: line.variant_id ?? null,
                warehouse_id: adj.warehouse_id,
                location_id: locationId,
              },
            },
            create: {
              org_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: adj.warehouse_id,
              location_id: locationId,
              quantity_on_hand: change,
              average_cost: Number(line.unit_cost),
              total_value: change * Number(line.unit_cost),
              last_movement_at: new Date(),
            },
            update: {
              quantity_on_hand: { increment: change },
              last_movement_at: new Date(),
            },
          });

          await tx.invStockMovement.create({
            data: {
              org_id: orgId,
              movement_type: isIncrease ? 'adjustment_in' : 'adjustment_out',
              reference_type: 'stock_adjustment',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: adj.warehouse_id,
              to_location_id: locationId,
              quantity: Math.abs(change),
              unit_cost: Number(line.unit_cost),
              total_cost: Math.abs(change) * Number(line.unit_cost),
              running_stock: Number(line.quantity_after),
              created_by: ctx.session.user.id,
              notes: line.reason_note ?? null,
            },
          });

          totalValueChange += Number(line.value_change);
        }

        await tx.invStockAdjustment.update({
          where: { id: input.id },
          data: {
            status: 'posted',
            posted_at: new Date(),
            posted_by: ctx.session.user.id,
            total_value_change: totalValueChange,
          },
        });
      });

      return { success: true, totalValueChange };
    }),

  void: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const adj = await ctx.prisma.invStockAdjustment.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!adj) throw new TRPCError({ code: 'NOT_FOUND', message: 'Adjustment not found' });
      if (adj.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft adjustments can be voided' });
      }
      return ctx.prisma.invStockAdjustment.delete({ where: { id: input.id } });
    }),
});
