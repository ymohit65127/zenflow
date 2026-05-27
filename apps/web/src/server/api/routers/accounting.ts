import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { type PrismaClient } from '@zenflow/db';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const paginationInput = z.object({
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

async function generateInvoiceNumber(
  prisma: PrismaClient,
  orgId: string,
  prefix = 'INV'
): Promise<string> {
  const last = await prisma.invoice.findFirst({
    where: { organization_id: orgId, invoice_number: { startsWith: prefix } },
    orderBy: { created_at: 'desc' },
    select: { invoice_number: true },
  });
  const lastNum = last ? parseInt(last.invoice_number.replace(`${prefix}-`, '') || '0', 10) : 0;
  const next = String(lastNum + 1).padStart(4, '0');
  return `${prefix}-${next}`;
}

function calcLineItemTotal(qty: number, unitPrice: number, taxRate: number, discount: number) {
  const lineSubtotal = qty * unitPrice;
  const discountAmt = lineSubtotal * (discount / 100);
  const afterDiscount = lineSubtotal - discountAmt;
  const taxAmt = afterDiscount * (taxRate / 100);
  return afterDiscount + taxAmt;
}

function calcInvoiceTotals(
  items: Array<{ quantity: number; unit_price: number; tax_rate: number; discount: number }>
) {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;
  for (const item of items) {
    const lineSubtotal = item.quantity * item.unit_price;
    const discountAmt = lineSubtotal * (item.discount / 100);
    const afterDiscount = lineSubtotal - discountAmt;
    const taxAmt = afterDiscount * (item.tax_rate / 100);
    subtotal += lineSubtotal;
    discountTotal += discountAmt;
    taxTotal += taxAmt;
  }
  const total = subtotal - discountTotal + taxTotal;
  return { subtotal, taxTotal, discountTotal, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Line item schema
// ─────────────────────────────────────────────────────────────────────────────

const lineItemInput = z.object({
  description: z.string().min(1, 'Description required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
  tax_rate: z.number().min(0).max(100).default(0),
  discount: z.number().min(0).max(100).default(0),
  sort_order: z.number().int().default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// Invoices router
// ─────────────────────────────────────────────────────────────────────────────

const invoicesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        status: z
          .enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'])
          .optional(),
        type: z.enum(['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA']).optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.invoice.findMany({
          where: {
            organization_id: orgId,
            deleted_at: null,
            ...(input.status ? { status: input.status } : {}),
            ...(input.type ? { type: input.type } : {}),
            ...(input.from_date || input.to_date
              ? {
                  issue_date: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
            ...(input.search
              ? {
                  OR: [
                    { invoice_number: { contains: input.search, mode: 'insensitive' } },
                    { notes: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            _count: { select: { payments: true, line_items: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.invoice.count({
          where: {
            organization_id: orgId,
            deleted_at: null,
            ...(input.status ? { status: input.status } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const invoice = await ctx.prisma.invoice.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments: { orderBy: { paid_at: 'desc' } },
        },
      });
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      return invoice;
    }),

  create: protectedProcedure
    .input(
      z.object({
        contact_id: z.string().optional(),
        type: z.enum(['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA']).default('INVOICE'),
        issue_date: z.string(),
        due_date: z.string().optional(),
        currency: z.string().default('USD'),
        notes: z.string().optional(),
        terms: z.string().optional(),
        line_items: z.array(lineItemInput).min(1, 'At least one line item required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const prefixMap: Record<string, string> = {
        INVOICE: 'INV',
        CREDIT_NOTE: 'CN',
        DEBIT_NOTE: 'DN',
        PROFORMA: 'PRO',
      };
      const prefix = prefixMap[input.type] ?? 'INV';
      const invoiceNumber = await generateInvoiceNumber(ctx.prisma, orgId, prefix);
      const { subtotal, taxTotal, discountTotal, total } = calcInvoiceTotals(input.line_items);

      return ctx.prisma.invoice.create({
        data: {
          organization_id: orgId,
          contact_id: input.contact_id ?? null,
          invoice_number: invoiceNumber,
          type: input.type,
          status: 'DRAFT',
          issue_date: new Date(input.issue_date),
          due_date: input.due_date ? new Date(input.due_date) : null,
          currency: input.currency,
          subtotal,
          tax_total: taxTotal,
          discount_total: discountTotal,
          total,
          paid_amount: 0,
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          line_items: {
            create: input.line_items.map((item, idx) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              discount: item.discount,
              total: calcLineItemTotal(item.quantity, item.unit_price, item.tax_rate, item.discount),
              sort_order: item.sort_order ?? idx,
            })),
          },
        },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        contact_id: z.string().optional(),
        type: z.enum(['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA']).optional(),
        status: z
          .enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'])
          .optional(),
        issue_date: z.string().optional(),
        due_date: z.string().optional(),
        currency: z.string().optional(),
        notes: z.string().optional(),
        terms: z.string().optional(),
        line_items: z.array(lineItemInput).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, line_items, ...data } = input;
      const existing = await ctx.prisma.invoice.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });

      let totals = {};
      if (line_items) {
        const { subtotal, taxTotal, discountTotal, total } = calcInvoiceTotals(line_items);
        totals = { subtotal, tax_total: taxTotal, discount_total: discountTotal, total };
        await ctx.prisma.invoiceLineItem.deleteMany({ where: { invoice_id: id } });
        await ctx.prisma.invoiceLineItem.createMany({
          data: line_items.map((item, idx) => ({
            invoice_id: id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            discount: item.discount,
            total: calcLineItemTotal(item.quantity, item.unit_price, item.tax_rate, item.discount),
            sort_order: item.sort_order ?? idx,
          })),
        });
      }

      return ctx.prisma.invoice.update({
        where: { id },
        data: {
          ...data,
          contact_id: data.contact_id ?? undefined,
          issue_date: data.issue_date ? new Date(data.issue_date) : undefined,
          due_date: data.due_date ? new Date(data.due_date) : undefined,
          ...totals,
        },
        include: {
          line_items: { orderBy: { sort_order: 'asc' } },
          payments: { orderBy: { paid_at: 'desc' } },
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.invoice.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      return ctx.prisma.invoice.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  send: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.invoice.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      return ctx.prisma.invoice.update({
        where: { id: input.id },
        data: { status: 'SENT', sent_at: new Date() },
      });
    }),

  addPayment: protectedProcedure
    .input(
      z.object({
        invoice_id: z.string(),
        amount: z.number().positive('Amount must be positive'),
        currency: z.string().default('USD'),
        method: z.enum([
          'CASH',
          'BANK_TRANSFER',
          'CREDIT_CARD',
          'DEBIT_CARD',
          'UPI',
          'CHEQUE',
          'PAYPAL',
          'STRIPE',
          'RAZORPAY',
          'OTHER',
        ]),
        reference: z.string().optional(),
        notes: z.string().optional(),
        paid_at: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const invoice = await ctx.prisma.invoice.findFirst({
        where: { id: input.invoice_id, organization_id: orgId, deleted_at: null },
      });
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });

      const payment = await ctx.prisma.payment.create({
        data: {
          invoice_id: input.invoice_id,
          amount: input.amount,
          currency: input.currency,
          method: input.method,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          paid_at: input.paid_at ? new Date(input.paid_at) : new Date(),
        },
      });

      const newPaidAmount = Number(invoice.paid_amount) + input.amount;
      const invoiceTotal = Number(invoice.total);
      let newStatus: 'PARTIAL' | 'PAID' = 'PARTIAL';
      if (newPaidAmount >= invoiceTotal) {
        newStatus = 'PAID';
      }

      await ctx.prisma.invoice.update({
        where: { id: input.invoice_id },
        data: {
          paid_amount: newPaidAmount,
          status: newStatus,
          ...(newStatus === 'PAID' ? { paid_at: new Date() } : {}),
        },
      });

      return payment;
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [draft, sent, paid, overdue, revenueAgg, outstandingAgg] = await Promise.all([
      ctx.prisma.invoice.count({
        where: { organization_id: orgId, deleted_at: null, status: 'DRAFT' },
      }),
      ctx.prisma.invoice.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { in: ['SENT', 'VIEWED', 'PARTIAL'] },
        },
      }),
      ctx.prisma.invoice.count({
        where: { organization_id: orgId, deleted_at: null, status: 'PAID' },
      }),
      ctx.prisma.invoice.count({
        where: { organization_id: orgId, deleted_at: null, status: 'OVERDUE' },
      }),
      ctx.prisma.invoice.aggregate({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'PAID',
          paid_at: { gte: startOfMonth },
        },
        _sum: { paid_amount: true },
      }),
      ctx.prisma.invoice.aggregate({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { in: ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { total: true, paid_amount: true },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.paid_amount ?? 0);
    const totalBilled = Number(outstandingAgg._sum.total ?? 0);
    const totalPaid = Number(outstandingAgg._sum.paid_amount ?? 0);
    const outstandingAmount = totalBilled - totalPaid;

    return { draft, sent, paid, overdue, totalRevenue, outstandingAmount };
  }),

  revenueChart: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();
    const months: Array<{ label: string; start: Date; end: Date }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      months.push({
        label: start.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        start,
        end,
      });
    }

    const data = await Promise.all(
      months.map(async (m) => {
        const agg = await ctx.prisma.invoice.aggregate({
          where: {
            organization_id: orgId,
            deleted_at: null,
            status: { in: ['PAID', 'PARTIAL'] },
            issue_date: { gte: m.start, lte: m.end },
          },
          _sum: { paid_amount: true },
        });
        return {
          month: m.label,
          revenue: Number(agg._sum.paid_amount ?? 0),
        };
      })
    );

    return data;
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Expenses router
// ─────────────────────────────────────────────────────────────────────────────

const expensesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED']).optional(),
        category: z.string().optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.expense.findMany({
          where: {
            organization_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.category ? { category: input.category } : {}),
            ...(input.from_date || input.to_date
              ? {
                  expense_date: {
                    ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
                    ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
                  },
                }
              : {}),
            ...(input.search
              ? {
                  OR: [
                    { description: { contains: input.search, mode: 'insensitive' } },
                    { category: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { expense_date: 'desc' },
        }),
        ctx.prisma.expense.count({
          where: {
            organization_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.category ? { category: input.category } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  create: protectedProcedure
    .input(
      z.object({
        category: z.string().min(1, 'Category is required'),
        description: z.string().min(1, 'Description is required'),
        amount: z.number().positive('Amount must be positive'),
        currency: z.string().default('USD'),
        expense_date: z.string(),
        receipt_url: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.expense.create({
        data: {
          organization_id: orgId,
          category: input.category,
          description: input.description,
          amount: input.amount,
          currency: input.currency,
          expense_date: new Date(input.expense_date),
          status: 'PENDING',
          receipt_url: input.receipt_url ?? null,
          notes: input.notes ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        category: z.string().optional(),
        description: z.string().optional(),
        amount: z.number().positive().optional(),
        currency: z.string().optional(),
        expense_date: z.string().optional(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED']).optional(),
        receipt_url: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.expense.findFirst({
        where: { id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });

      const userId = ctx.session.user.id as string;
      return ctx.prisma.expense.update({
        where: { id },
        data: {
          ...data,
          expense_date: data.expense_date ? new Date(data.expense_date) : undefined,
          ...(data.status === 'APPROVED'
            ? { approved_by: userId, approved_at: new Date() }
            : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.expense.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      return ctx.prisma.expense.delete({ where: { id: input.id } });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalThisMonthAgg, pending, approved, categoryBreakdown] = await Promise.all([
      ctx.prisma.expense.aggregate({
        where: {
          organization_id: orgId,
          expense_date: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      ctx.prisma.expense.count({ where: { organization_id: orgId, status: 'PENDING' } }),
      ctx.prisma.expense.count({ where: { organization_id: orgId, status: 'APPROVED' } }),
      ctx.prisma.expense.groupBy({
        by: ['category'],
        where: { organization_id: orgId, expense_date: { gte: startOfMonth } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 8,
      }),
    ]);

    return {
      totalThisMonth: Number(totalThisMonthAgg._sum.amount ?? 0),
      pending,
      approved,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        amount: Number(c._sum.amount ?? 0),
      })),
    };
  }),

  categories: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const rows = await ctx.prisma.expense.groupBy({
      by: ['category'],
      where: { organization_id: orgId },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Chart of Accounts router
// ─────────────────────────────────────────────────────────────────────────────

const chartOfAccountsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.chartOfAccount.findMany({
        where: {
          organization_id: orgId,
          ...(input.type ? { type: input.type } : {}),
        },
        orderBy: [{ type: 'asc' }, { code: 'asc' }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1, 'Account code required'),
        name: z.string().min(1, 'Account name required'),
        type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
        description: z.string().optional(),
        parent_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.chartOfAccount.findFirst({
        where: { organization_id: orgId, code: input.code },
      });
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Account code already exists' });

      return ctx.prisma.chartOfAccount.create({
        data: {
          organization_id: orgId,
          code: input.code,
          name: input.name,
          type: input.type,
          description: input.description ?? null,
          parent_id: input.parent_id ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        code: z.string().optional(),
        name: z.string().optional(),
        type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.chartOfAccount.findFirst({
        where: { id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      return ctx.prisma.chartOfAccount.update({ where: { id }, data });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Root accounting router
// ─────────────────────────────────────────────────────────────────────────────

export const accountingRouter = createTRPCRouter({
  invoices: invoicesRouter,
  expenses: expensesRouter,
  chartOfAccounts: chartOfAccountsRouter,
});
