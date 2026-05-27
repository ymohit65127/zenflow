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

async function generatePONumber(
  prisma: PrismaClient,
  orgId: string
): Promise<string> {
  const last = await prisma.purchaseOrder.findFirst({
    where: { organization_id: orgId, po_number: { startsWith: 'PO-' } },
    orderBy: { created_at: 'desc' },
    select: { po_number: true },
  });
  const lastNum = last ? parseInt(last.po_number.replace('PO-', '') || '0', 10) : 0;
  const next = String(lastNum + 1).padStart(4, '0');
  return `PO-${next}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Products router
// ─────────────────────────────────────────────────────────────────────────────

const productsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        type: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE', 'BUNDLE']).optional(),
        category_id: z.string().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.product.findMany({
          where: {
            organization_id: orgId,
            deleted_at: null,
            ...(input.type ? { type: input.type } : {}),
            ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
            ...(input.category_id
              ? { categories: { some: { category_id: input.category_id } } }
              : {}),
            ...(input.search
              ? {
                  OR: [
                    { name: { contains: input.search, mode: 'insensitive' } },
                    { sku: { contains: input.search, mode: 'insensitive' } },
                    { description: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            categories: { include: { category: true } },
            stock_items: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.product.count({
          where: {
            organization_id: orgId,
            deleted_at: null,
            ...(input.type ? { type: input.type } : {}),
          },
        }),
      ]);
      return { items, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.product.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          categories: { include: { category: true } },
          stock_items: { include: { warehouse: true } },
        },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      return product;
    }),

  create: protectedProcedure
    .input(
      z.object({
        sku: z.string().min(1, 'SKU is required'),
        name: z.string().min(1, 'Product name is required'),
        description: z.string().optional(),
        type: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE', 'BUNDLE']).default('PHYSICAL'),
        unit: z.string().default('pcs'),
        cost_price: z.number().min(0).optional(),
        sale_price: z.number().min(0).optional(),
        tax_rate: z.number().min(0).max(100).default(0),
        track_inventory: z.boolean().default(true),
        is_active: z.boolean().default(true),
        category_ids: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.product.findFirst({
        where: { organization_id: orgId, sku: input.sku, deleted_at: null },
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'SKU already exists' });

      const { category_ids, ...data } = input;
      return ctx.prisma.product.create({
        data: {
          organization_id: orgId,
          sku: data.sku,
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          unit: data.unit,
          cost_price: data.cost_price ?? null,
          sale_price: data.sale_price ?? null,
          tax_rate: data.tax_rate,
          track_inventory: data.track_inventory,
          is_active: data.is_active,
          categories: {
            create: category_ids.map((catId) => ({ category_id: catId })),
          },
        },
        include: {
          categories: { include: { category: true } },
          stock_items: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        sku: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE', 'BUNDLE']).optional(),
        unit: z.string().optional(),
        cost_price: z.number().min(0).optional(),
        sale_price: z.number().min(0).optional(),
        tax_rate: z.number().min(0).max(100).optional(),
        track_inventory: z.boolean().optional(),
        is_active: z.boolean().optional(),
        category_ids: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, category_ids, ...data } = input;
      const existing = await ctx.prisma.product.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      if (category_ids !== undefined) {
        await ctx.prisma.productCategoryMap.deleteMany({ where: { product_id: id } });
        if (category_ids.length > 0) {
          await ctx.prisma.productCategoryMap.createMany({
            data: category_ids.map((catId) => ({ product_id: id, category_id: catId })),
          });
        }
      }

      return ctx.prisma.product.update({
        where: { id },
        data: {
          ...data,
          cost_price: data.cost_price ?? undefined,
          sale_price: data.sale_price ?? undefined,
        },
        include: {
          categories: { include: { category: true } },
          stock_items: { include: { warehouse: true } },
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.product.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
      return ctx.prisma.product.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const [total, active, allStockItems, stockValueAgg] = await Promise.all([
      ctx.prisma.product.count({ where: { organization_id: orgId, deleted_at: null } }),
      ctx.prisma.product.count({ where: { organization_id: orgId, deleted_at: null, is_active: true } }),
      ctx.prisma.stockItem.findMany({
        where: { product: { organization_id: orgId, deleted_at: null, track_inventory: true } },
        select: { quantity: true, reorder_point: true },
      }),
      ctx.prisma.stockItem.aggregate({
        where: { product: { organization_id: orgId, deleted_at: null } },
        _sum: { quantity: true },
      }),
    ]);

    const lowStock = allStockItems.filter(
      (s) => s.reorder_point !== null && Number(s.quantity) <= Number(s.reorder_point)
    ).length;
    const outOfStock = allStockItems.filter((s) => Number(s.quantity) <= 0).length;

    // Calculate total stock value
    const stockValueCalc = await ctx.prisma.stockItem.findMany({
      where: { product: { organization_id: orgId, deleted_at: null } },
      include: { product: { select: { cost_price: true } } },
    });
    const totalStockValue = stockValueCalc.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.product.cost_price ?? 0);
    }, 0);

    return {
      total,
      active,
      lowStock,
      outOfStock,
      totalStockValue,
      totalStockQty: Number(stockValueAgg._sum.quantity ?? 0),
    };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Categories router
// ─────────────────────────────────────────────────────────────────────────────

const categoriesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.productCategory.findMany({
      where: { organization_id: orgId },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Category name is required'),
        slug: z.string().min(1, 'Slug is required'),
        parent_id: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.productCategory.create({
        data: {
          organization_id: orgId,
          name: input.name,
          slug: input.slug,
          parent_id: input.parent_id ?? null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.productCategory.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found' });
      return ctx.prisma.productCategory.delete({ where: { id: input.id } });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Warehouses router
// ─────────────────────────────────────────────────────────────────────────────

const warehousesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.warehouse.findMany({
      where: { organization_id: orgId },
      include: { _count: { select: { stock_items: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Warehouse name is required'),
        code: z.string().min(1, 'Warehouse code is required'),
        address: z
          .object({
            line1: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            country: z.string().optional(),
            postal_code: z.string().optional(),
          })
          .optional(),
        is_active: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.warehouse.create({
        data: {
          organization_id: orgId,
          name: input.name,
          code: input.code,
          address: input.address ?? null,
          is_active: input.is_active,
        },
      });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Stock router
// ─────────────────────────────────────────────────────────────────────────────

const stockRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        product_id: z.string().optional(),
        warehouse_id: z.string().optional(),
        low_stock_only: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.stockItem.findMany({
        where: {
          product: { organization_id: orgId, deleted_at: null },
          ...(input.product_id ? { product_id: input.product_id } : {}),
          ...(input.warehouse_id ? { warehouse_id: input.warehouse_id } : {}),
        },
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
        take: input.limit,
        skip: input.offset,
        orderBy: [{ product: { name: 'asc' } }],
      });
    }),

  adjust: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        warehouse_id: z.string(),
        adjustment_type: z.enum(['add', 'subtract', 'set']),
        quantity: z.number().min(0),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.product.findFirst({
        where: { id: input.product_id, organization_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      const existing = await ctx.prisma.stockItem.findFirst({
        where: { product_id: input.product_id, warehouse_id: input.warehouse_id },
      });

      let newQty: number;
      if (input.adjustment_type === 'set') {
        newQty = input.quantity;
      } else if (existing) {
        const currentQty = Number(existing.quantity);
        newQty =
          input.adjustment_type === 'add'
            ? currentQty + input.quantity
            : Math.max(0, currentQty - input.quantity);
      } else {
        newQty = input.adjustment_type === 'add' ? input.quantity : 0;
      }

      if (existing) {
        return ctx.prisma.stockItem.update({
          where: { id: existing.id },
          data: { quantity: newQty },
          include: {
            product: { select: { id: true, sku: true, name: true } },
            warehouse: { select: { id: true, name: true } },
          },
        });
      } else {
        return ctx.prisma.stockItem.create({
          data: {
            product_id: input.product_id,
            warehouse_id: input.warehouse_id,
            quantity: newQty,
            reserved_qty: 0,
          },
          include: {
            product: { select: { id: true, sku: true, name: true } },
            warehouse: { select: { id: true, name: true } },
          },
        });
      }
    }),

  setReorderPoint: protectedProcedure
    .input(
      z.object({
        product_id: z.string(),
        warehouse_id: z.string(),
        reorder_point: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const product = await ctx.prisma.product.findFirst({
        where: { id: input.product_id, organization_id: orgId, deleted_at: null },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });

      return ctx.prisma.stockItem.upsert({
        where: {
          product_id_warehouse_id: {
            product_id: input.product_id,
            warehouse_id: input.warehouse_id,
          },
        },
        update: { reorder_point: input.reorder_point },
        create: {
          product_id: input.product_id,
          warehouse_id: input.warehouse_id,
          quantity: 0,
          reserved_qty: 0,
          reorder_point: input.reorder_point,
        },
      });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Purchase Orders router
// ─────────────────────────────────────────────────────────────────────────────

const poLineItemInput = z.object({
  product_id: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).max(100).default(0),
});

const purchaseOrdersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const [items, total] = await Promise.all([
        ctx.prisma.purchaseOrder.findMany({
          where: {
            organization_id: orgId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.search
              ? {
                  OR: [
                    { po_number: { contains: input.search, mode: 'insensitive' } },
                    { supplier_name: { contains: input.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            line_items: true,
            _count: { select: { line_items: true } },
          },
          take: input.limit,
          skip: input.offset,
          orderBy: { created_at: 'desc' },
        }),
        ctx.prisma.purchaseOrder.count({
          where: {
            organization_id: orgId,
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
      const po = await ctx.prisma.purchaseOrder.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          line_items: true,
        },
      });
      if (!po) throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      return po;
    }),

  create: protectedProcedure
    .input(
      z.object({
        supplier_name: z.string().min(1, 'Supplier name is required'),
        order_date: z.string(),
        expected_date: z.string().optional(),
        currency: z.string().default('USD'),
        notes: z.string().optional(),
        line_items: z.array(poLineItemInput).min(1, 'At least one line item required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const poNumber = await generatePONumber(ctx.prisma, orgId);

      let subtotal = 0;
      let taxTotal = 0;
      const lineData = input.line_items.map((item) => {
        const lineBase = item.quantity * item.unit_price;
        const tax = lineBase * (item.tax_rate / 100);
        const total = lineBase + tax;
        subtotal += lineBase;
        taxTotal += tax;
        return { ...item, total, description: item.description ?? '' };
      });
      const total = subtotal + taxTotal;

      return ctx.prisma.purchaseOrder.create({
        data: {
          organization_id: orgId,
          po_number: poNumber,
          supplier_name: input.supplier_name,
          status: 'DRAFT',
          order_date: new Date(input.order_date),
          expected_date: input.expected_date ? new Date(input.expected_date) : null,
          currency: input.currency,
          subtotal,
          tax_total: taxTotal,
          total,
          notes: input.notes ?? null,
          line_items: {
            create: lineData,
          },
        },
        include: { line_items: true },
      });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.purchaseOrder.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      return ctx.prisma.purchaseOrder.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  receive: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        warehouse_id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const po = await ctx.prisma.purchaseOrder.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { line_items: true },
      });
      if (!po) throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      if (po.status === 'RECEIVED')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Purchase order already received' });
      if (po.status === 'CANCELLED')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot receive a cancelled PO' });

      // Upsert stock for each line item
      await Promise.all(
        po.line_items.map(async (item) => {
          const existing = await ctx.prisma.stockItem.findFirst({
            where: { product_id: item.product_id, warehouse_id: input.warehouse_id },
          });
          if (existing) {
            await ctx.prisma.stockItem.update({
              where: { id: existing.id },
              data: { quantity: { increment: Number(item.quantity) } },
            });
          } else {
            await ctx.prisma.stockItem.create({
              data: {
                product_id: item.product_id,
                warehouse_id: input.warehouse_id,
                quantity: Number(item.quantity),
                reserved_qty: 0,
              },
            });
          }
        })
      );

      return ctx.prisma.purchaseOrder.update({
        where: { id: input.id },
        data: { status: 'RECEIVED' },
        include: { line_items: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.purchaseOrder.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!existing)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      if (existing.status === 'RECEIVED')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete a received PO' });
      return ctx.prisma.purchaseOrder.delete({ where: { id: input.id } });
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Root inventory router
// ─────────────────────────────────────────────────────────────────────────────

export const inventoryRouter = createTRPCRouter({
  products: productsRouter,
  categories: categoriesRouter,
  warehouses: warehousesRouter,
  stock: stockRouter,
  purchaseOrders: purchaseOrdersRouter,
});
