import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { phasesRouter } from './projects/phases';
import { milestonesRouter } from './projects/milestones';
import { taskStatusesRouter } from './projects/taskStatuses';
import { taskDepsRouter } from './projects/taskDeps';
import { timeLogsRouter } from './projects/timeLogs';
import { checklistsRouter } from './projects/checklists';
import { templatesRouter } from './projects/templates';
import { risksRouter } from './projects/risks';
import { budgetRouter } from './projects/budget';
import { ganttRouter } from './projects/gantt';
import { sprintsV2Router } from './projects/sprints_v2';

// ─── Tasks Sub-Router ────────────────────────────────────────────────────────

const tasksRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z
          .enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'])
          .optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        assigneeId: z.string().uuid().optional(),
        taskListId: z.string().uuid().optional(),
        sprintId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      return ctx.prisma.task.findMany({
        where: {
          organization_id: orgId,
          project_id: input.projectId,
          deleted_at: null,
          ...(input.status ? { status: input.status } : {}),
          ...(input.priority ? { priority: input.priority } : {}),
          ...(input.taskListId ? { task_list_id: input.taskListId } : {}),
          ...(input.sprintId ? { sprint_id: input.sprintId } : {}),
          ...(input.assigneeId
            ? { assignments: { some: { user_id: input.assigneeId } } }
            : {}),
        },
        include: {
          assignments: {
            include: {
              user: { select: { id: true, name: true, avatar_url: true } },
            },
          },
          creator: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { comments: true, subtasks: true } },
        },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        taskListId: z.string().uuid().optional(),
        sprintId: z.string().uuid().optional(),
        parentId: z.string().uuid().optional(),
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        status: z
          .enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'])
          .default('TODO'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        type: z
          .enum(['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'])
          .default('TASK'),
        storyPoints: z.number().int().min(0).optional(),
        estimatedHours: z.number().min(0).optional(),
        dueDate: z.date().optional(),
        tags: z.array(z.string()).default([]),
        assigneeIds: z.array(z.string().uuid()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const lastTask = await ctx.prisma.task.findFirst({
        where: {
          organization_id: orgId,
          project_id: input.projectId,
          status: input.status,
          deleted_at: null,
        },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const position = lastTask ? Number(lastTask.position) + 1000 : 1000;

      const task = await ctx.prisma.task.create({
        data: {
          organization_id: orgId,
          project_id: input.projectId,
          task_list_id: input.taskListId ?? null,
          sprint_id: input.sprintId ?? null,
          parent_id: input.parentId ?? null,
          creator_id: userId,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          type: input.type,
          story_points: input.storyPoints ?? null,
          estimated_hours: input.estimatedHours ?? null,
          due_date: input.dueDate ?? null,
          tags: input.tags,
          position,
        },
      });

      if (input.assigneeIds.length > 0) {
        await ctx.prisma.taskAssignment.createMany({
          data: input.assigneeIds.map((uid) => ({
            task_id: task.id,
            user_id: uid,
          })),
          skipDuplicates: true,
        });
      }

      return task;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().nullable().optional(),
        status: z
          .enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'])
          .optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        type: z
          .enum(['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'])
          .optional(),
        taskListId: z.string().uuid().nullable().optional(),
        sprintId: z.string().uuid().nullable().optional(),
        storyPoints: z.number().int().min(0).nullable().optional(),
        estimatedHours: z.number().min(0).nullable().optional(),
        dueDate: z.date().nullable().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;

      const task = await ctx.prisma.task.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      const completedAt =
        data.status === 'DONE' && task.status !== 'DONE'
          ? new Date()
          : data.status !== undefined && data.status !== 'DONE' && task.status === 'DONE'
          ? null
          : undefined;

      return ctx.prisma.task.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.taskListId !== undefined ? { task_list_id: data.taskListId } : {}),
          ...(data.sprintId !== undefined ? { sprint_id: data.sprintId } : {}),
          ...(data.storyPoints !== undefined ? { story_points: data.storyPoints } : {}),
          ...(data.estimatedHours !== undefined ? { estimated_hours: data.estimatedHours } : {}),
          ...(data.dueDate !== undefined ? { due_date: data.dueDate } : {}),
          ...(data.tags !== undefined ? { tags: data.tags } : {}),
          ...(completedAt !== undefined ? { completed_at: completedAt } : {}),
        },
        include: {
          assignments: {
            include: {
              user: { select: { id: true, name: true, avatar_url: true } },
            },
          },
          creator: { select: { id: true, name: true, avatar_url: true } },
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      return ctx.prisma.task.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  assign: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        userId: z.string().uuid(),
        action: z.enum(['add', 'remove']).default('add'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      if (input.action === 'add') {
        return ctx.prisma.taskAssignment.upsert({
          where: { task_id_user_id: { task_id: input.taskId, user_id: input.userId } },
          create: { task_id: input.taskId, user_id: input.userId },
          update: {},
        });
      } else {
        return ctx.prisma.taskAssignment.deleteMany({
          where: { task_id: input.taskId, user_id: input.userId },
        });
      }
    }),

  comment: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      return ctx.prisma.taskComment.create({
        data: { task_id: input.taskId, user_id: userId, content: input.content },
      });
    }),

  getComments: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, organization_id: orgId, deleted_at: null },
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });

      // Fetch comments and related users separately (no direct user relation on TaskComment)
      const comments = await ctx.prisma.taskComment.findMany({
        where: { task_id: input.taskId },
        orderBy: { created_at: 'asc' },
      });

      const userIds = [...new Set(comments.map((c) => c.user_id))];
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, avatar_url: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      return comments.map((c) => ({
        ...c,
        user: userMap.get(c.user_id) ?? null,
      }));
    }),
});

// ─── Sprints Sub-Router ───────────────────────────────────────────────────────

const sprintsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const sprints = await ctx.prisma.sprint.findMany({
        where: { project_id: input.projectId },
        orderBy: { created_at: 'asc' },
      });

      const sprintIds = sprints.map((s) => s.id);
      const taskStats = await ctx.prisma.task.groupBy({
        by: ['sprint_id', 'status'],
        where: { sprint_id: { in: sprintIds }, deleted_at: null },
        _count: { id: true },
      });

      return sprints.map((sprint) => {
        const stats = taskStats.filter((s) => s.sprint_id === sprint.id);
        const totalTasks = stats.reduce((sum, s) => sum + s._count.id, 0);
        const byStatus = Object.fromEntries(
          stats.map((s) => [s.status, s._count.id])
        ) as Record<string, number>;
        return { ...sprint, totalTasks, tasksByStatus: byStatus };
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(200),
        goal: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.sprint.create({
        data: {
          project_id: input.projectId,
          name: input.name,
          goal: input.goal ?? null,
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          status: 'PLANNED',
        },
      });
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const sprint = await ctx.prisma.sprint.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
      });
      if (!sprint) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' });
      if (sprint.status !== 'PLANNED')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only PLANNED sprints can be started' });

      return ctx.prisma.sprint.update({
        where: { id: input.id },
        data: { status: 'ACTIVE', start_date: sprint.start_date ?? new Date() },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const sprint = await ctx.prisma.sprint.findFirst({
        where: { id: input.id, project: { organization_id: orgId } },
      });
      if (!sprint) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' });
      if (sprint.status !== 'ACTIVE')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only ACTIVE sprints can be completed' });

      return ctx.prisma.sprint.update({
        where: { id: input.id },
        data: { status: 'COMPLETED', completed_at: new Date() },
      });
    }),
});

// ─── Task Lists Sub-Router ────────────────────────────────────────────────────

const taskListsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.taskList.findMany({
        where: { project_id: input.projectId },
        include: { _count: { select: { tasks: true } } },
        orderBy: { sort_order: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(200),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const lastList = await ctx.prisma.taskList.findFirst({
        where: { project_id: input.projectId },
        orderBy: { sort_order: 'desc' },
        select: { sort_order: true },
      });

      return ctx.prisma.taskList.create({
        data: {
          project_id: input.projectId,
          name: input.name,
          color: input.color ?? null,
          sort_order: (lastList?.sort_order ?? 0) + 1,
        },
      });
    }),
});

// ─── Main Projects Router ─────────────────────────────────────────────────────

export const projectsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const projects = await ctx.prisma.project.findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
          _count: { select: { members: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      const projectIds = projects.map((p) => p.id);
      const taskStats = await ctx.prisma.task.groupBy({
        by: ['project_id', 'status'],
        where: { project_id: { in: projectIds }, deleted_at: null },
        _count: { id: true },
      });

      return projects.map((project) => {
        const stats = taskStats.filter((s) => s.project_id === project.id);
        const totalTasks = stats.reduce((sum, s) => sum + s._count.id, 0);
        const doneTasks = stats.find((s) => s.status === 'DONE')?._count.id ?? 0;
        return { ...project, totalTasks, doneTasks };
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;

      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          owner: { select: { id: true, name: true, avatar_url: true } },
          members: true,
          task_lists: { orderBy: { sort_order: 'asc' } },
          tasks: {
            where: { deleted_at: null },
            include: {
              assignments: {
                include: {
                  user: { select: { id: true, name: true, avatar_url: true } },
                },
              },
              creator: { select: { id: true, name: true, avatar_url: true } },
              _count: { select: { comments: true, subtasks: true } },
            },
            orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
          },
          sprints: { orderBy: { created_at: 'asc' } },
          milestones: { orderBy: { due_date: 'asc' } },
        },
      });

      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Enrich members with user info
      const memberUserIds = project.members.map((m) => m.user_id);
      const memberUsers = await ctx.prisma.user.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, name: true, avatar_url: true, email: true },
      });
      const userMap = new Map(memberUsers.map((u) => [u.id, u]));

      return {
        ...project,
        members: project.members.map((m) => ({
          ...m,
          user: userMap.get(m.user_id) ?? null,
        })),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        color: z.string().default('#6366f1'),
        icon: z.string().optional(),
        startDate: z.date().optional(),
        dueDate: z.date().optional(),
        status: z
          .enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
          .default('ACTIVE'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.create({
        data: {
          organization_id: orgId,
          owner_id: userId,
          name: input.name,
          description: input.description ?? null,
          color: input.color,
          icon: input.icon ?? null,
          start_date: input.startDate ?? null,
          due_date: input.dueDate ?? null,
          status: input.status,
        },
      });

      await ctx.prisma.projectMember.create({
        data: { project_id: project.id, user_id: userId, role: 'OWNER' },
      });

      await ctx.prisma.taskList.createMany({
        data: [
          { project_id: project.id, name: 'Backlog', sort_order: 0 },
          { project_id: project.id, name: 'To Do', sort_order: 1 },
          { project_id: project.id, name: 'In Progress', sort_order: 2 },
          { project_id: project.id, name: 'Done', sort_order: 3 },
        ],
      });

      return project;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        color: z.string().optional(),
        icon: z.string().nullable().optional(),
        startDate: z.date().nullable().optional(),
        dueDate: z.date().nullable().optional(),
        status: z
          .enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
          .optional(),
        isArchived: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;

      const project = await ctx.prisma.project.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const completedAt =
        data.status === 'COMPLETED' && project.status !== 'COMPLETED'
          ? new Date()
          : data.status !== undefined && data.status !== 'COMPLETED' && project.status === 'COMPLETED'
          ? null
          : undefined;

      return ctx.prisma.project.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.icon !== undefined ? { icon: data.icon } : {}),
          ...(data.startDate !== undefined ? { start_date: data.startDate } : {}),
          ...(data.dueDate !== undefined ? { due_date: data.dueDate } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.isArchived !== undefined ? { is_archived: data.isArchived } : {}),
          ...(completedAt !== undefined ? { completed_at: completedAt } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      return ctx.prisma.project.update({
        where: { id: input.id },
        data: { deleted_at: new Date() },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const now = new Date();
    const [total, active, completed, overdue] = await Promise.all([
      ctx.prisma.project.count({ where: { organization_id: orgId, deleted_at: null } }),
      ctx.prisma.project.count({ where: { organization_id: orgId, deleted_at: null, status: 'ACTIVE' } }),
      ctx.prisma.project.count({ where: { organization_id: orgId, deleted_at: null, status: 'COMPLETED' } }),
      ctx.prisma.project.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { notIn: ['COMPLETED', 'CANCELLED', 'ARCHIVED'] },
          due_date: { lt: now },
        },
      }),
    ]);
    return { total, active, completed, overdue };
  }),

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      return ctx.prisma.projectMember.upsert({
        where: { project_id_user_id: { project_id: input.projectId, user_id: input.userId } },
        create: { project_id: input.projectId, user_id: input.userId, role: input.role },
        update: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, organization_id: orgId, deleted_at: null },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      return ctx.prisma.projectMember.deleteMany({
        where: { project_id: input.projectId, user_id: input.userId },
      });
    }),

  getOrgUsers: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    return ctx.prisma.user.findMany({
      where: { organization_id: orgId, deleted_at: null, is_active: true },
      select: { id: true, name: true, avatar_url: true, email: true },
      orderBy: { name: 'asc' },
    });
  }),

  tasks: tasksRouter,
  sprints: sprintsRouter,
  taskLists: taskListsRouter,
  // v2 sub-routers
  phases: phasesRouter,
  milestones: milestonesRouter,
  taskStatuses: taskStatusesRouter,
  taskDeps: taskDepsRouter,
  timeLogs: timeLogsRouter,
  checklists: checklistsRouter,
  templates: templatesRouter,
  risks: risksRouter,
  budget: budgetRouter,
  gantt: ganttRouter,
  sprintsV2: sprintsV2Router,
});
