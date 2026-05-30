import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const variantsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ product_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.invProduct.findFirst({
        where: { id: input.product_id, organization_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      return ctx.prisma.invProductVariant.findMany({
        where: { product_id: input.product_id, is_active: true },
        orderBy: { created_at: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        sku: z.string().min(1),
        barcode: z.string().optional(),
        name: z.string().min(1),
        attributes: z.record(z.string()),
        cost_price: z.number().min(0).optional(),
        sale_price: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.invProduct.findFirst({
        where: { id: input.product_id, organization_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      const exists = await ctx.prisma.invProductVariant.findFirst({
        where: { product_id: input.product_id, sku: input.sku },
      });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'Variant SKU already exists' });

      const variant = await ctx.prisma.invProductVariant.create({
        data: {
          organization_id: orgId,
          product_id: input.product_id,
          sku: input.sku,
          barcode: input.barcode ?? null,
          name: input.name,
          attributes: input.attributes,
          cost_price: input.cost_price ?? 0,
          sale_price: input.sale_price ?? 0,
        },
      });

      // Mark the parent product as has_variants
      await ctx.prisma.invProduct.update({
        where: { id: input.product_id },
        data: { has_variants: true },
      });

      return variant;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        name: z.string().optional(),
        attributes: z.record(z.string()).optional(),
        cost_price: z.number().min(0).optional(),
        sale_price: z.number().min(0).optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.invProductVariant.update({
        where: { id },
        data: {
          ...data,
          barcode: data.barcode ?? undefined,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.invProductVariant.update({
        where: { id: input.id },
        data: { is_active: false },
      });
    }),
});
