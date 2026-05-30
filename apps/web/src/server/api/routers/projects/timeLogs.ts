import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const timeLogsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        taskId: z.string().optional(),
        userId: z.string().optional(),
        projectId: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        isBillable: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      // If filtering by project, get all task IDs for that project first
      let taskIdFilter: string[] | undefined;
      if (input.projectId) {
        const tasks = await ctx.prisma.task.findMany({
          where: { project_id: input.projectId, organization_id: orgId },
          select: { id: true },
        });
        taskIdFilter = tasks.map((t) => t.id);
      }

      const logs = await ctx.prisma.taskTimeLog.findMany({
        where: {
          organization_id: orgId,
          ...(input.taskId ? { task_id: input.taskId } : {}),
          ...(input.userId ? { user_id: input.userId } : {}),
          ...(taskIdFilter ? { task_id: { in: taskIdFilter } } : {}),
          ...(input.isBillable !== undefined ? { is_billable: input.isBillable } : {}),
          ...(input.dateFrom || input.dateTo
            ? {
                logged_date: {
                  ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                  ...(input.dateTo ? { lte: input.dateTo } : {}),
                },
              }
            : {}),
          deleted_at: null,
        },
        orderBy: { logged_date: 'desc' },
      });

      // Load related tasks and users
      const taskIds = [...new Set(logs.map((l) => l.task_id))];
      const userIds = [...new Set(logs.map((l) => l.user_id))];

      const [relatedTasks, relatedUsers] = await Promise.all([
        taskIds.length > 0
          ? ctx.prisma.task.findMany({
              where: { id: { in: taskIds } },
              select: { id: true, title: true, project_id: true },
            })
          : [],
        userIds.length > 0
          ? ctx.prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, avatar_url: true },
            })
          : [],
      ]);

      const taskById = Object.fromEntries(relatedTasks.map((t) => [t.id, t]));
      const userById = Object.fromEntries(relatedUsers.map((u) => [u.id, u]));

      return logs.map((l) => ({
        ...l,
        task: taskById[l.task_id] ?? null,
        user: userById[l.user_id] ?? null,
        start_time: null as Date | null,
        duration_minutes: l.minutes,
      }));
    }),

  getRunning: protectedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      // No timer-based tracking in current schema — return null
      return null;
    }),

  start: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      // Create a time log with 0 minutes (placeholder for a "started" log)
      const log = await ctx.prisma.taskTimeLog.create({
        data: {
          task_id: input.taskId,
          organization_id: orgId,
          user_id: userId,
          logged_date: new Date(),
          minutes: 0,
          description: input.description ?? null,
          is_billable: false,
        },
      });

      return {
        ...log,
        task: { id: task.id, title: task.title },
        start_time: new Date(),
        duration_minutes: 0,
      };
    }),

  stop: protectedProcedure
    .input(z.object({ timeLogId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const timeLog = await ctx.prisma.taskTimeLog.findFirst({
        where: { id: input.timeLogId, user_id: userId },
      });
      if (!timeLog) throw new TRPCError({ code: 'NOT_FOUND', message: 'Time log not found' });

      return { ...timeLog, start_time: null, duration_minutes: timeLog.minutes };
    }),

  create: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        startTime: z.date(),
        endTime: z.date(),
        description: z.string().optional(),
        isBillable: z.boolean().default(false),
        hourlyRate: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      if (input.endTime <= input.startTime) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'End time must be after start time' });
      }

      const durationMinutes = Math.round(
        (input.endTime.getTime() - input.startTime.getTime()) / (1000 * 60)
      );

      const log = await ctx.prisma.taskTimeLog.create({
        data: {
          task_id: input.taskId,
          organization_id: orgId,
          user_id: userId,
          logged_date: input.startTime,
          minutes: durationMinutes,
          description: input.description ?? null,
          is_billable: input.isBillable,
        },
      });

      await ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { actual_hours: { increment: durationMinutes / 60 } },
      });

      return {
        ...log,
        user: { id: userId, name: '', avatar_url: null as string | null },
        task: { id: task.id, title: task.title },
        start_time: input.startTime,
        duration_minutes: durationMinutes,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        description: z.string().nullable().optional(),
        isBillable: z.boolean().optional(),
        hourlyRate: z.number().nullable().optional(),
        startTime: z.date().optional(),
        endTime: z.date().nullable().optional(),
        minutes: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const timeLog = await ctx.prisma.taskTimeLog.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!timeLog) throw new TRPCError({ code: 'NOT_FOUND', message: 'Time log not found' });

      const { id, ...data } = input;

      let minutes = timeLog.minutes;
      if (data.minutes !== undefined) {
        minutes = data.minutes;
      } else if (data.startTime && data.endTime) {
        minutes = Math.round((data.endTime.getTime() - data.startTime.getTime()) / (1000 * 60));
      }

      return ctx.prisma.taskTimeLog.update({
        where: { id },
        data: {
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.isBillable !== undefined ? { is_billable: data.isBillable } : {}),
          ...(data.startTime !== undefined ? { logged_date: data.startTime } : {}),
          minutes,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const timeLog = await ctx.prisma.taskTimeLog.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!timeLog) throw new TRPCError({ code: 'NOT_FOUND', message: 'Time log not found' });

      await ctx.prisma.taskTimeLog.delete({ where: { id: input.id } });

      await ctx.prisma.task.update({
        where: { id: timeLog.task_id },
        data: { actual_hours: { decrement: timeLog.minutes / 60 } },
      });

      return { success: true };
    }),

  getAggregations: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        groupBy: z.enum(['user', 'task', 'date']).default('user'),
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

      const tasks = await ctx.prisma.task.findMany({
        where: { project_id: input.projectId, organization_id: orgId },
        select: { id: true, title: true },
      });
      const taskIds = tasks.map((t) => t.id);
      const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));

      const logs = await ctx.prisma.taskTimeLog.findMany({
        where: {
          task_id: { in: taskIds },
          organization_id: orgId,
          ...(input.dateFrom || input.dateTo
            ? {
                logged_date: {
                  ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                  ...(input.dateTo ? { lte: input.dateTo } : {}),
                },
              }
            : {}),
          deleted_at: null,
        },
      });

      // Load users
      const userIds = [...new Set(logs.map((l) => l.user_id))];
      const users = userIds.length > 0
        ? await ctx.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, avatar_url: true },
          })
        : [];
      const userById = Object.fromEntries(users.map((u) => [u.id, u]));

      const totalMinutes = logs.reduce((sum, l) => sum + l.minutes, 0);
      const billableMinutes = logs
        .filter((l) => l.is_billable)
        .reduce((sum, l) => sum + l.minutes, 0);

      return {
        totalHours: totalMinutes / 60,
        billableHours: billableMinutes / 60,
        entryCount: logs.length,
        logs: logs.map((l) => ({
          ...l,
          task: taskById[l.task_id] ?? null,
          user: userById[l.user_id] ?? null,
          start_time: null as Date | null,
          duration_minutes: l.minutes,
        })),
      };
    }),
});
