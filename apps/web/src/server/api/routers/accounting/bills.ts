import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

async function generateBillNumber(
  prisma: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]['ctx']['prisma'],
  orgId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.accBill.count({
    where: { org_id: orgId, bill_number: { startsWith: `BILL-${year}-` } },
  });
  return `BILL-${year}-${String(count + 1).padStart(4, '0')}`;
}

const billLineInput = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  tax_id: z.string().optional(),
  tax_rate: z.number().min(0).max(100).default(0),
  account_id: z.string(),
  hsn_sac_code: z.string().optional(),
  position: z.number().int().default(0),
});

export const billsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        status: z
          .enum(['draft', 'pending', 'approved', 'partially_paid', 'paid', 'overdue', 'void'])
          .optional(),
        vendor_id: z.string().optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const [items, total] = await Promise.all([
        ctx.prisma.accBill.findMany({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.vendor_id ? { vendor_id: input.vendor_id } : {}),
            ...(input.from_date || input.to_date
              ? {
                  bill_date: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
            ...(input.search
              ? {
                  OR: [
                    { bill_number: { contains: input.search, mode: 'insensitive' } },
                    { vendor_invoice_number: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            vendor: { select: { id: true, name: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { bill_date: 'desc' },
        }),
        ctx.prisma.accBill.count({
          where: {
            org_id: orgId,
            ...(input.status ? { status: input.status } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bill = await ctx.prisma.accBill.findFirst({
        where: { id: input.id, org_id: orgId },
        include: {
          vendor: true,
          lines: {
            include: { account: { select: { id: true, code: true, name: true } }, tax: true },
            orderBy: { position: 'asc' },
          },
        },
      });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      return bill;
    }),

  create: protectedProcedure
    .input(
      z.object({
        vendor_id: z.string(),
        vendor_invoice_number: z.string().optional(),
        bill_date: z.string(),
        due_date: z.string().optional(),
        currency: z.string().optional(),
        notes: z.string().optional(),
        payment_terms: z
          .enum(['immediate', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'custom'])
          .optional(),
        lines: z.array(billLineInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bill_number = await generateBillNumber(ctx.prisma, orgId);

      let subtotal = 0;
      let tax_total = 0;
      const linesData = input.lines.map((line, idx) => {
        const lineTotal = line.quantity * line.unit_price;
        const taxAmount = lineTotal * (line.tax_rate / 100);
        subtotal += lineTotal;
        tax_total += taxAmount;
        return {
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          tax_id: line.tax_id ?? null,
          tax_rate: line.tax_rate,
          tax_amount: taxAmount,
          line_total: lineTotal + taxAmount,
          account_id: line.account_id,
          hsn_sac_code: line.hsn_sac_code ?? null,
          position: line.position ?? idx,
        };
      });
      const grand_total = subtotal + tax_total;

      return ctx.prisma.accBill.create({
        data: {
          org_id: orgId,
          bill_number,
          vendor_id: input.vendor_id,
          vendor_invoice_number: input.vendor_invoice_number ?? null,
          bill_date: new Date(input.bill_date),
          due_date: input.due_date ? new Date(input.due_date) : null,
          currency: input.currency ?? null,
          notes: input.notes ?? null,
          payment_terms: input.payment_terms ?? null,
          subtotal,
          tax_total,
          grand_total,
          balance_due: grand_total,
          created_by: ctx.session.user.id,
          lines: { create: linesData },
        },
        include: { vendor: true, lines: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        vendor_invoice_number: z.string().optional(),
        bill_date: z.string().optional(),
        due_date: z.string().optional(),
        notes: z.string().optional(),
        payment_terms: z
          .enum(['immediate', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'custom'])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, bill_date, due_date, ...data } = input;
      const bill = await ctx.prisma.accBill.findFirst({ where: { id, org_id: orgId } });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      if (bill.status !== 'draft')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only draft bills can be edited' });
      return ctx.prisma.accBill.update({
        where: { id },
        data: {
          ...data,
          ...(bill_date ? { bill_date: new Date(bill_date) } : {}),
          ...(due_date ? { due_date: new Date(due_date) } : {}),
        },
      });
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bill = await ctx.prisma.accBill.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      if (bill.status !== 'pending' && bill.status !== 'draft')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bill cannot be approved in current state' });
      return ctx.prisma.accBill.update({
        where: { id: input.id },
        data: { status: 'approved' },
      });
    }),

  recordPayment: protectedProcedure
    .input(
      z.object({
        bill_id: z.string(),
        amount: z.number().positive(),
        payment_date: z.string(),
        payment_method: z.enum(['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'neft', 'rtgs', 'imps', 'other']),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bill = await ctx.prisma.accBill.findFirst({ where: { id: input.bill_id, org_id: orgId } });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });

      const newAmountPaid = Number(bill.amount_paid) + input.amount;
      const newBalanceDue = Number(bill.grand_total) - newAmountPaid;
      const newStatus =
        newBalanceDue <= 0
          ? 'paid'
          : newAmountPaid > 0
          ? 'partially_paid'
          : bill.status;

      return ctx.prisma.accBill.update({
        where: { id: input.bill_id },
        data: {
          amount_paid: newAmountPaid,
          balance_due: Math.max(newBalanceDue, 0),
          status: newStatus,
        },
      });
    }),

  void: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const bill = await ctx.prisma.accBill.findFirst({ where: { id: input.id, org_id: orgId } });
      if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      if (bill.status === 'paid')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Paid bills cannot be voided' });
      return ctx.prisma.accBill.update({ where: { id: input.id }, data: { status: 'void' } });
    }),
});
