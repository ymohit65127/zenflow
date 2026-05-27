// @ts-nocheck
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

      return ctx.prisma.taskTimeLog.findMany({
        where: {
          ...(input.taskId ? { task_id: input.taskId } : {}),
          ...(input.userId ? { user_id: input.userId } : {}),
          ...(input.projectId ? { task: { project_id: input.projectId } } : {}),
          ...(input.isBillable !== undefined ? { is_billable: input.isBillable } : {}),
          ...(input.dateFrom || input.dateTo
            ? {
                start_time: {
                  ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                  ...(input.dateTo ? { lte: input.dateTo } : {}),
                },
              }
            : {}),
          task: { project: { organization_id: orgId } },
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          task: { select: { id: true, title: true, project_id: true } },
        },
        orderBy: { start_time: 'desc' },
      });
    }),

  getRunning: protectedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      return ctx.prisma.taskTimeLog.findFirst({
        where: { user_id: userId, end_time: null },
        include: {
          task: { select: { id: true, title: true, project_id: true } },
        },
      });
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
        where: { id: input.taskId, project: { organization_id: orgId }, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      // Stop any running timer for this user
      await ctx.prisma.taskTimeLog.updateMany({
        where: { user_id: userId, end_time: null },
        data: { end_time: new Date() },
      });

      return ctx.prisma.taskTimeLog.create({
        data: {
          task_id: input.taskId,
          user_id: userId,
          start_time: new Date(),
          description: input.description ?? null,
        },
        include: {
          task: { select: { id: true, title: true } },
        },
      });
    }),

  stop: protectedProcedure
    .input(z.object({ timeLogId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const timeLog = await ctx.prisma.taskTimeLog.findFirst({
        where: { id: input.timeLogId, user_id: userId, end_time: null },
      });
      if (!timeLog) throw new TRPCError({ code: 'NOT_FOUND', message: 'Running timer not found' });

      const endTime = new Date();
      const durationMinutes = Math.round(
        (endTime.getTime() - timeLog.start_time.getTime()) / (1000 * 60)
      );

      const updated = await ctx.prisma.taskTimeLog.update({
        where: { id: input.timeLogId },
        data: {
          end_time: endTime,
          duration_minutes: durationMinutes,
        },
      });

      // Update task actual_hours
      await ctx.prisma.task.update({
        where: { id: timeLog.task_id },
        data: {
          actual_hours: {
            increment: durationMinutes / 60,
          },
        },
      });

      return updated;
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
        where: { id: input.taskId, project: { organization_id: orgId }, deleted_at: null },
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
          user_id: userId,
          start_time: input.startTime,
          end_time: input.endTime,
          duration_minutes: durationMinutes,
          description: input.description ?? null,
          is_billable: input.isBillable,
          hourly_rate: input.hourlyRate ?? null,
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          task: { select: { id: true, title: true } },
        },
      });

      await ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { actual_hours: { increment: durationMinutes / 60 } },
      });

      return log;
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const timeLog = await ctx.prisma.taskTimeLog.findFirst({
        where: { id: input.id, task: { project: { organization_id: orgId } } },
      });
      if (!timeLog) throw new TRPCError({ code: 'NOT_FOUND', message: 'Time log not found' });

      const { id, ...data } = input;

      let durationMinutes = timeLog.duration_minutes;
      if (data.startTime || data.endTime !== undefined) {
        const newStart = data.startTime ?? timeLog.start_time;
        const newEnd = data.endTime ?? timeLog.end_time;
        if (newEnd && newStart) {
          durationMinutes = Math.round((newEnd.getTime() - newStart.getTime()) / (1000 * 60));
        }
      }

      return ctx.prisma.taskTimeLog.update({
        where: { id },
        data: {
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.isBillable !== undefined ? { is_billable: data.isBillable } : {}),
          ...(data.hourlyRate !== undefined ? { hourly_rate: data.hourlyRate } : {}),
          ...(data.startTime !== undefined ? { start_time: data.startTime } : {}),
          ...(data.endTime !== undefined ? { end_time: data.endTime } : {}),
          duration_minutes: durationMinutes,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const timeLog = await ctx.prisma.taskTimeLog.findFirst({
        where: { id: input.id, task: { project: { organization_id: orgId } } },
      });
      if (!timeLog) throw new TRPCError({ code: 'NOT_FOUND', message: 'Time log not found' });

      await ctx.prisma.taskTimeLog.delete({ where: { id: input.id } });

      // Adjust task.actual_hours
      if (timeLog.duration_minutes) {
        await ctx.prisma.task.update({
          where: { id: timeLog.task_id },
          data: { actual_hours: { decrement: timeLog.duration_minutes / 60 } },
        });
      }

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

      const logs = await ctx.prisma.taskTimeLog.findMany({
        where: {
          task: { project_id: input.projectId },
          ...(input.dateFrom || input.dateTo
            ? {
                start_time: {
                  ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                  ...(input.dateTo ? { lte: input.dateTo } : {}),
                },
              }
            : {}),
          end_time: { not: null },
        },
        include: {
          user: { select: { id: true, name: true, avatar_url: true } },
          task: { select: { id: true, title: true } },
        },
      });

      const totalMinutes = logs.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0);
      const billableMinutes = logs
        .filter((l) => l.is_billable)
        .reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0);

      return {
        totalHours: totalMinutes / 60,
        billableHours: billableMinutes / 60,
        entryCount: logs.length,
        logs,
      };
    }),
});
