// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const TRIGGER_EVENTS = [
  'ticket_created',
  'reply_received',
  'status_changed',
  'assigned',
  'idle_n_hours',
  'sla_breached',
  'resolved',
] as const;

const ConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['is', 'is_not', 'contains', 'matches', 'starts_with']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const ActionSchema = z.object({
  action: z.string(),
  value: z.union([z.string(), z.number(), z.record(z.unknown())]).optional(),
});

const AutomationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  trigger_event: z.enum(TRIGGER_EVENTS),
  trigger_config: z.record(z.unknown()).optional(),
  conditions: z.array(ConditionSchema).optional(),
  actions: z.array(ActionSchema).optional(),
  is_active: z.boolean().default(true),
});

export const automationRouter = createTRPCRouter({
  listRules: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    return ctx.prisma.hdAutomationRule.findMany({
      where: { organization_id: orgId },
      orderBy: [{ trigger_event: 'asc' }, { name: 'asc' }],
    });
  }),

  getRule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const rule = await ctx.prisma.hdAutomationRule.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!rule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Automation rule not found' });
      return rule;
    }),

  createRule: protectedProcedure
    .input(AutomationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.hdAutomationRule.create({
        data: {
          organization_id: orgId,
          name: input.name,
          trigger_event: input.trigger_event,
          trigger_config: input.trigger_config ?? null,
          conditions: input.conditions ?? null,
          actions: input.actions ?? null,
          is_active: input.is_active,
        },
      });
    }),

  updateRule: protectedProcedure
    .input(z.object({ id: z.string() }).merge(AutomationRuleSchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;
      const existing = await ctx.prisma.hdAutomationRule.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Automation rule not found' });

      return ctx.prisma.hdAutomationRule.update({
        where: { id },
        data: {
          name: rest.name,
          trigger_event: rest.trigger_event,
          trigger_config: rest.trigger_config ?? null,
          conditions: rest.conditions ?? null,
          actions: rest.actions ?? null,
          is_active: rest.is_active,
        },
      });
    }),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdAutomationRule.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Automation rule not found' });
      return ctx.prisma.hdAutomationRule.delete({ where: { id: input.id } });
    }),

  toggleRule: protectedProcedure
    .input(z.object({ id: z.string(), is_active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdAutomationRule.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Automation rule not found' });
      return ctx.prisma.hdAutomationRule.update({ where: { id: input.id }, data: { is_active: input.is_active } });
    }),

  // Summary stats per rule
  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const rules = await ctx.prisma.hdAutomationRule.findMany({
      where: { organization_id: orgId },
      select: { id: true, name: true, trigger_event: true, run_count: true, last_run_at: true, is_active: true },
      orderBy: { run_count: 'desc' },
    });
    return rules;
  }),
});
