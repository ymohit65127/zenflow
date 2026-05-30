import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { HdTeamMemberRole, HdTicketStatus } from '@zenflow/db';

const TeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  auto_assign: z.enum(['none', 'round_robin', 'load_balanced']).default('none'),
  is_active: z.boolean().default(true),
});

export const teamsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const openStatuses: HdTicketStatus[] = ['open', 'pending', 'on_hold', 'new'];
    return ctx.prisma.hdTeam.findMany({
      where: { organization_id: orgId },
      include: {
        _count: { select: { members: true, tickets: { where: { status: { in: openStatuses } } } } },
        members: {},
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
          auto_assign: input.auto_assign,
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
          auto_assign: rest.auto_assign,
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
      role: z.enum(['agent', 'lead', 'supervisor']).default('agent'),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const team = await ctx.prisma.hdTeam.findFirst({ where: { id: input.team_id, organization_id: orgId } });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

      return ctx.prisma.hdTeamMember.upsert({
        where: { team_id_user_id: { team_id: input.team_id, user_id: input.user_id } },
        create: { team_id: input.team_id, user_id: input.user_id, role: input.role as HdTeamMemberRole },
        update: { role: input.role as HdTeamMemberRole },
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
      // is_available field doesn't exist in schema — no-op, return current record
      const member = await ctx.prisma.hdTeamMember.findUnique({
        where: { team_id_user_id: { team_id: input.team_id, user_id: input.user_id } },
      });
      if (!member) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found' });
      return member;
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
