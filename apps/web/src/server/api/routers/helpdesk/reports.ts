import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { HdTicketStatus, HdTicketChannel, HdSlaStatus } from '@zenflow/db';

export const reportsRouter = createTRPCRouter({
  volume: protectedProcedure
    .input(z.object({
      from: z.string(),
      to: z.string(),
      group_by: z.enum(['channel', 'category', 'agent', 'status', 'day']).default('day'),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const from = new Date(input.from);
      const to = new Date(input.to);

      if (input.group_by === 'day') {
        const tickets = await ctx.prisma.hdTicket.findMany({
          where: { organization_id: orgId, created_at: { gte: from, lte: to }, deleted_at: null },
          select: { created_at: true, status: true },
          orderBy: { created_at: 'asc' },
        });

        const dayMap = new Map<string, number>();
        for (const t of tickets) {
          const day = t.created_at.toISOString().slice(0, 10);
          dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
        }

        return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
      }

      if (input.group_by === 'status') {
        const statuses: HdTicketStatus[] = ['open', 'pending', 'on_hold', 'resolved', 'closed', 'new'];
        const counts = await Promise.all(
          statuses.map(async (s) => ({
            label: s,
            count: await ctx.prisma.hdTicket.count({ where: { organization_id: orgId, status: s, created_at: { gte: from, lte: to }, deleted_at: null } }),
          })),
        );
        return counts;
      }

      if (input.group_by === 'channel') {
        const channels: HdTicketChannel[] = ['email', 'web', 'chat', 'phone', 'api', 'social'];
        const counts = await Promise.all(
          channels.map(async (c) => ({
            label: c,
            count: await ctx.prisma.hdTicket.count({ where: { organization_id: orgId, channel: c, created_at: { gte: from, lte: to }, deleted_at: null } }),
          })),
        );
        return counts.filter((c) => c.count > 0);
      }

      return [];
    }),

  avgFirstResponseTime: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), team_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const tickets = await ctx.prisma.hdTicket.findMany({
        where: {
          organization_id: orgId,
          created_at: { gte: new Date(input.from), lte: new Date(input.to) },
          first_response_at: { not: null },
          deleted_at: null,
          ...(input.team_id ? { team_id: input.team_id } : {}),
        },
        select: { created_at: true, first_response_at: true },
      });

      if (!tickets.length) return { avg_hours: 0, count: 0 };

      const totalMs = tickets.reduce((sum, t) => {
        if (!t.first_response_at) return sum;
        return sum + (t.first_response_at.getTime() - t.created_at.getTime());
      }, 0);

      return {
        avg_hours: Math.round((totalMs / tickets.length / 3_600_000) * 10) / 10,
        count: tickets.length,
      };
    }),

  avgResolutionTime: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), team_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const tickets = await ctx.prisma.hdTicket.findMany({
        where: {
          organization_id: orgId,
          created_at: { gte: new Date(input.from), lte: new Date(input.to) },
          resolved_at: { not: null },
          deleted_at: null,
          ...(input.team_id ? { team_id: input.team_id } : {}),
        },
        select: { created_at: true, resolved_at: true },
      });

      if (!tickets.length) return { avg_hours: 0, count: 0 };

      const totalMs = tickets.reduce((sum, t) => {
        if (!t.resolved_at) return sum;
        return sum + (t.resolved_at.getTime() - t.created_at.getTime());
      }, 0);

      return {
        avg_hours: Math.round((totalMs / tickets.length / 3_600_000) * 10) / 10,
        count: tickets.length,
      };
    }),

  slaCompliance: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), team_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const where = {
        organization_id: orgId,
        created_at: { gte: new Date(input.from), lte: new Date(input.to) },
        deleted_at: null,
        ...(input.team_id ? { team_id: input.team_id } : {}),
      };

      const tickets = await ctx.prisma.hdTicket.findMany({
        where,
        select: { priority: true, sla_status: true, first_response_at: true, resolved_at: true },
      });

      const total = tickets.length;
      const compliant = tickets.filter((t) => t.sla_status === 'active' || t.sla_status === 'completed').length;
      const breached = tickets.filter((t) => t.sla_status === 'breached').length;

      const byPriority = ['low', 'medium', 'high', 'urgent'].map((pri) => {
        const group = tickets.filter((t) => t.priority.toLowerCase() === pri);
        const groupCompliant = group.filter((t) => t.sla_status === 'active' || t.sla_status === 'completed').length;
        return {
          priority: pri,
          total: group.length,
          compliant: groupCompliant,
          pct: group.length > 0 ? Math.round((groupCompliant / group.length) * 100) : 0,
        };
      });

      return {
        total,
        compliant,
        breached,
        compliance_pct: total > 0 ? Math.round((compliant / total) * 100) : 0,
        by_priority: byPriority,
      };
    }),

  agentPerformance: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const tickets = await ctx.prisma.hdTicket.findMany({
        where: {
          organization_id: orgId,
          created_at: { gte: new Date(input.from), lte: new Date(input.to) },
          assignee_id: { not: null },
          deleted_at: null,
        },
        select: {
          assignee_id: true,
          status: true,
          resolved_at: true,
          created_at: true,
          first_response_at: true,
        },
      });

      const agentMap = new Map<string, {
        assigned: number;
        resolved: number;
        totalResolutionMs: number;
        totalResponseMs: number;
      }>();

      for (const t of tickets) {
        if (!t.assignee_id) continue;
        const entry = agentMap.get(t.assignee_id) ?? { assigned: 0, resolved: 0, totalResolutionMs: 0, totalResponseMs: 0 };
        entry.assigned++;
        if (t.status === 'resolved' && t.resolved_at) {
          entry.resolved++;
          entry.totalResolutionMs += t.resolved_at.getTime() - t.created_at.getTime();
        }
        if (t.first_response_at) {
          entry.totalResponseMs += t.first_response_at.getTime() - t.created_at.getTime();
        }
        agentMap.set(t.assignee_id, entry);
      }

      return Array.from(agentMap.entries()).map(([agent_id, data]) => ({
        agent_id,
        assigned_count: data.assigned,
        resolved_count: data.resolved,
        avg_resolution_hours: data.resolved > 0 ? Math.round((data.totalResolutionMs / data.resolved / 3_600_000) * 10) / 10 : 0,
        avg_response_hours: data.assigned > 0 ? Math.round((data.totalResponseMs / data.assigned / 3_600_000) * 10) / 10 : 0,
        avg_csat: null as number | null,
      })).sort((a, b) => b.resolved_count - a.resolved_count);
    }),

  csat: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), agent_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      // Satisfaction data lives in HdSatisfactionSurvey
      const surveys = await ctx.prisma.hdSatisfactionSurvey.findMany({
        where: {
          ticket: {
            organization_id: orgId,
            ...(input.agent_id ? { assignee_id: input.agent_id } : {}),
          },
          submitted_at: { gte: new Date(input.from), lte: new Date(input.to) },
        },
        select: { rating: true, submitted_at: true },
        orderBy: { submitted_at: 'asc' },
      });

      const avgScore = surveys.length > 0
        ? Math.round((surveys.reduce((s, t) => s + t.rating, 0) / surveys.length) * 10) / 10
        : null;

      const dayMap = new Map<string, { sum: number; count: number }>();
      for (const t of surveys) {
        const day = t.submitted_at.toISOString().slice(0, 10);
        const existing = dayMap.get(day) ?? { sum: 0, count: 0 };
        existing.sum += t.rating;
        existing.count++;
        dayMap.set(day, existing);
      }

      const trend = Array.from(dayMap.entries()).map(([date, d]) => ({
        date,
        avg: Math.round((d.sum / d.count) * 10) / 10,
        count: d.count,
      }));

      return {
        surveyed: surveys.length,
        responded: surveys.length,
        response_rate_pct: 100,
        avg_score: avgScore,
        trend,
      };
    }),

  overview: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const from = new Date(input.from);
      const to = new Date(input.to);

      const openStatuses: HdTicketStatus[] = ['open', 'pending', 'on_hold', 'new'];
      const resolvedStatus: HdTicketStatus = 'resolved';
      const breachedSlaStatus: HdSlaStatus = 'breached';

      const [total, open, resolved, slaBreached] = await Promise.all([
        ctx.prisma.hdTicket.count({ where: { organization_id: orgId, created_at: { gte: from, lte: to }, deleted_at: null } }),
        ctx.prisma.hdTicket.count({ where: { organization_id: orgId, created_at: { gte: from, lte: to }, status: { in: openStatuses }, deleted_at: null } }),
        ctx.prisma.hdTicket.count({ where: { organization_id: orgId, created_at: { gte: from, lte: to }, status: resolvedStatus, deleted_at: null } }),
        ctx.prisma.hdTicket.count({ where: { organization_id: orgId, created_at: { gte: from, lte: to }, sla_status: breachedSlaStatus, deleted_at: null } }),
      ]);

      return { total, open, resolved, sla_breached: slaBreached };
    }),
});
