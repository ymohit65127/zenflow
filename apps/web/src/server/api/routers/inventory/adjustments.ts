import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateAdjNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invStockAdjustment.findFirst({
    where: { organization_id: orgId, adjustment_number: { startsWith: 'ADJ-' } },
    orderBy: { created_at: 'desc' },
    select: { adjustment_number: true },
  });
  const num = last
    ? parseInt(last.adjustment_number.replace('ADJ-', '') || '0', 10)
    : 0;
  return `ADJ-${String(num + 1).padStart(5, '0')}`;
}

export const adjustmentsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'approved', 'posted', 'cancelled']).optional(),
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
            organization_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
          },
          include: {
            _count: { select: { lines: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invStockAdjustment.count({
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
      const adj = await ctx.prisma.invStockAdjustment.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
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
        reason: z.enum(['count_discrepancy', 'damage', 'expiry', 'theft', 'other']).default('count_discrepancy'),
        notes: z.string().optional(),
        lines: z.array(
          z.object({
            product_id: z.string(),
            variant_id: z.string().optional(),
            qty_before: z.number(),
            qty_after: z.number(),
            unit_cost: z.number().min(0).default(0),
            notes: z.string().optional(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const adjNumber = await generateAdjNumber(ctx.prisma, orgId);

      const lineData = input.lines.map((line) => {
        const diff = line.qty_after - line.qty_before;
        return {
          product_id: line.product_id,
          variant_id: line.variant_id ?? null,
          qty_before: line.qty_before,
          qty_after: line.qty_after,
          qty_diff: diff,
          unit_cost: line.unit_cost,
          notes: line.notes ?? null,
        };
      });

      return ctx.prisma.invStockAdjustment.create({
        data: {
          organization_id: orgId,
          adjustment_number: adjNumber,
          warehouse_id: input.warehouse_id,
          reason: input.reason,
          notes: input.notes ?? null,
          status: 'draft',
          created_by: ctx.session.user.id,
          lines: { create: lineData },
        },
        include: {
          lines: { include: { product: { select: { name: true, sku: true } } } },
        },
      });
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const adj = await ctx.prisma.invStockAdjustment.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { lines: true },
      });
      if (!adj) throw new TRPCError({ code: 'NOT_FOUND', message: 'Adjustment not found' });
      if (adj.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Adjustment is already posted' });
      }

      let totalValueChange = 0;

      await ctx.prisma.$transaction(async (tx) => {
        for (const line of adj.lines) {
          const change = Number(line.qty_diff);
          if (change === 0) continue;

          const isIncrease = change > 0;

          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: (line.variant_id ?? null) as unknown as string,
                warehouse_id: adj.warehouse_id,
                location_id: null as unknown as string,
              },
            },
            create: {
              organization_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: adj.warehouse_id,
              location_id: null,
              quantity: change,
              avg_cost: Number(line.unit_cost),
            },
            update: {
              quantity: { increment: change },
            },
          });

          await tx.invStockMovement.create({
            data: {
              organization_id: orgId,
              movement_type: isIncrease ? 'adjustment_in' : 'adjustment_out',
              reference_type: 'stock_adjustment',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: adj.warehouse_id,
              quantity: Math.abs(change),
              unit_cost: Number(line.unit_cost),
              total_cost: Math.abs(change) * Number(line.unit_cost),
              notes: line.notes ?? null,
            },
          });

          totalValueChange += Number(line.qty_diff) * Number(line.unit_cost);
        }

        await tx.invStockAdjustment.update({
          where: { id: input.id },
          data: {
            status: 'posted',
            posted_at: new Date(),
            approved_by: ctx.session.user.id,
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
        where: { id: input.id, organization_id: orgId },
      });
      if (!adj) throw new TRPCError({ code: 'NOT_FOUND', message: 'Adjustment not found' });
      if (adj.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft adjustments can be voided' });
      }
      return ctx.prisma.invStockAdjustment.delete({ where: { id: input.id } });
    }),
});
