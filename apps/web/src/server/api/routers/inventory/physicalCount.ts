import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateCountNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const last = await prisma.invPhysicalCount.findFirst({
    where: { organization_id: orgId, count_number: { startsWith: 'CNT-' } },
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
        status: z.enum(['draft', 'in_progress', 'completed', 'cancelled']).optional(),
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
        ctx.prisma.invPhysicalCount.count({
          where: { organization_id: orgId, ...(input.status ? { status: input.status } : {}) },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
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
        scope: z.enum(['full', 'partial', 'cycle']).default('full'),
        notes: z.string().optional(),
        product_ids: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const countNumber = await generateCountNumber(ctx.prisma, orgId);

      // Gather current stock levels to generate count lines
      const stockLevels = await ctx.prisma.invStockLevel.findMany({
        where: {
          organization_id: orgId,
          warehouse_id: input.warehouse_id,
          ...(input.product_ids?.length ? { product_id: { in: input.product_ids } } : {}),
        },
      });

      const count = await ctx.prisma.invPhysicalCount.create({
        data: {
          organization_id: orgId,
          count_number: countNumber,
          warehouse_id: input.warehouse_id,
          scope: input.scope,
          status: 'draft',
          notes: input.notes ?? null,
          created_by: ctx.session.user.id,
          lines: {
            create: stockLevels.map((sl) => ({
              product_id: sl.product_id,
              variant_id: sl.variant_id ?? null,
              expected_qty: sl.quantity,
            })),
          },
        },
        include: {
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
        where: { id: input.id, organization_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (count.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft counts can be started' });
      }

      // Snapshot current system quantities
      const stockLevels = await ctx.prisma.invStockLevel.findMany({
        where: { organization_id: orgId, warehouse_id: count.warehouse_id },
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
          const key = `${line.product_id}-${line.variant_id ?? ''}`;
          const sl = levelMap.get(key);
          return ctx.prisma.invPhysicalCountLine.update({
            where: { id: line.id },
            data: { expected_qty: sl?.quantity ?? 0 },
          });
        })
      );

      return ctx.prisma.invPhysicalCount.update({
        where: { id: input.id },
        data: { status: 'in_progress', started_at: new Date() },
      });
    }),

  submitCounts: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        lines: z.array(
          z.object({
            line_id: z.string(),
            counted_qty: z.number().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (!['in_progress', 'draft'].includes(count.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count is not in progress' });
      }

      await ctx.prisma.$transaction(
        input.lines.map((l) =>
          ctx.prisma.invPhysicalCountLine.update({
            where: { id: l.line_id },
            data: {
              counted_qty: l.counted_qty,
              counted_at: new Date(),
              counted_by: ctx.session.user.id,
            },
          })
        )
      );

      // Recompute discrepancies
      const updatedLines = await ctx.prisma.invPhysicalCountLine.findMany({
        where: { count_id: input.id, counted_qty: { not: null } },
      });

      await ctx.prisma.$transaction(
        updatedLines.map((line) => {
          const discrepancy = Number(line.counted_qty) - Number(line.expected_qty);
          return ctx.prisma.invPhysicalCountLine.update({
            where: { id: line.id },
            data: { discrepancy },
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
        where: { id: input.id, organization_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });

      return ctx.prisma.invPhysicalCountLine.findMany({
        where: {
          count_id: input.id,
          counted_qty: { not: null },
          discrepancy: { not: 0 },
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
        },
        orderBy: { discrepancy: 'asc' },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (count.status !== 'in_progress') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count must be in progress' });
      }

      return ctx.prisma.invPhysicalCount.update({
        where: { id: input.id },
        data: { status: 'completed', completed_at: new Date() },
      });
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const count = await ctx.prisma.invPhysicalCount.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          lines: { where: { counted_qty: { not: null } } },
        },
      });
      if (!count) throw new TRPCError({ code: 'NOT_FOUND', message: 'Physical count not found' });
      if (count.status !== 'completed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Count must be completed before posting' });
      }

      const varianceLines = count.lines.filter(
        (l) => l.counted_qty !== null && Number(l.counted_qty) !== Number(l.expected_qty)
      );

      let totalValueChange = 0;

      await ctx.prisma.$transaction(async (tx) => {
        for (const line of varianceLines) {
          const qtyChange = Number(line.counted_qty) - Number(line.expected_qty);
          const isIncrease = qtyChange > 0;

          await tx.invStockLevel.upsert({
            where: {
              product_id_variant_id_warehouse_id_location_id: {
                product_id: line.product_id,
                variant_id: (line.variant_id ?? null) as unknown as string,
                warehouse_id: count.warehouse_id,
                location_id: null as unknown as string,
              },
            },
            create: {
              organization_id: orgId,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: count.warehouse_id,
              location_id: null,
              quantity: qtyChange,
              avg_cost: 0,
            },
            update: {
              quantity: { increment: qtyChange },
            },
          });

          await tx.invStockMovement.create({
            data: {
              organization_id: orgId,
              movement_type: isIncrease ? 'adjustment_in' : 'adjustment_out',
              reference_type: 'physical_count',
              reference_id: input.id,
              product_id: line.product_id,
              variant_id: line.variant_id ?? null,
              warehouse_id: count.warehouse_id,
              quantity: Math.abs(qtyChange),
              unit_cost: 0,
              total_cost: 0,
              notes: `Physical count: ${count.count_number}`,
            },
          });

          totalValueChange += qtyChange;
        }

        await tx.invPhysicalCount.update({
          where: { id: input.id },
          data: { status: 'completed', completed_at: new Date() },
        });
      });

      return { success: true, variance_count: varianceLines.length, total_value_change: totalValueChange };
    }),
});
