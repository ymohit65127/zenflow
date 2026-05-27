import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const designationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ department_id: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrDesignation.findMany({
        where: {
          organization_id: orgId,
          is_active: true,
          ...(input?.department_id ? { department_id: input.department_id } : {}),
        },
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { employees: { where: { deleted_at: null } } } },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const d = await ctx.prisma.hrDesignation.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { department: { select: { id: true, name: true } } },
      });
      if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Designation not found' });
      return d;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        level: z.number().int().min(1).default(1),
        grade: z.string().optional(),
        department_id: z.string().optional(),
        min_ctc: z.number().optional(),
        max_ctc: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.hrDesignation.create({
        data: {
          organization_id: orgId,
          name: input.name,
          level: input.level,
          grade: input.grade ?? null,
          department_id: input.department_id ?? null,
          min_ctc: input.min_ctc ?? null,
          max_ctc: input.max_ctc ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        level: z.number().int().min(1).optional(),
        grade: z.string().optional().nullable(),
        department_id: z.string().optional().nullable(),
        min_ctc: z.number().optional().nullable(),
        max_ctc: z.number().optional().nullable(),
        is_active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.hrDesignation.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Designation not found' });
      return ctx.prisma.hrDesignation.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.hrDesignation.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Designation not found' });
      return ctx.prisma.hrDesignation.update({ where: { id: input.id }, data: { is_active: false } });
    }),
});
