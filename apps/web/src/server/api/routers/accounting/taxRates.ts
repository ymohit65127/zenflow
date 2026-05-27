// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const taxRatesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ include_inactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.accTax.findMany({
        where: {
          org_id: orgId,
          ...(input.include_inactive ? {} : { is_active: true }),
        },
        include: {
          tax_account: { select: { id: true, code: true, name: true } },
        },
        orderBy: { name: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().max(100),
        type: z.enum(['gst', 'vat', 'service_tax', 'custom', 'none']).default('gst'),
        rate: z.number().min(0).max(100),
        components: z
          .array(z.object({ name: z.string(), rate: z.number() }))
          .optional(),
        tax_account_id: z.string().optional(),
        is_default: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      if (input.is_default) {
        await ctx.prisma.accTax.updateMany({
          where: { org_id: orgId, is_default: true },
          data: { is_default: false },
        });
      }
      return ctx.prisma.accTax.create({
        data: {
          org_id: orgId,
          name: input.name,
          type: input.type,
          rate: input.rate,
          components: input.components ?? undefined,
          tax_account_id: input.tax_account_id ?? null,
          is_default: input.is_default ?? false,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        rate: z.number().optional(),
        components: z.array(z.object({ name: z.string(), rate: z.number() })).optional(),
        tax_account_id: z.string().optional(),
        is_active: z.boolean().optional(),
        is_default: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;
      const tax = await ctx.prisma.accTax.findFirst({ where: { id, org_id: orgId } });
      if (!tax) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax rate not found' });
      if (data.is_default) {
        await ctx.prisma.accTax.updateMany({
          where: { org_id: orgId, is_default: true },
          data: { is_default: false },
        });
      }
      return ctx.prisma.accTax.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const tax = await ctx.prisma.accTax.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!tax) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tax rate not found' });
      return ctx.prisma.accTax.delete({ where: { id: input.id } });
    }),
});
