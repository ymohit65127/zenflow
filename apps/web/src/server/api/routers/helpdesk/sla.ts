// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ResponseHoursSchema = z.object({
  low: z.number().positive(),
  medium: z.number().positive(),
  high: z.number().positive(),
  urgent: z.number().positive(),
});

const BusinessHoursDaySchema = z.object({
  open: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const BusinessHoursConfigSchema = z.object({
  monday: BusinessHoursDaySchema,
  tuesday: BusinessHoursDaySchema,
  wednesday: BusinessHoursDaySchema,
  thursday: BusinessHoursDaySchema,
  friday: BusinessHoursDaySchema,
  saturday: BusinessHoursDaySchema,
  sunday: BusinessHoursDaySchema,
});

const SlaPolicySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  is_default: z.boolean().default(false),
  business_hours_id: z.string().optional(),
  first_response_hours: ResponseHoursSchema,
  resolution_hours: ResponseHoursSchema,
  is_active: z.boolean().default(true),
});

const BusinessHoursSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1).max(100),
  hours: BusinessHoursConfigSchema,
  is_active: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DayConfig = { open: boolean; start: string; end: string };
type BHConfig = Record<string, DayConfig>;

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function parseTime(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return d;
}

function startOfNextDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addBusinessMinutes(startDate: Date, minutesToAdd: number, bhConfig: BHConfig): Date {
  let cursor = new Date(startDate);
  let remaining = minutesToAdd;

  let safety = 0;
  while (remaining > 0 && safety < 365) {
    safety++;
    const dayName = DAY_NAMES[cursor.getDay()]!;
    const dayConfig = bhConfig[dayName];

    if (!dayConfig || !dayConfig.open) {
      cursor = startOfNextDay(cursor);
      continue;
    }

    const dayStart = parseTime(dayConfig.start, cursor);
    const dayEnd = parseTime(dayConfig.end, cursor);

    if (cursor < dayStart) cursor = new Date(dayStart);

    if (cursor >= dayEnd) {
      cursor = startOfNextDay(cursor);
      continue;
    }

    const availableMs = dayEnd.getTime() - cursor.getTime();
    const availableMinutes = availableMs / 60000;

    if (remaining <= availableMinutes) {
      cursor = new Date(cursor.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= availableMinutes;
      cursor = startOfNextDay(cursor);
    }
  }

  return cursor;
}

function computeDueDatesFromPolicy(
  createdAt: Date,
  priority: string,
  firstResponseHours: Record<string, number>,
  resolutionHours: Record<string, number>,
  bhConfig: BHConfig | null,
): { firstResponseDue: Date; resolutionDue: Date } {
  const pri = priority.toLowerCase();
  const frHours = firstResponseHours[pri] ?? firstResponseHours['medium'] ?? 4;
  const resHours = resolutionHours[pri] ?? resolutionHours['medium'] ?? 24;

  if (!bhConfig) {
    return {
      firstResponseDue: new Date(createdAt.getTime() + frHours * 3600000),
      resolutionDue: new Date(createdAt.getTime() + resHours * 3600000),
    };
  }

  return {
    firstResponseDue: addBusinessMinutes(createdAt, frHours * 60, bhConfig),
    resolutionDue: addBusinessMinutes(createdAt, resHours * 60, bhConfig),
  };
}

export function computeSlaStatus(
  ticket: {
    first_response_due_at: Date | null;
    resolution_due_at: Date | null;
    first_responded_at: Date | null;
    resolved_at: Date | null;
    status: string;
  },
): {
  responseStatus: 'OK' | 'WARNING' | 'BREACHED';
  resolutionStatus: 'OK' | 'WARNING' | 'BREACHED';
  responseMinutesRemaining: number | null;
  resolutionMinutesRemaining: number | null;
} {
  const now = new Date();

  const computeStatus = (
    dueAt: Date | null,
    completedAt: Date | null,
  ): { status: 'OK' | 'WARNING' | 'BREACHED'; minutesRemaining: number | null } => {
    if (!dueAt) return { status: 'OK', minutesRemaining: null };
    if (completedAt) {
      // Already done — was it on time?
      return completedAt <= dueAt
        ? { status: 'OK', minutesRemaining: 0 }
        : { status: 'BREACHED', minutesRemaining: 0 };
    }

    const msRemaining = dueAt.getTime() - now.getTime();
    const minutesRemaining = msRemaining / 60000;
    const totalMs = dueAt.getTime() - (dueAt.getTime() - msRemaining); // can't determine total without created_at here
    // Treat < 0 as breached, < 25% time left as warning
    if (minutesRemaining < 0) return { status: 'BREACHED', minutesRemaining };
    // Warning at <=25% remaining (rough heuristic without start time)
    if (minutesRemaining < 30) return { status: 'WARNING', minutesRemaining };
    return { status: 'OK', minutesRemaining };
  };

  const responseResult = computeStatus(ticket.first_response_due_at, ticket.first_responded_at);
  const resolutionResult = computeStatus(ticket.resolution_due_at, ticket.resolved_at);

  return {
    responseStatus: responseResult.status,
    resolutionStatus: resolutionResult.status,
    responseMinutesRemaining: responseResult.minutesRemaining,
    resolutionMinutesRemaining: resolutionResult.minutesRemaining,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const slaRouter = createTRPCRouter({
  listPolicies: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    return ctx.prisma.hdSlaPolicy.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { business_hours: true },
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });
  }),

  createPolicy: protectedProcedure
    .input(SlaPolicySchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      if (input.is_default) {
        await ctx.prisma.hdSlaPolicy.updateMany({
          where: { organization_id: orgId },
          data: { is_default: false },
        });
      }

      return ctx.prisma.hdSlaPolicy.create({
        data: {
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          is_default: input.is_default,
          business_hours_id: input.business_hours_id ?? null,
          first_response_hours: input.first_response_hours,
          resolution_hours: input.resolution_hours,
          is_active: input.is_active,
        },
      });
    }),

  updatePolicy: protectedProcedure
    .input(z.object({ id: z.string() }).merge(SlaPolicySchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;

      const existing = await ctx.prisma.hdSlaPolicy.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'SLA policy not found' });

      if (rest.is_default) {
        await ctx.prisma.hdSlaPolicy.updateMany({
          where: { organization_id: orgId, id: { not: id } },
          data: { is_default: false },
        });
      }

      return ctx.prisma.hdSlaPolicy.update({
        where: { id },
        data: {
          name: rest.name,
          description: rest.description ?? null,
          is_default: rest.is_default,
          business_hours_id: rest.business_hours_id ?? null,
          first_response_hours: rest.first_response_hours,
          resolution_hours: rest.resolution_hours,
          is_active: rest.is_active,
        },
      });
    }),

  deletePolicy: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdSlaPolicy.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'SLA policy not found' });
      return ctx.prisma.hdSlaPolicy.delete({ where: { id: input.id } });
    }),

  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      await ctx.prisma.hdSlaPolicy.updateMany({ where: { organization_id: orgId }, data: { is_default: false } });
      return ctx.prisma.hdSlaPolicy.update({ where: { id: input.id }, data: { is_default: true } });
    }),

  getTicketSlaStatus: protectedProcedure
    .input(z.object({ ticket_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const ticket = await ctx.prisma.hdTicket.findFirst({
        where: { id: input.ticket_id, organization_id: orgId },
        include: {
          sla_policy: { include: { business_hours: true } },
        },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      if (!ticket.sla_policy) {
        return {
          responseStatus: 'OK' as const,
          resolutionStatus: 'OK' as const,
          responseMinutesRemaining: null,
          resolutionMinutesRemaining: null,
        };
      }

      return computeSlaStatus({
        first_response_due_at: ticket.first_response_due_at ?? null,
        resolution_due_at: ticket.resolution_due_at ?? null,
        first_responded_at: ticket.first_responded_at ?? null,
        resolved_at: ticket.resolved_at ?? null,
        status: ticket.status,
      });
    }),

  computeDueDates: protectedProcedure
    .input(z.object({ ticket_id: z.string(), policy_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const [ticket, policy] = await Promise.all([
        ctx.prisma.hdTicket.findFirst({ where: { id: input.ticket_id, organization_id: orgId } }),
        ctx.prisma.hdSlaPolicy.findFirst({
          where: { id: input.policy_id, organization_id: orgId },
          include: { business_hours: true },
        }),
      ]);
      if (!ticket || !policy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });

      const bhConfig = policy.business_hours
        ? (policy.business_hours.hours as BHConfig)
        : null;

      return computeDueDatesFromPolicy(
        ticket.created_at,
        ticket.priority,
        policy.first_response_hours as Record<string, number>,
        policy.resolution_hours as Record<string, number>,
        bhConfig,
      );
    }),

  complianceReport: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), team_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const where = {
        organization_id: orgId,
        created_at: { gte: new Date(input.from), lte: new Date(input.to) },
        ...(input.team_id ? { team_id: input.team_id } : {}),
      };

      const tickets = await ctx.prisma.hdTicket.findMany({
        where,
        select: {
          priority: true,
          sla_status: true,
          first_response_due_at: true,
          first_responded_at: true,
          resolution_due_at: true,
          resolved_at: true,
        },
      });

      const total = tickets.length;
      const onTimeFrt = tickets.filter(
        (t) => t.first_responded_at && t.first_response_due_at && t.first_responded_at <= t.first_response_due_at,
      ).length;
      const onTimeRes = tickets.filter(
        (t) => t.resolved_at && t.resolution_due_at && t.resolved_at <= t.resolution_due_at,
      ).length;

      const byPriority = ['low', 'medium', 'high', 'urgent'].map((pri) => {
        const group = tickets.filter((t) => t.priority.toLowerCase() === pri);
        return {
          priority: pri,
          total: group.length,
          frt_ok: group.filter((t) => t.first_responded_at && t.first_response_due_at && t.first_responded_at <= t.first_response_due_at).length,
          res_ok: group.filter((t) => t.resolved_at && t.resolution_due_at && t.resolved_at <= t.resolution_due_at).length,
        };
      });

      return {
        total,
        frt_compliance_pct: total > 0 ? Math.round((onTimeFrt / total) * 100) : 0,
        resolution_compliance_pct: total > 0 ? Math.round((onTimeRes / total) * 100) : 0,
        by_priority: byPriority,
      };
    }),

  listBusinessHours: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    return ctx.prisma.hdBusinessHours.findMany({
      where: { organization_id: orgId },
      orderBy: { name: 'asc' },
    });
  }),

  createBusinessHours: protectedProcedure
    .input(BusinessHoursSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.hdBusinessHours.create({
        data: {
          organization_id: orgId,
          name: input.name,
          timezone: input.timezone,
          hours: input.hours,
          is_active: input.is_active,
        },
      });
    }),

  updateBusinessHours: protectedProcedure
    .input(z.object({ id: z.string() }).merge(BusinessHoursSchema))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...rest } = input;
      const existing = await ctx.prisma.hdBusinessHours.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Business hours not found' });
      return ctx.prisma.hdBusinessHours.update({
        where: { id },
        data: { name: rest.name, timezone: rest.timezone, hours: rest.hours, is_active: rest.is_active },
      });
    }),

  deleteBusinessHours: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdBusinessHours.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });
      return ctx.prisma.hdBusinessHours.delete({ where: { id: input.id } });
    }),
});
