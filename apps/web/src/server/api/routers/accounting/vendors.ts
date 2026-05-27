// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const vendorsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        include_inactive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const [items, total] = await Promise.all([
        ctx.prisma.accVendor.findMany({
          where: {
            org_id: orgId,
            ...(input.include_inactive ? {} : { is_active: true }),
            deleted_at: null,
            ...(input.search
              ? {
                  OR: [
                    { name: { contains: input.search, mode: 'insensitive' } },
                    { email: { contains: input.search, mode: 'insensitive' } },
                    { vendor_code: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { name: 'asc' },
        }),
        ctx.prisma.accVendor.count({
          where: {
            org_id: orgId,
            ...(input.include_inactive ? {} : { is_active: true }),
            deleted_at: null,
          },
        }),
      ]);
      return { items, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const vendor = await ctx.prisma.accVendor.findFirst({
        where: { id: input.id, org_id: orgId, deleted_at: null },
        include: {
          bills: {
            take: 10,
            orderBy: { created_at: 'desc' },
            select: {
              id: true,
              bill_number: true,
              bill_date: true,
              grand_total: true,
              status: true,
              balance_due: true,
            },
          },
        },
      });
      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      return vendor;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        vendor_code: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        gstin: z.string().optional(),
        pan: z.string().optional(),
        payment_terms: z
          .enum(['immediate', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'custom'])
          .optional(),
        currency: z.string().optional(),
        bank_account_number: z.string().optional(),
        bank_ifsc: z.string().optional(),
        bank_name: z.string().optional(),
        credit_limit: z.number().optional(),
        notes: z.string().optional(),
        tds_applicable: z.boolean().optional(),
        tds_section: z.string().optional(),
        tds_rate: z.number().optional(),
        billing_address: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      if (input.vendor_code) {
        const exists = await ctx.prisma.accVendor.findUnique({
          where: { org_id_vendor_code: { org_id: orgId, vendor_code: input.vendor_code } },
        });
        if (exists)
          throw new TRPCError({ code: 'CONFLICT', message: 'Vendor code already exists' });
      }
      return ctx.prisma.accVendor.create({
        data: {
          org_id: orgId,
          name: input.name,
          vendor_code: input.vendor_code ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          gstin: input.gstin ?? null,
          pan: input.pan ?? null,
          payment_terms: input.payment_terms ?? null,
          currency: input.currency ?? null,
          bank_account_number: input.bank_account_number ?? null,
          bank_ifsc: input.bank_ifsc ?? null,
          bank_name: input.bank_name ?? null,
          credit_limit: input.credit_limit ?? null,
          notes: input.notes ?? null,
          tds_applicable: input.tds_applicable ?? false,
          tds_section: input.tds_section ?? null,
          tds_rate: input.tds_rate ?? null,
          billing_address: input.billing_address ?? undefined,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        gstin: z.string().optional(),
        pan: z.string().optional(),
        payment_terms: z
          .enum(['immediate', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'custom'])
          .optional(),
        currency: z.string().optional(),
        bank_account_number: z.string().optional(),
        bank_ifsc: z.string().optional(),
        bank_name: z.string().optional(),
        credit_limit: z.number().optional(),
        notes: z.string().optional(),
        is_active: z.boolean().optional(),
        tds_applicable: z.boolean().optional(),
        tds_section: z.string().optional(),
        tds_rate: z.number().optional(),
        billing_address: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;
      const vendor = await ctx.prisma.accVendor.findFirst({
        where: { id, org_id: orgId, deleted_at: null },
      });
      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      return ctx.prisma.accVendor.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const vendor = await ctx.prisma.accVendor.findFirst({
        where: { id: input.id, org_id: orgId, deleted_at: null },
      });
      if (!vendor) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      return ctx.prisma.accVendor.update({
        where: { id: input.id },
        data: { deleted_at: new Date(), is_active: false },
      });
    }),
});
