// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const ConditionSchema = z.object({
  field: z.enum(['channel', 'priority', 'subject', 'email_domain', 'category_id', 'requester_email', 'tags']),
  operator: z.enum(['is', 'is_not', 'contains', 'matches', 'starts_with']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const ActionSchema = z.object({
  action: z.enum(['assign_team', 'assign_agent', 'set_priority', 'set_category', 'add_tag', 'set_sla']),
  value: z.union([z.string(), z.number()]),
});

const RoutingRuleSchema = z.object({
  name: z.string().min(1).max(200),
  priority: z.number().int().min(0).default(0),
  conditions: z.array(ConditionSchema),
  actions: z.array(ActionSchema),
  is_active: z.boolean().default(true),
});

export const routingRouter = createTRPCRouter({
  listRules: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    return ctx.prisma.hdRoutingRule.findMany({
      where: { organization_id: orgId },
      orderBy: { priority: 'asc' },
    });
  }),

  getRule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const rule = await ctx.prisma.hdRoutingRule.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!rule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Routing rule not found' });
      return rule;
    }),

  createRule: protectedProcedure
    .input(RoutingRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.hdRoutingRule.create({
        data: {
          organization_id: orgId,
          name: input.name,
          priority: input.priority,
          conditions: input.conditions,
          actions: input.actions,
          is_active: input.is_active,
        },
      });
    }),

  updateRule: protectedProcedure
    .input(z.object({ id: z.string() }).merge(RoutingRuleSchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;
      const existing = await ctx.prisma.hdRoutingRule.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Routing rule not found' });

      return ctx.prisma.hdRoutingRule.update({
        where: { id },
        data: {
          name: rest.name,
          priority: rest.priority,
          conditions: rest.conditions,
          actions: rest.actions,
          is_active: rest.is_active,
        },
      });
    }),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdRoutingRule.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Routing rule not found' });
      return ctx.prisma.hdRoutingRule.delete({ where: { id: input.id } });
    }),

  reorderRules: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      await Promise.all(
        input.ids.map((id, index) =>
          ctx.prisma.hdRoutingRule.updateMany({
            where: { id, organization_id: orgId },
            data: { priority: index },
          }),
        ),
      );
      return { success: true };
    }),

  toggleRule: protectedProcedure
    .input(z.object({ id: z.string(), is_active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdRoutingRule.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Routing rule not found' });
      return ctx.prisma.hdRoutingRule.update({ where: { id: input.id }, data: { is_active: input.is_active } });
    }),

  testRule: protectedProcedure
    .input(z.object({
      rule_id: z.string().optional(),
      conditions: z.array(ConditionSchema).optional(),
      sample_ticket: z.object({
        channel: z.string().optional(),
        priority: z.string().optional(),
        subject: z.string().optional(),
        requester_email: z.string().optional(),
        category_id: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      let conditions = input.conditions ?? [];

      if (input.rule_id) {
        const rule = await ctx.prisma.hdRoutingRule.findFirst({ where: { id: input.rule_id, organization_id: orgId } });
        if (rule) conditions = rule.conditions as typeof conditions;
      }

      const ticket = input.sample_ticket;

      const getField = (field: string) => {
        switch (field) {
          case 'channel': return ticket.channel ?? '';
          case 'priority': return ticket.priority ?? '';
          case 'subject': return ticket.subject ?? '';
          case 'requester_email': return ticket.requester_email ?? '';
          case 'email_domain': return ticket.requester_email?.split('@')[1] ?? '';
          case 'category_id': return ticket.category_id ?? '';
          case 'tags': return (ticket.tags ?? []).join(',');
          default: return '';
        }
      };

      const matched = conditions.every((cond) => {
        const val = getField(cond.field);
        const cv = String(cond.value);
        switch (cond.operator) {
          case 'is': return val.toLowerCase() === cv.toLowerCase();
          case 'is_not': return val.toLowerCase() !== cv.toLowerCase();
          case 'contains': return val.toLowerCase().includes(cv.toLowerCase());
          case 'matches': { try { return new RegExp(cv, 'i').test(val); } catch { return false; } }
          case 'starts_with': return val.toLowerCase().startsWith(cv.toLowerCase());
          default: return false;
        }
      });

      return { matched, conditions_evaluated: conditions.length };
    }),
});
