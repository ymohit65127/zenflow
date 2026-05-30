import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

function generateDepreciationSchedule(asset: {
  id: string;
  purchase_date: Date;
  purchase_value: number;
  salvage_value: number;
  useful_life_months: number;
  depreciation_method: string;
}) {
  const depreciable = asset.purchase_value - asset.salvage_value;
  const monthlyDep = depreciable / asset.useful_life_months;
  const schedule: Array<{
    asset_id: string;
    period_year: number;
    period_month: number;
    depreciation: number;
    book_value_after: number;
  }> = [];
  let bookValue = asset.purchase_value;
  const start = new Date(asset.purchase_date);

  for (let i = 0; i < asset.useful_life_months; i++) {
    const month = ((start.getMonth() + i) % 12) + 1;
    const year = start.getFullYear() + Math.floor((start.getMonth() + i) / 12);
    let dep = monthlyDep;

    if (asset.depreciation_method === 'declining_balance') {
      const annualRate = 2 / (asset.useful_life_months / 12);
      dep = (bookValue * annualRate) / 12;
    }

    dep = Math.min(dep, bookValue - asset.salvage_value);
    bookValue = Math.max(bookValue - dep, asset.salvage_value);

    schedule.push({
      asset_id: asset.id,
      period_year: year,
      period_month: month,
      depreciation: Math.round(dep * 100) / 100,
      book_value_after: Math.round(bookValue * 100) / 100,
    });

    if (bookValue <= asset.salvage_value) break;
  }
  return schedule;
}

export const assetsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        asset_category: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const [items, total] = await Promise.all([
        ctx.prisma.accFixedAsset.findMany({
          where: {
            org_id: orgId,
            ...(input.asset_category ? { asset_category: input.asset_category } : {}),
            ...(input.search
              ? {
                  OR: [
                    { name: { contains: input.search, mode: 'insensitive' } },
                    { asset_code: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            asset_account: { select: { id: true, code: true, name: true } },
            vendor: { select: { id: true, name: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { purchase_date: 'desc' },
        }),
        ctx.prisma.accFixedAsset.count({
          where: {
            org_id: orgId,
            ...(input.asset_category ? { asset_category: input.asset_category } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const asset = await ctx.prisma.accFixedAsset.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          asset_account: true,
          accumulated_depreciation_account: true,
          depreciation_expense_account: true,
          vendor: { select: { id: true, name: true } },
          depreciation_schedules: { orderBy: [{ period_year: 'asc' }, { period_month: 'asc' }] },
        },
      });
      if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fixed asset not found' });
      return asset;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        asset_code: z.string().optional(),
        asset_category: z.string().optional(),
        description: z.string().optional(),
        purchase_date: z.string(),
        purchase_value: z.number().positive(),
        salvage_value: z.number().min(0).default(0),
        useful_life_months: z.number().int().positive(),
        depreciation_method: z
          .enum(['straight_line', 'declining_balance', 'sum_of_years'])
          .default('straight_line'),
        asset_account_id: z.string(),
        accumulated_depreciation_account_id: z.string(),
        depreciation_expense_account_id: z.string(),
        vendor_id: z.string().optional(),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const asset = await ctx.prisma.accFixedAsset.create({
        data: {
          org_id: orgId,
          name: input.name,
          asset_code: input.asset_code ?? null,
          asset_category: input.asset_category ?? null,
          description: input.description ?? null,
          purchase_date: new Date(input.purchase_date),
          purchase_value: input.purchase_value,
          salvage_value: input.salvage_value,
          useful_life_months: input.useful_life_months,
          depreciation_method: input.depreciation_method,
          asset_account_id: input.asset_account_id,
          accumulated_depreciation_account_id: input.accumulated_depreciation_account_id,
          depreciation_expense_account_id: input.depreciation_expense_account_id,
          current_book_value: input.purchase_value,
          vendor_id: input.vendor_id ?? null,
          location: input.location ?? null,
        },
      });

      // Generate depreciation schedule
      const schedule = generateDepreciationSchedule({
        id: asset.id,
        purchase_date: new Date(input.purchase_date),
        purchase_value: input.purchase_value,
        salvage_value: input.salvage_value,
        useful_life_months: input.useful_life_months,
        depreciation_method: input.depreciation_method,
      });

      await ctx.prisma.accDepreciationSchedule.createMany({ data: schedule });

      return asset;
    }),

  getDepreciationSchedule: protectedProcedure
    .input(z.object({ asset_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const asset = await ctx.prisma.accFixedAsset.findFirst({
        where: { id: input.asset_id, org_id: orgId },
      });
      if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
      return ctx.prisma.accDepreciationSchedule.findMany({
        where: { asset_id: input.asset_id },
        orderBy: [{ period_year: 'asc' }, { period_month: 'asc' }],
      });
    }),

  dispose: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        disposal_date: z.string(),
        disposal_proceeds: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const asset = await ctx.prisma.accFixedAsset.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
      const bookValue = Number(asset.current_book_value ?? asset.purchase_value);
      const gainLoss = input.disposal_proceeds - bookValue;
      return ctx.prisma.accFixedAsset.update({
        where: { id: input.id },
        data: {
          disposed_at: new Date(input.disposal_date),
          disposal_proceeds: input.disposal_proceeds,
          disposal_gain_loss: gainLoss,
          current_book_value: 0,
        },
      });
    }),
});
