import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// Cycle detection using DFS
function wouldCreateCycle(
  taskId: string,
  dependsOnId: string,
  allDependencies: Array<{ task_id: string; depends_on_id: string }>
): boolean {
  const adj = new Map<string, Set<string>>();
  for (const dep of allDependencies) {
    if (!adj.has(dep.task_id)) adj.set(dep.task_id, new Set());
    adj.get(dep.task_id)!.add(dep.depends_on_id);
  }
  // Add proposed edge
  if (!adj.has(taskId)) adj.set(taskId, new Set());
  adj.get(taskId)!.add(dependsOnId);

  // DFS from dependsOnId — if we reach taskId, cycle exists
  const visited = new Set<string>();
  function dfs(current: string): boolean {
    if (current === taskId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    for (const neighbor of adj.get(current) ?? []) {
      if (dfs(neighbor)) return true;
    }
    return false;
  }
  return dfs(dependsOnId);
}

export const taskDepsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      const [dependencyRows, blockingRows] = await Promise.all([
        ctx.prisma.taskDependency.findMany({
          where: { task_id: input.taskId, deleted_at: null },
        }),
        ctx.prisma.taskDependency.findMany({
          where: { depends_on_id: input.taskId, deleted_at: null },
        }),
      ]);

      // Load related tasks
      const dependsOnIds = dependencyRows.map((d) => d.depends_on_id);
      const blockingTaskIds = blockingRows.map((d) => d.task_id);
      const allIds = [...new Set([...dependsOnIds, ...blockingTaskIds])];

      const relatedTasks = allIds.length > 0
        ? await ctx.prisma.task.findMany({
            where: { id: { in: allIds } },
            select: { id: true, title: true, status: true },
          })
        : [];

      const taskById = Object.fromEntries(relatedTasks.map((t) => [t.id, t]));

      const dependencies = dependencyRows.map((d) => ({
        ...d,
        depends_on: taskById[d.depends_on_id] ?? null,
      }));

      const blocking = blockingRows.map((d) => ({
        ...d,
        task: taskById[d.task_id] ?? null,
      }));

      return { dependencies, blocking };
    }),

  create: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        dependsOnTaskId: z.string(),
        dependencyType: z
          .enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'])
          .default('finish_to_start'),
        lagDays: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      if (input.taskId === input.dependsOnTaskId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A task cannot depend on itself' });
      }

      const [task, dependsOnTask] = await Promise.all([
        ctx.prisma.task.findFirst({
          where: { id: input.taskId, organization_id: orgId, deleted_at: null },
        }),
        ctx.prisma.task.findFirst({
          where: { id: input.dependsOnTaskId, organization_id: orgId, deleted_at: null },
        }),
      ]);

      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      if (!dependsOnTask) throw new TRPCError({ code: 'NOT_FOUND', message: 'Dependency task not found' });

      // Fetch all existing dependencies for cycle check
      const allDeps = await ctx.prisma.taskDependency.findMany({
        where: { organization_id: orgId, deleted_at: null },
        select: { task_id: true, depends_on_id: true },
      });

      if (wouldCreateCycle(input.taskId, input.dependsOnTaskId, allDeps)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This dependency would create a circular reference',
        });
      }

      const dep = await ctx.prisma.taskDependency.create({
        data: {
          organization_id: orgId,
          task_id: input.taskId,
          depends_on_id: input.dependsOnTaskId,
          dependency_type: input.dependencyType,
          lag_days: input.lagDays,
        },
      });

      return { ...dep, depends_on: { id: dependsOnTask.id, title: dependsOnTask.title } };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const dep = await ctx.prisma.taskDependency.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!dep) throw new TRPCError({ code: 'NOT_FOUND', message: 'Dependency not found' });

      await ctx.prisma.taskDependency.delete({ where: { id: input.id } });

      return { success: true };
    }),
});
