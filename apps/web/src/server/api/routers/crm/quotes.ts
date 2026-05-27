// @ts-nocheck
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const QuoteLineSchema = z.object({
  product_id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(0.001),
  unit_price: z.number().min(0),
  discount_type: z.enum(['percent', 'amount']).optional(),
  discount_value: z.number().default(0),
  tax_rate: z.number().default(0),
  position: z.number().default(0),
});

function calcLineTotal(line: z.infer<typeof QuoteLineSchema>): number {
  const discountAmt =
    line.discount_type === 'percent'
      ? line.quantity * line.unit_price * (line.discount_value / 100)
      : (line.discount_value ?? 0);
  const subtotal = line.quantity * line.unit_price - discountAmt;
  return subtotal * (1 + line.tax_rate);
}

export const crmQuotesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        dealId: z.string().optional(),
        status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const quotes = await ctx.prisma.crmQuote.findMany({
        where: {
          organization_id: orgId,
          ...(input.dealId && { deal_id: input.dealId }),
          ...(input.status && { status: input.status }),
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        take: (input.limit ?? 25) + 1,
        orderBy: { created_at: 'desc' },
        include: {
          deal: { select: { id: true, name: true } },
          contact: { select: { id: true, first_name: true, last_name: true, email: true } },
          _count: { select: { lines: true } },
        },
      });

      let nextCursor: string | undefined;
      if (quotes.length > (input.limit ?? 25)) {
        const next = quotes.pop();
        nextCursor = next?.id;
      }

      return { quotes, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const quote = await ctx.prisma.crmQuote.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          lines: { orderBy: { position: 'asc' }, include: { product: true } },
          deal: true,
          contact: true,
          creator: { select: { id: true, name: true } },
        },
      });
      if (!quote) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
      return quote;
    }),

  create: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        title: z.string().min(1).max(255),
        contactId: z.string().optional(),
        validUntil: z.date().optional(),
        notes: z.string().optional(),
        terms: z.string().optional(),
        currency: z.string().length(3).default('USD'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;

      // Generate unique quote number
      const count = await ctx.prisma.crmQuote.count({ where: { organization_id: orgId } });
      const year = new Date().getFullYear();
      const number = `QT-${year}-${String(count + 1).padStart(4, '0')}`;

      // Generate tracking pixel ID
      const trackingPixelId = crypto.randomUUID().replace(/-/g, '');

      return ctx.prisma.crmQuote.create({
        data: {
          organization_id: orgId,
          deal_id: input.dealId,
          contact_id: input.contactId ?? null,
          created_by: userId,
          number,
          title: input.title,
          status: 'draft',
          valid_until: input.validUntil ?? null,
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          currency: input.currency,
          subtotal: 0,
          discount_total: 0,
          tax_total: 0,
          grand_total: 0,
          tracking_pixel_id: trackingPixelId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          title: z.string().min(1).max(255).optional(),
          contactId: z.string().optional(),
          validUntil: z.date().optional(),
          notes: z.string().optional(),
          terms: z.string().optional(),
          currency: z.string().length(3).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmQuote.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });

      return ctx.prisma.crmQuote.update({
        where: { id: input.id },
        data: {
          ...(input.data.title !== undefined && { title: input.data.title }),
          ...(input.data.contactId !== undefined && { contact_id: input.data.contactId ?? null }),
          ...(input.data.validUntil !== undefined && { valid_until: input.data.validUntil ?? null }),
          ...(input.data.notes !== undefined && { notes: input.data.notes ?? null }),
          ...(input.data.terms !== undefined && { terms: input.data.terms ?? null }),
          ...(input.data.currency !== undefined && { currency: input.data.currency }),
        },
      });
    }),

  updateLines: protectedProcedure
    .input(
      z.object({
        quoteId: z.string(),
        lines: z.array(QuoteLineSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const quote = await ctx.prisma.crmQuote.findFirst({
        where: { id: input.quoteId, organization_id: orgId },
      });
      if (!quote) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;

      const linesData = input.lines.map((line, idx) => {
        const discountAmt =
          line.discount_type === 'percent'
            ? line.quantity * line.unit_price * (line.discount_value / 100)
            : (line.discount_value ?? 0);
        const lineSubtotal = line.quantity * line.unit_price;
        const lineTax = (lineSubtotal - discountAmt) * line.tax_rate;
        const lineTotal = calcLineTotal(line);

        subtotal += lineSubtotal;
        discountTotal += discountAmt;
        taxTotal += lineTax;

        return {
          quote_id: input.quoteId,
          product_id: line.product_id ?? null,
          name: line.name,
          description: line.description ?? null,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_type: line.discount_type ?? null,
          discount_value: line.discount_value,
          tax_rate: line.tax_rate,
          line_total: lineTotal,
          position: idx,
        };
      });

      const grandTotal = subtotal - discountTotal + taxTotal;

      await ctx.prisma.$transaction([
        ctx.prisma.crmQuoteLine.deleteMany({ where: { quote_id: input.quoteId } }),
        ctx.prisma.crmQuoteLine.createMany({ data: linesData }),
        ctx.prisma.crmQuote.update({
          where: { id: input.quoteId },
          data: { subtotal, discount_total: discountTotal, tax_total: taxTotal, grand_total: grandTotal },
        }),
      ]);

      return ctx.prisma.crmQuote.findFirst({
        where: { id: input.quoteId },
        include: { lines: { orderBy: { position: 'asc' } } },
      });
    }),

  send: protectedProcedure
    .input(
      z.object({
        quoteId: z.string(),
        toEmail: z.string().email(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const quote = await ctx.prisma.crmQuote.findFirst({
        where: { id: input.quoteId, organization_id: orgId },
      });
      if (!quote) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });

      return ctx.prisma.crmQuote.update({
        where: { id: input.quoteId },
        data: { status: 'sent', sent_at: new Date() },
      });
    }),

  markAccepted: protectedProcedure
    .input(z.object({ quoteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const quote = await ctx.prisma.crmQuote.findFirst({
        where: { id: input.quoteId, organization_id: orgId },
      });
      if (!quote) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });

      return ctx.prisma.crmQuote.update({
        where: { id: input.quoteId },
        data: { status: 'accepted', accepted_at: new Date() },
      });
    }),

  markRejected: protectedProcedure
    .input(z.object({ quoteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmQuote.update({
        where: { id: input.quoteId, organization_id: orgId },
        data: { status: 'rejected', rejected_at: new Date() },
      });
    }),

  trackOpen: publicProcedure
    .input(z.object({ pixelId: z.string() }))
    .mutation(async ({ ctx }) => {
      // Note: pixel tracking handled via route handler
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const quote = await ctx.prisma.crmQuote.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!quote) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });

      if (quote.status === 'draft') {
        await ctx.prisma.crmQuoteLine.deleteMany({ where: { quote_id: input.id } });
        return ctx.prisma.crmQuote.delete({ where: { id: input.id } });
      }

      return { success: true };
    }),
});
