// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const EmailInboxSchema = z.object({
  name: z.string().min(1).max(100),
  email_address: z.string().email(),
  provider: z.enum(['gmail', 'outlook', 'other']).default('other'),
  team_id: z.string().optional(),
  default_priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  is_active: z.boolean().default(true),
});

export const emailInboxRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    return ctx.prisma.hdEmailInbox.findMany({
      where: { organization_id: orgId },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const inbox = await ctx.prisma.hdEmailInbox.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: { team: true },
      });
      if (!inbox) throw new TRPCError({ code: 'NOT_FOUND', message: 'Email inbox not found' });
      return inbox;
    }),

  create: protectedProcedure
    .input(EmailInboxSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const existing = await ctx.prisma.hdEmailInbox.findFirst({
        where: { email_address: input.email_address },
      });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Email address already connected' });

      return ctx.prisma.hdEmailInbox.create({
        data: {
          organization_id: orgId,
          name: input.name,
          email_address: input.email_address,
          provider: input.provider,
          team_id: input.team_id ?? null,
          default_priority: input.default_priority,
          is_active: input.is_active,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(EmailInboxSchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;
      const existing = await ctx.prisma.hdEmailInbox.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Email inbox not found' });

      return ctx.prisma.hdEmailInbox.update({
        where: { id },
        data: {
          name: rest.name,
          provider: rest.provider,
          team_id: rest.team_id ?? null,
          default_priority: rest.default_priority,
          is_active: rest.is_active,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdEmailInbox.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Email inbox not found' });
      return ctx.prisma.hdEmailInbox.delete({ where: { id: input.id } });
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.string(), is_active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdEmailInbox.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Email inbox not found' });
      return ctx.prisma.hdEmailInbox.update({ where: { id: input.id }, data: { is_active: input.is_active } });
    }),
});
