import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

const OptionSourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  query_mode: z.enum(['structured']).default('structured'),
  source_table: z.string().max(100).optional(),
  source_column: z.string().max(100).optional(),
  value_column: z.string().max(100).optional(),
  where_clause: z.string().optional(),
  order_by: z.string().max(150).optional(),
  raw_sql: z.string().optional(),
  apply_distinct: z.boolean().default(true),
  row_limit: z.number().int().min(1).max(5000).optional(),
  label_template: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const optionSourcesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (ctx.prisma as any).formOptionSource.findMany({
      where: { organization_id: orgId, deleted_at: null, is_active: true },
      orderBy: { name: 'asc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const source = await (ctx.prisma as any).formOptionSource.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!source) throw new TRPCError({ code: 'NOT_FOUND' });
      return source;
    }),

  create: protectedProcedure
    .input(OptionSourceSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const userId = ctx.session.user.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formOptionSource.create({
        data: {
          ...input,
          organization_id: orgId,
          created_by: userId,
          description: input.description ?? null,
          source_table: input.source_table ?? null,
          source_column: input.source_column ?? null,
          value_column: input.value_column ?? null,
          where_clause: input.where_clause ?? null,
          order_by: input.order_by ?? null,
          raw_sql: input.raw_sql ?? null,
          row_limit: input.row_limit ?? null,
          label_template: input.label_template ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(OptionSourceSchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (ctx.prisma as any).formOptionSource.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formOptionSource.update({
        where: { id },
        data: {
          ...data,
          description: data.description ?? null,
          source_table: data.source_table ?? null,
          source_column: data.source_column ?? null,
          value_column: data.value_column ?? null,
          where_clause: data.where_clause ?? null,
          order_by: data.order_by ?? null,
          raw_sql: data.raw_sql ?? null,
          row_limit: data.row_limit ?? null,
          label_template: data.label_template ?? null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (ctx.prisma as any).formOptionSource.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formOptionSource.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  /** Execute the query and return first 20 rows as label/value preview. */
  preview: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const source = await (ctx.prisma as any).formOptionSource.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!source) throw new TRPCError({ code: 'NOT_FOUND' });

      let rows: Record<string, unknown>[];
      try {
        if (source.query_mode === 'raw') {
          // Raw SQL mode is disabled for security reasons — prevents SQL injection and cross-tenant data access
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Raw SQL option sources are disabled. Use structured mode instead.',
          });
        } else {
          if (!source.source_table || !source.source_column) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'source_table and source_column are required for structured mode' });
          }

          // Allowlist of tables that can be used as option sources
          const ALLOWED_TABLES = ['crm_contacts', 'crm_accounts', 'crm_deals', 'hr_employees',
            'inv_products', 'crm_territories', 'hr_departments', 'hr_designations'] as const;

          // Sanitize identifier — only allow alphanumeric and underscore
          const sanitizeIdentifier = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '');

          const table = sanitizeIdentifier(source.source_table as string);
          const valueCol = sanitizeIdentifier(source.value_column as string || 'id');
          const labelCol = sanitizeIdentifier(source.source_column as string || 'name');

          if (!ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `Table '${table}' is not allowed as an option source.` });
          }

          // Use Prisma.sql for safe parameterization — DO NOT use string interpolation for values
          const orgFilter = Prisma.sql`organization_id = ${orgId}`;
          const limitClause = Prisma.sql`LIMIT 20`;

          rows = await ctx.prisma.$queryRaw(
            Prisma.sql`SELECT ${Prisma.raw(valueCol)} as value, ${Prisma.raw(labelCol)} as label
                       FROM ${Prisma.raw(table)}
                       WHERE ${orgFilter} AND deleted_at IS NULL
                       ${limitClause}`
          ) as Record<string, unknown>[];
        }
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }

      return rows.slice(0, 20).map((row) => ({
        label: source.label_template
          ? (source.label_template as string).replace(/\{(\w+)\}/g, (_: string, k: string) => String(row[k] ?? ''))
          : String(row['label'] ?? ''),
        value: String(row['value'] ?? ''),
        _raw: row,
      }));
    }),
});
