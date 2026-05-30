import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

function getWorkingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(count, 1);
}

export const sprintsV2Router = createTRPCRouter({
  getVelocityData: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        lastNSprints: z.number().int().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const sprints = await ctx.prisma.sprint.findMany({
        where: {
          project_id: input.projectId,
          status: 'COMPLETED',
        },
        orderBy: { end_date: 'desc' },
        take: input.lastNSprints,
      });

      // Load task counts separately
      const sprintIds = sprints.map((s) => s.id);
      const taskCounts = await ctx.prisma.task.groupBy({
        by: ['sprint_id'],
        where: { sprint_id: { in: sprintIds } },
        _count: { id: true },
      });
      const countBySprintId = Object.fromEntries(
        taskCounts.map((tc) => [tc.sprint_id, tc._count.id])
      );

      const sprintsAsc = [...sprints].reverse();

      // Rolling 3-sprint average using velocity field
      const withRolling = sprintsAsc.map((s, i) => {
        const window = sprintsAsc.slice(Math.max(0, i - 2), i + 1);
        const rollingAvg =
          window.reduce((sum, w) => sum + (w.velocity ?? 0), 0) / window.length;
        return {
          id: s.id,
          name: s.name,
          startDate: s.start_date,
          endDate: s.end_date,
          velocityActual: s.velocity ?? 0,
          velocityTarget: s.velocity ?? 0,
          completedPoints: 0,
          taskCount: countBySprintId[s.id] ?? 0,
          rollingAvg: Math.round(rollingAvg),
        };
      });

      return withRolling;
    }),

  getBurndownData: protectedProcedure
    .input(z.object({ sprintId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const sprint = await ctx.prisma.sprint.findFirst({
        where: {
          id: input.sprintId,
          project: { organization_id: orgId },
        },
      });
      if (!sprint) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' });

      const tasks = await ctx.prisma.task.findMany({
        where: { sprint_id: input.sprintId, deleted_at: null },
        select: {
          id: true,
          story_points: true,
          estimated_hours: true,
          completed_at: true,
          created_at: true,
        },
      });

      const totalPoints = tasks.reduce(
        (sum, t) => sum + (t.story_points ?? 0),
        0
      );
      const totalHours = tasks.reduce(
        (sum, t) => sum + Number(t.estimated_hours ?? 0),
        0
      );

      const sprintStart = sprint.start_date ?? new Date();
      const sprintEnd = sprint.end_date ?? new Date();
      const today = new Date();
      const chartEnd = today < sprintEnd ? today : sprintEnd;

      const workingDays = getWorkingDaysBetween(sprintStart, sprintEnd);
      const idealDecreasePerDay = workingDays > 0 ? totalPoints / workingDays : 0;

      // Build daily data
      const idealLine: Array<{ date: string; points: number }> = [];
      const actualLine: Array<{ date: string; points: number }> = [];

      let dayIndex = 0;
      const d = new Date(sprintStart);
      while (d <= chartEnd) {
        const dayStr = d.toISOString().split('T')[0] as string;
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Ideal: linear decrease
          idealLine.push({
            date: dayStr,
            points: Math.max(0, totalPoints - dayIndex * idealDecreasePerDay),
          });

          // Actual: remaining points as of end of this day
          const endOfDay = new Date(d);
          endOfDay.setHours(23, 59, 59, 999);
          const remaining = tasks
            .filter((t) => !t.completed_at || t.completed_at > endOfDay)
            .reduce((sum, t) => sum + (t.story_points ?? 0), 0);

          actualLine.push({ date: dayStr, points: remaining });
          dayIndex++;
        }

        d.setDate(d.getDate() + 1);
      }

      // Scope changes: tasks added after sprint started
      const scopeChanges = tasks
        .filter((t) => t.created_at > sprintStart)
        .reduce<Record<string, number>>((acc, t) => {
          const dateKey = t.created_at.toISOString().split('T')[0] as string;
          acc[dateKey] = (acc[dateKey] ?? 0) + (t.story_points ?? 0);
          return acc;
        }, {});

      return {
        sprintName: sprint.name,
        startDate: sprintStart,
        endDate: sprintEnd,
        totalPoints,
        totalHours,
        completedPoints: 0,
        idealLine,
        actualLine,
        scopeChanges: Object.entries(scopeChanges).map(([date, points]) => ({
          date,
          points,
        })),
      };
    }),

  getCapacityData: protectedProcedure
    .input(z.object({ sprintId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const sprint = await ctx.prisma.sprint.findFirst({
        where: {
          id: input.sprintId,
          project: { organization_id: orgId },
        },
      });
      if (!sprint) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' });

      const tasks = await ctx.prisma.task.findMany({
        where: { sprint_id: input.sprintId, deleted_at: null },
        include: {
          assignments: {
            include: { user: { select: { id: true, name: true, avatar_url: true } } },
          },
        },
      });

      // Group by assignee
      const byUser = new Map<
        string,
        {
          user: { id: string; name: string; avatar_url: string | null };
          estimatedHours: number;
          completedHours: number;
          taskCount: number;
        }
      >();

      for (const task of tasks) {
        for (const a of task.assignments) {
          const existing = byUser.get(a.user_id) ?? {
            user: { id: a.user.id, name: a.user.name, avatar_url: (a.user as { avatar_url?: string | null }).avatar_url ?? null },
            estimatedHours: 0,
            completedHours: 0,
            taskCount: 0,
          };
          existing.estimatedHours += Number(task.estimated_hours ?? 0);
          existing.completedHours += task.completed_at ? Number(task.actual_hours ?? 0) : 0;
          existing.taskCount += 1;
          byUser.set(a.user_id, existing);
        }
      }

      return {
        sprintName: sprint.name,
        capacityHours: null as number | null,
        velocityTarget: sprint.velocity ?? null,
        members: Array.from(byUser.values()),
      };
    }),
});
