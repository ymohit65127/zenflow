import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const OptionSourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  query_mode: z.enum(['structured', 'raw']).default('structured'),
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
        if (source.query_mode === 'raw' && source.raw_sql) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = (await ctx.prisma.$queryRawUnsafe(source.raw_sql as string)) as Record<string, unknown>[];
        } else {
          if (!source.source_table || !source.source_column) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'source_table and source_column are required for structured mode' });
          }
          const cols = [source.source_column, source.value_column]
            .filter(Boolean)
            .join(', ');
          const distinct = source.apply_distinct ? 'DISTINCT' : '';
          const where = source.where_clause ? `WHERE ${source.where_clause as string}` : '';
          const orderBy = source.order_by ? `ORDER BY ${source.order_by as string}` : '';
          const limit = `LIMIT 20`;
          const sql = `SELECT ${distinct} ${cols} FROM ${source.source_table as string} ${where} ${orderBy} ${limit}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = (await ctx.prisma.$queryRawUnsafe(sql)) as Record<string, unknown>[];
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
          : String(row[source.source_column as string] ?? ''),
        value: String(row[(source.value_column ?? source.source_column) as string] ?? ''),
        _raw: row,
      }));
    }),
});
