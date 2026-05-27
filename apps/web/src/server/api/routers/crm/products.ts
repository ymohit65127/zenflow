// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const ProductCreateSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(100).optional(),
  description: z.string().optional(),
  unit_price: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  tax_rate: z.number().min(0).max(1).default(0),
  unit: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  is_active: z.boolean().default(true),
});

const ProductUpdateSchema = ProductCreateSchema.partial();

export const crmProductsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const products = await ctx.prisma.crmProduct.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          ...(input.isActive !== undefined && { is_active: input.isActive }),
          ...(input.category && { category: input.category }),
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { code: { contains: input.search, mode: 'insensitive' } },
              { description: { contains: input.search, mode: 'insensitive' } },
            ],
          }),
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        take: (input.limit ?? 25) + 1,
        orderBy: { name: 'asc' },
      });

      let nextCursor: string | undefined;
      if (products.length > (input.limit ?? 25)) {
        const next = products.pop();
        nextCursor = next?.id;
      }

      return { products, nextCursor };
    }),

  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const result = await ctx.prisma.crmProduct.findMany({
      where: { organization_id: orgId, deleted_at: null, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    return result.map((r) => r.category).filter(Boolean) as string[];
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.crmProduct.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      return product;
    }),

  create: protectedProcedure
    .input(ProductCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmProduct.create({
        data: {
          organization_id: orgId,
          name: input.name,
          code: input.code ?? null,
          description: input.description ?? null,
          unit_price: input.unit_price,
          currency: input.currency,
          tax_rate: input.tax_rate,
          unit: input.unit ?? null,
          category: input.category ?? null,
          is_active: input.is_active,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: ProductUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmProduct.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      const { data } = input;
      return ctx.prisma.crmProduct.update({
        where: { id: input.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.code !== undefined && { code: data.code ?? null }),
          ...(data.description !== undefined && { description: data.description ?? null }),
          ...(data.unit_price !== undefined && { unit_price: data.unit_price }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.tax_rate !== undefined && { tax_rate: data.tax_rate }),
          ...(data.unit !== undefined && { unit: data.unit ?? null }),
          ...(data.category !== undefined && { category: data.category ?? null }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmProduct.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      return ctx.prisma.crmProduct.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  bulkImport: protectedProcedure
    .input(
      z.object({
        rows: z.array(
          z.object({
            name: z.string().min(1),
            code: z.string().optional(),
            description: z.string().optional(),
            unit_price: z.number().min(0),
            currency: z.string().length(3).default('USD'),
            tax_rate: z.number().min(0).max(1).default(0),
            unit: z.string().optional(),
            category: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmProduct.createMany({
        data: input.rows.map((row) => ({
          organization_id: orgId,
          name: row.name,
          code: row.code ?? null,
          description: row.description ?? null,
          unit_price: row.unit_price,
          currency: row.currency,
          tax_rate: row.tax_rate,
          unit: row.unit ?? null,
          category: row.category ?? null,
          is_active: true,
        })),
        skipDuplicates: true,
      });
    }),
});
