// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const variantsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ product_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.invProduct.findFirst({
        where: { id: input.product_id, org_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      return ctx.prisma.invProductVariant.findMany({
        where: { product_id: input.product_id, is_active: true },
        include: {
          stock_levels: { include: { warehouse: { select: { id: true, name: true } } } },
        },
        orderBy: { created_at: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        sku: z.string().min(1),
        barcode: z.string().optional(),
        variant_attributes: z.record(z.string()),
        purchase_price: z.number().optional(),
        sale_price: z.number().optional(),
        weight_kg: z.number().optional(),
        image_url: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.invProduct.findFirst({
        where: { id: input.product_id, org_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      const exists = await ctx.prisma.invProductVariant.findFirst({
        where: { product_id: input.product_id, sku: input.sku },
      });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'Variant SKU already exists' });

      const variant = await ctx.prisma.invProductVariant.create({
        data: {
          product_id: input.product_id,
          sku: input.sku,
          barcode: input.barcode ?? null,
          variant_attributes: input.variant_attributes,
          purchase_price: input.purchase_price ?? null,
          sale_price: input.sale_price ?? null,
          weight_kg: input.weight_kg ?? null,
          image_url: input.image_url ?? null,
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
        variant_attributes: z.record(z.string()).optional(),
        purchase_price: z.number().optional(),
        sale_price: z.number().optional(),
        weight_kg: z.number().optional(),
        image_url: z.string().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.invProductVariant.update({
        where: { id },
        data: {
          ...data,
          barcode: data.barcode ?? null,
          purchase_price: data.purchase_price ?? undefined,
          sale_price: data.sale_price ?? undefined,
          weight_kg: data.weight_kg ?? null,
          image_url: data.image_url ?? null,
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
