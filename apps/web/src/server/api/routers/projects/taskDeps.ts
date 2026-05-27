// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// Cycle detection using DFS
function wouldCreateCycle(
  taskId: string,
  dependsOnTaskId: string,
  allDependencies: Array<{ task_id: string; depends_on_task_id: string }>
): boolean {
  const adj = new Map<string, Set<string>>();
  for (const dep of allDependencies) {
    if (!adj.has(dep.task_id)) adj.set(dep.task_id, new Set());
    adj.get(dep.task_id)!.add(dep.depends_on_task_id);
  }
  // Add proposed edge
  if (!adj.has(taskId)) adj.set(taskId, new Set());
  adj.get(taskId)!.add(dependsOnTaskId);

  // DFS from dependsOnTaskId — if we reach taskId, cycle exists
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
  return dfs(dependsOnTaskId);
}

export const taskDepsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, project: { organization_id: orgId }, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      const [dependencies, blocking] = await Promise.all([
        ctx.prisma.taskDependency.findMany({
          where: { task_id: input.taskId },
          include: {
            depends_on: {
              select: { id: true, title: true, status_id: true },
            },
          },
        }),
        ctx.prisma.taskDependency.findMany({
          where: { depends_on_task_id: input.taskId },
          include: {
            task: { select: { id: true, title: true, status_id: true } },
          },
        }),
      ]);

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
          where: { id: input.taskId, project: { organization_id: orgId }, deleted_at: null },
        }),
        ctx.prisma.task.findFirst({
          where: { id: input.dependsOnTaskId, project: { organization_id: orgId }, deleted_at: null },
        }),
      ]);

      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      if (!dependsOnTask) throw new TRPCError({ code: 'NOT_FOUND', message: 'Dependency task not found' });

      // Fetch all existing dependencies for cycle check
      const allDeps = await ctx.prisma.taskDependency.findMany({
        where: { task: { project_id: task.project_id } },
        select: { task_id: true, depends_on_task_id: true },
      });

      if (wouldCreateCycle(input.taskId, input.dependsOnTaskId, allDeps)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This dependency would create a circular reference',
        });
      }

      const dep = await ctx.prisma.taskDependency.create({
        data: {
          task_id: input.taskId,
          depends_on_task_id: input.dependsOnTaskId,
          dependency_type: input.dependencyType,
          lag_days: input.lagDays,
        },
        include: {
          depends_on: { select: { id: true, title: true } },
        },
      });

      // Mark task as blocked if dependency type is finish_to_start and prerequisite not done
      if (input.dependencyType === 'finish_to_start') {
        const prereqStatus = await ctx.prisma.taskStatus.findUnique({
          where: { id: dependsOnTask.status_id },
          select: { status_type: true },
        });
        if (prereqStatus?.status_type !== 'done') {
          await ctx.prisma.task.update({
            where: { id: input.taskId },
            data: { is_blocked: true },
          });
        }
      }

      return dep;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const dep = await ctx.prisma.taskDependency.findFirst({
        where: { id: input.id, task: { project: { organization_id: orgId } } },
      });
      if (!dep) throw new TRPCError({ code: 'NOT_FOUND', message: 'Dependency not found' });

      await ctx.prisma.taskDependency.delete({ where: { id: input.id } });

      // Recalculate is_blocked for the task
      const remainingBlockingDeps = await ctx.prisma.taskDependency.findMany({
        where: {
          task_id: dep.task_id,
          dependency_type: 'finish_to_start',
        },
        include: {
          depends_on: {
            include: { status: { select: { status_type: true } } },
          },
        },
      });

      const isStillBlocked = remainingBlockingDeps.some(
        (d) => d.depends_on.status?.status_type !== 'done'
      );

      await ctx.prisma.task.update({
        where: { id: dep.task_id },
        data: { is_blocked: isStillBlocked },
      });

      return { success: true };
    }),
});
