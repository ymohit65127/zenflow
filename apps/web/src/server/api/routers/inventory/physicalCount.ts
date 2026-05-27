// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateCountNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invPhysicalCount.findFirst({
    where: { org_id: orgId, count_number: { startsWith: 'CNT-' } },
    orderBy: { created_at: 'desc' },
    select: { count_number: true },
  });
  const num = last
    ? parseInt(last.count_number.replace('CNT-', '') || '0', 10)
    : 0;
  return `CNT-${String(num + 1).padStart(5, '0')}`;
}

export const physicalCountRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['draft', 'counting', 'reconciled', 'posted']).optional(),
        warehouse_id: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invPhysicalCount.findMany({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
          },
          include: {
            warehouse: { select: { id: true, name: true } },
            _count: { select: { lines: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invPhysicalCount.count({
          where: { org_id: orgId, ...(input.status ? { status: input.status } : {}) },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          warehouse: true,
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
              location: { select: { id: true, name: true, code: true } },
            },
            orderBy: [{ product: { name: 'asc' } }],
          },
        },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      return count;
    }),

  create: protectedProcedure
    .input(
      z.object({
        warehouse_id: z.string(),
        scope: z.enum(['full', 'partial', 'category', 'location']).default('full'),
        scheduled_date: z.string().optional(),
        notes: z.string().optional(),
        product_ids: z.array(z.string()).optional(), // for partial scope
        location_ids: z.array(z.string()).optional(), // for location scope
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const countNumber = await generateCountNumber(ctx.prisma, orgId);

      // Gather current stock levels to generate count lines
      const stockLevels = await ctx.prisma.invStockLevel.findMany({
        where: {
          org_id: orgId,
          warehouse_id: input.warehouse_id,
          ...(input.product_ids?.length ? { product_id: { in: input.product_ids } } : {}),
          ...(input.location_ids?.length ? { location_id: { in: input.location_ids } } : {}),
        },
      });

      const count = await ctx.prisma.invPhysicalCount.create({
        data: {
          org_id: orgId,
          count_number: countNumber,
          warehouse_id: input.warehouse_id,
          scope: input.scope,
          status: 'draft',
          scheduled_date: input.scheduled_date ? new Date(input.scheduled_date) : null,
          notes: input.notes ?? null,
          created_by: ctx.session.user.id,
          lines: {
            create: stockLevels.map((sl) => ({
              product_id: sl.product_id,
              variant_id: sl.variant_id ?? null,
              location_id: sl.location_id ?? null,
              system_quantity: sl.quantity_on_hand,
              unit_cost: sl.average_cost,
            })),
          },
        },
        include: {
          warehouse: true,
          _count: { select: { lines: true } },
        },
      });

      return count;
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (count.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft counts can be started' });
      }

      // Snapshot current system quantities
      const stockLevels = await ctx.prisma.invStockLevel.findMany({
        where: { org_id: orgId, warehouse_id: count.warehouse_id },
      });
      const levelMap = new Map(
        stockLevels.map((sl) => [
          `${sl.product_id}-${sl.variant_id ?? ''}-${sl.location_id ?? ''}`,
          sl,
        ])
      );

      const lines = await ctx.prisma.invPhysicalCountLine.findMany({
        where: { count_id: input.id },
      });

      await ctx.prisma.$transaction(
        lines.map((line) => {
          const key = `${line.product_id}-${line.variant_id ?? ''}-${line.location_id ?? ''}`;
          const sl = levelMap.get(key);
          return ctx.prisma.invPhysicalCountLine.update({
            where: { id: line.id },
            data: { system_quantity: sl?.quantity_on_hand ?? 0 },
          });
        })
      );

      return ctx.prisma.invPhysicalCount.update({
        where: { id: input.id },
        data: { status: 'counting', started_at: new Date() },
      });
    }),

  submitCounts: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        lines: z.array(
          z.object({
            line_id: z.string(),
            counted_quantity: z.number().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (!['counting', 'draft'].includes(count.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count is not in counting status' });
      }

      await ctx.prisma.$transaction(
        input.lines.map((l) =>
          ctx.prisma.invPhysicalCountLine.update({
            where: { id: l.line_id },
            data: {
              counted_quantity: l.counted_quantity,
              counted_at: new Date(),
              counted_by: ctx.session.user.id,
            },
          })
        )
      );

      // Recompute variances
      const updatedLines = await ctx.prisma.invPhysicalCountLine.findMany({
        where: { count_id: input.id, counted_quantity: { not: null } },
      });

      await ctx.prisma.$transaction(
        updatedLines.map((line) => {
          const variance = Number(line.counted_quantity) - Number(line.system_quantity);
          return ctx.prisma.invPhysicalCountLine.update({
            where: { id: line.id },
            data: {
              variance,
              variance_value: variance * Number(line.unit_cost),
            },
          });
        })
      );

      return { updated: input.lines.length };
    }),

  getVarianceReport: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });

      return ctx.prisma.invPhysicalCountLine.findMany({
        where: {
          count_id: input.id,
          counted_quantity: { not: null },
          variance: { not: 0 },
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
          location: { select: { id: true, name: true, code: true } },
        },
        orderBy: { variance_value: 'asc' },
      });
    }),

  reconcile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, org_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (count.status !== 'counting') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count must be in counting status' });
      }

      // Mark as reconciled — next step is post
      return ctx.prisma.invPhysicalCount.update({
        where: { id: input.id },
        data: { status: 'reconciled' },
      });
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          lines: { where: { counted_quantity: { not: null } } },
        },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (count.status !== 'reconciled') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count must be reconciled before posting' });
      }

      const varianceLines = count.lines.filter(
        (l) => l.counted_quantity !== null && Number(l.counted_quantity) !== Number(l.system_quantity)
      );

      let totalValueChange = 0;

      await ctx.prisma.$transaction(async (tx) => {
        for (const line of varianceLines) {
          const qtyChange = Number(line.counted_quantity) - Number(line.system_quantity);
          const isIncrease = qtyChange > 0;

          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: line.variant_id ?? null,
                warehouse_id: count.warehouse_id,
                location_id: line.location_id ?? null,
              },
            },
            create: {
              org_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: count.warehouse_id,
              location_id: line.location_id ?? null,
              quantity_on_hand: qtyChange,
              average_cost: Number(line.unit_cost),
              total_value: qtyChange * Number(line.unit_cost),
              last_movement_at: new Date(),
            },
            update: {
              quantity_on_hand: { increment: qtyChange },
              last_movement_at: new Date(),
            },
          });

          await tx.invStockMovement.create({
            data: {
              org_id: orgId,
              movement_type: isIncrease ? 'adjustment_in' : 'adjustment_out',
              reference_type: 'physical_count',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: count.warehouse_id,
              to_location_id: line.location_id ?? null,
              quantity: Math.abs(qtyChange),
              unit_cost: Number(line.unit_cost),
              total_cost: Math.abs(qtyChange) * Number(line.unit_cost),
              running_stock: Number(line.counted_quantity),
              created_by: ctx.session.user.id,
              notes: `Physical count reconciliation: ${count.count_number}`,
            },
          });

          totalValueChange += qtyChange * Number(line.unit_cost);
        }

        await tx.invPhysicalCount.update({
          where: { id: input.id },
          data: { status: 'posted', completed_at: new Date() },
        });
      });

      return { success: true, variance_count: varianceLines.length, total_value_change: totalValueChange };
    }),
});
