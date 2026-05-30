import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { type Prisma } from '@zenflow/db';

interface GanttTaskNode {
  id: string;
  start_date: Date | null;
  due_date: Date | null;
  estimate_hours: number;
  dependencies: Array<{
    depends_on_id: string;
    dependency_type: string;
    lag_days: number;
  }>;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// Topological sort using Kahn's algorithm
function topologicalSort(tasks: GanttTaskNode[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>(); // task_id -> list of tasks that depend on it

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
    if (!adj.has(t.id)) adj.set(t.id, []);
    for (const dep of t.dependencies) {
      adj.set(dep.depends_on_id, [
        ...(adj.get(dep.depends_on_id) ?? []),
        t.id,
      ]);
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return result;
}

function computeCriticalPath(
  tasks: GanttTaskNode[],
  projectStart: Date
): Map<string, { es: Date; ef: Date; ls: Date; lf: Date; float: number; isCritical: boolean }> {
  const taskMap = new Map<string, GanttTaskNode>(tasks.map((t) => [t.id, t]));
  const order = topologicalSort(tasks);

  const earlyDates = new Map<string, { es: Date; ef: Date }>();
  const lateDates = new Map<string, { ls: Date; lf: Date }>();

  // Forward pass
  for (const id of order) {
    const task = taskMap.get(id)!;
    const durationDays = Math.max(1, Math.ceil(task.estimate_hours / 8));
    let es = task.start_date ?? projectStart;

    for (const dep of task.dependencies) {
      const pred = earlyDates.get(dep.depends_on_id);
      if (!pred) continue;
      let candidateStart: Date;
      if (dep.dependency_type === 'finish_to_start') {
        candidateStart = addDays(pred.ef, dep.lag_days);
      } else if (dep.dependency_type === 'start_to_start') {
        candidateStart = addDays(pred.es, dep.lag_days);
      } else {
        candidateStart = addDays(pred.ef, dep.lag_days);
      }
      if (candidateStart > es) es = candidateStart;
    }

    const ef = addDays(es, durationDays);
    earlyDates.set(id, { es, ef });
  }

  // Project end = max EF
  let projectEnd = projectStart;
  for (const { ef } of earlyDates.values()) {
    if (ef > projectEnd) projectEnd = ef;
  }

  // Backward pass
  for (const id of [...order].reverse()) {
    const task = taskMap.get(id)!;
    const durationDays = Math.max(1, Math.ceil(task.estimate_hours / 8));

    // Find successors
    const successors = tasks.filter((t) =>
      t.dependencies.some((d) => d.depends_on_id === id)
    );

    let lf = projectEnd;
    for (const succ of successors) {
      const succLate = lateDates.get(succ.id);
      if (!succLate) continue;
      const dep = succ.dependencies.find((d) => d.depends_on_id === id)!;
      let candidateFinish: Date;
      if (dep.dependency_type === 'finish_to_start') {
        candidateFinish = addDays(succLate.ls, -dep.lag_days);
      } else if (dep.dependency_type === 'start_to_start') {
        candidateFinish = addDays(succLate.ls, durationDays - dep.lag_days);
      } else {
        candidateFinish = addDays(succLate.lf, -dep.lag_days);
      }
      if (candidateFinish < lf) lf = candidateFinish;
    }

    const ls = addDays(lf, -durationDays);
    lateDates.set(id, { ls, lf });
  }

  const result = new Map<string, { es: Date; ef: Date; ls: Date; lf: Date; float: number; isCritical: boolean }>();
  for (const id of order) {
    const early = earlyDates.get(id)!;
    const late = lateDates.get(id)!;
    if (!early || !late) continue;
    const float = daysBetween(early.es, late.ls);
    result.set(id, { ...early, ...late, float, isCritical: float === 0 });
  }

  return result;
}

export const ganttRouter = createTRPCRouter({
  getGanttData: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Load phases and milestones separately
      const phases = await ctx.prisma.projectPhase.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        orderBy: { position: 'asc' },
      });

      const milestones = await ctx.prisma.projectMilestone.findMany({
        where: { project_id: input.projectId, deleted_at: null },
        orderBy: { due_date: 'asc' },
      });

      const taskWhere: Record<string, unknown> = {
        project_id: input.projectId,
        deleted_at: null,
      };
      if (input.dateFrom || input.dateTo) {
        const conditions: Array<Record<string, unknown>> = [];
        if (input.dateFrom) conditions.push({ due_date: { gte: input.dateFrom } });
        if (input.dateTo) conditions.push({ started_at: { lte: input.dateTo } });
        taskWhere['OR'] = conditions;
      }

      const tasks = await ctx.prisma.task.findMany({
        where: taskWhere as Prisma.TaskWhereInput,
        orderBy: [{ started_at: 'asc' }, { position: 'asc' }],
      });

      // Load dependencies for these tasks
      const taskIds = tasks.map((t) => t.id);
      const dependencies = await ctx.prisma.taskDependency.findMany({
        where: {
          task_id: { in: taskIds },
          deleted_at: null,
        },
        select: {
          id: true,
          task_id: true,
          depends_on_id: true,
          dependency_type: true,
          lag_days: true,
        },
      });

      const depsByTask = dependencies.reduce<
        Record<string, typeof dependencies>
      >((acc, d) => {
        if (!acc[d.task_id]) acc[d.task_id] = [];
        acc[d.task_id]!.push(d);
        return acc;
      }, {});

      const ganttNodes: GanttTaskNode[] = tasks.map((t) => ({
        id: t.id,
        start_date: t.started_at,
        due_date: t.due_date,
        estimate_hours: Number(t.estimated_hours ?? 8),
        dependencies: (depsByTask[t.id] ?? []).map((d) => ({
          depends_on_id: d.depends_on_id,
          dependency_type: d.dependency_type,
          lag_days: d.lag_days,
        })),
      }));

      const projectStart =
        input.dateFrom ?? project.start_date ?? new Date();

      let cpmResult: ReturnType<typeof computeCriticalPath> | null = null;
      try {
        cpmResult = computeCriticalPath(ganttNodes, projectStart);
      } catch {
        // If CPM fails (e.g. cycles survived check), return without CPM data
        cpmResult = null;
      }

      return {
        project: {
          id: project.id,
          name: project.name,
          startDate: project.start_date,
          endDate: project.due_date,
        },
        phases,
        milestones,
        tasks: tasks.map((t) => {
          const cpm = cpmResult?.get(t.id);
          const taskDeps = depsByTask[t.id] ?? [];
          return {
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            phase_id: null as string | null,
            start_date: t.started_at ?? null,
            due_date: t.due_date ?? null,
            estimate_hours: Number(t.estimated_hours ?? 0),
            actual_hours: Number(t.actual_hours ?? 0),
            estimate_points: t.story_points ?? null,
            is_blocked: false,
            assignees: [] as Array<{ user: { name: string; avatar_url: string | null } }>,
            dependencies: taskDeps.map((d) => ({
              depends_on_task_id: d.depends_on_id,
              dependency_type: d.dependency_type,
              lag_days: d.lag_days,
            })),
            // CPM data
            isCritical: cpm?.isCritical ?? false,
            float: cpm?.float ?? null,
            es: cpm?.es ?? null,
            ef: cpm?.ef ?? null,
            ls: cpm?.ls ?? null,
            lf: cpm?.lf ?? null,
          };
        }),
      };
    }),
});
