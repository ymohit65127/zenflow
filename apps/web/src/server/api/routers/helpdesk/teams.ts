// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const TeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  email: z.string().email().optional(),
  auto_assign: z.enum(['none', 'round_robin', 'load_balanced']).default('none'),
  business_hours_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const teamsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    return ctx.prisma.hdTeam.findMany({
      where: { organization_id: orgId },
      include: {
        _count: { select: { members: true, tickets: { where: { status: { in: ['open', 'in_progress', 'pending'] } } } } },
        members: {
          include: { /* user would be referenced but not in schema yet */ },
        },
      },
      orderBy: { name: 'asc' },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const team = await ctx.prisma.hdTeam.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          members: true,
          business_hours: true,
          _count: { select: { tickets: true } },
        },
      });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
      return team;
    }),

  create: protectedProcedure
    .input(TeamSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.hdTeam.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          email: input.email ?? null,
          auto_assign: input.auto_assign,
          business_hours_id: input.business_hours_id ?? null,
          is_active: input.is_active,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(TeamSchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;
      const existing = await ctx.prisma.hdTeam.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

      return ctx.prisma.hdTeam.update({
        where: { id },
        data: {
          name: rest.name,
          description: rest.description ?? null,
          email: rest.email ?? null,
          auto_assign: rest.auto_assign,
          business_hours_id: rest.business_hours_id ?? null,
          is_active: rest.is_active,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdTeam.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
      return ctx.prisma.hdTeam.delete({ where: { id: input.id } });
    }),

  addMember: protectedProcedure
    .input(z.object({
      team_id: z.string(),
      user_id: z.string(),
      role: z.enum(['member', 'lead']).default('member'),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const team = await ctx.prisma.hdTeam.findFirst({ where: { id: input.team_id, organization_id: orgId } });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

      return ctx.prisma.hdTeamMember.upsert({
        where: { team_id_user_id: { team_id: input.team_id, user_id: input.user_id } },
        create: { team_id: input.team_id, user_id: input.user_id, role: input.role },
        update: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ team_id: z.string(), user_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const team = await ctx.prisma.hdTeam.findFirst({ where: { id: input.team_id, organization_id: orgId } });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

      return ctx.prisma.hdTeamMember.delete({
        where: { team_id_user_id: { team_id: input.team_id, user_id: input.user_id } },
      });
    }),

  setAvailability: protectedProcedure
    .input(z.object({ team_id: z.string(), user_id: z.string(), is_available: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.hdTeamMember.update({
        where: { team_id_user_id: { team_id: input.team_id, user_id: input.user_id } },
        data: { is_available: input.is_available },
      });
    }),

  listMembers: protectedProcedure
    .input(z.object({ team_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const team = await ctx.prisma.hdTeam.findFirst({ where: { id: input.team_id, organization_id: orgId } });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

      return ctx.prisma.hdTeamMember.findMany({
        where: { team_id: input.team_id },
        orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
      });
    }),
});
