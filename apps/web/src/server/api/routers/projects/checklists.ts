// @ts-nocheck
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const checklistsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, project: { organization_id: orgId }, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      return ctx.prisma.taskChecklist.findMany({
        where: { task_id: input.taskId },
        include: {
          items: {
            include: {
              done_by_user: { select: { id: true, name: true, avatar_url: true } },
            },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { position: 'asc' },
      });
    }),

  createChecklist: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        title: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, project: { organization_id: orgId }, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      const lastChecklist = await ctx.prisma.taskChecklist.findFirst({
        where: { task_id: input.taskId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return ctx.prisma.taskChecklist.create({
        data: {
          task_id: input.taskId,
          title: input.title,
          position: (lastChecklist?.position ?? 0) + 1,
        },
        include: { items: true },
      });
    }),

  deleteChecklist: protectedProcedure
    .input(z.object({ checklistId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const checklist = await ctx.prisma.taskChecklist.findFirst({
        where: { id: input.checklistId, task: { project: { organization_id: orgId } } },
      });
      if (!checklist) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist not found' });

      // Items cascade-delete via schema
      return ctx.prisma.taskChecklist.delete({ where: { id: input.checklistId } });
    }),

  addItem: protectedProcedure
    .input(
      z.object({
        checklistId: z.string(),
        text: z.string().min(1).max(500),
        position: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const checklist = await ctx.prisma.taskChecklist.findFirst({
        where: { id: input.checklistId, task: { project: { organization_id: orgId } } },
      });
      if (!checklist) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist not found' });

      let position = input.position;
      if (position === undefined) {
        const lastItem = await ctx.prisma.taskChecklistItem.findFirst({
          where: { checklist_id: input.checklistId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        position = (lastItem?.position ?? 0) + 1;
      }

      return ctx.prisma.taskChecklistItem.create({
        data: {
          checklist_id: input.checklistId,
          text: input.text,
          position,
        },
      });
    }),

  updateItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        text: z.string().min(1).max(500).optional(),
        isDone: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const item = await ctx.prisma.taskChecklistItem.findFirst({
        where: {
          id: input.itemId,
          checklist: { task: { project: { organization_id: orgId } } },
        },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist item not found' });

      const doneAt =
        input.isDone === true && !item.is_done
          ? new Date()
          : input.isDone === false && item.is_done
          ? null
          : undefined;

      return ctx.prisma.taskChecklistItem.update({
        where: { id: input.itemId },
        data: {
          ...(input.text !== undefined ? { text: input.text } : {}),
          ...(input.isDone !== undefined ? { is_done: input.isDone } : {}),
          ...(doneAt !== undefined ? { done_at: doneAt } : {}),
          ...(input.isDone === true ? { done_by: userId } : {}),
          ...(input.isDone === false ? { done_by: null } : {}),
        },
      });
    }),

  deleteItem: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const item = await ctx.prisma.taskChecklistItem.findFirst({
        where: {
          id: input.itemId,
          checklist: { task: { project: { organization_id: orgId } } },
        },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist item not found' });

      return ctx.prisma.taskChecklistItem.delete({ where: { id: input.itemId } });
    }),

  reorderItems: protectedProcedure
    .input(
      z.object({
        checklistId: z.string(),
        orderedIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const checklist = await ctx.prisma.taskChecklist.findFirst({
        where: { id: input.checklistId, task: { project: { organization_id: orgId } } },
      });
      if (!checklist) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist not found' });

      await Promise.all(
        input.orderedIds.map((id, index) =>
          ctx.prisma.taskChecklistItem.update({ where: { id }, data: { position: index + 1 } })
        )
      );
      return { success: true };
    }),
});
