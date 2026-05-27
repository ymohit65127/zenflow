// @ts-nocheck
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const TICKET_STATUSES = ['open', 'in_progress', 'pending', 'resolved', 'closed'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const TICKET_CHANNELS = ['email', 'web', 'chat', 'whatsapp', 'phone', 'social', 'portal', 'api'] as const;
const SLA_STATUSES = ['ok', 'warning', 'breached_first', 'breached_resolution'] as const;

const AttachmentSchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.number(),
  mime_type: z.string(),
});

export const ticketsV2Router = createTRPCRouter({
  // -------------------------------------------------------------------------
  // List tickets (full filter support)
  // -------------------------------------------------------------------------
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(25),
      status: z.enum(TICKET_STATUSES).optional(),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      assignee_id: z.string().optional(),
      team_id: z.string().optional(),
      category_id: z.string().optional(),
      channel: z.enum(TICKET_CHANNELS).optional(),
      sla_status: z.enum(SLA_STATUSES).optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      from_date: z.string().optional(),
      to_date: z.string().optional(),
      view: z.enum(['mine', 'unassigned', 'all_open', 'overdue', 'team']).optional(),
      spam: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;
      const skip = (input.page - 1) * input.limit;

      const where: Record<string, unknown> = {
        organization_id: orgId,
        deleted_at: null,
        spam: input.spam ?? false,
      };

      if (input.status) where['status'] = input.status;
      if (input.priority) where['priority'] = input.priority;
      if (input.assignee_id) where['assignee_id'] = input.assignee_id;
      if (input.team_id) where['team_id'] = input.team_id;
      if (input.category_id) where['category_id'] = input.category_id;
      if (input.channel) where['channel'] = input.channel;
      if (input.sla_status) where['sla_status'] = input.sla_status;
      if (input.tags?.length) where['tags'] = { hasSome: input.tags };
      if (input.from_date || input.to_date) {
        where['created_at'] = {
          ...(input.from_date ? { gte: new Date(input.from_date) } : {}),
          ...(input.to_date ? { lte: new Date(input.to_date) } : {}),
        };
      }

      // Named views
      if (input.view === 'mine') where['assignee_id'] = userId;
      if (input.view === 'unassigned') where['assignee_id'] = null;
      if (input.view === 'all_open') where['status'] = { in: ['open', 'in_progress'] };
      if (input.view === 'overdue') where['sla_status'] = { in: ['breached_first', 'breached_resolution'] };

      if (input.search) {
        where['OR'] = [
          { subject: { contains: input.search, mode: 'insensitive' } },
          { ticket_number: { contains: input.search, mode: 'insensitive' } },
          { requester_email: { contains: input.search, mode: 'insensitive' } },
          { requester_name: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        ctx.prisma.hdTicket.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, color: true } },
            team: { select: { id: true, name: true } },
            sla_policy: { select: { id: true, name: true } },
            _count: { select: { replies: true } },
          },
          orderBy: [{ sla_status: 'asc' }, { created_at: 'desc' }],
          skip,
          take: input.limit,
        }),
        ctx.prisma.hdTicket.count({ where }),
      ]);

      return { items, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
    }),

  // -------------------------------------------------------------------------
  // Get full ticket detail
  // -------------------------------------------------------------------------
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const ticket = await ctx.prisma.hdTicket.findFirst({
        where: { id: input.id, organization_id: orgId },
        include: {
          category: true,
          sub_category: true,
          sla_policy: { include: { business_hours: true } },
          team: { include: { members: true } },
          replies: { orderBy: { created_at: 'asc' } },
          time_logs: { orderBy: { logged_at: 'desc' } },
          merged_tickets: { select: { id: true, ticket_number: true, subject: true } },
          child_tickets: { select: { id: true, ticket_number: true, subject: true, status: true } },
        },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });
      return ticket;
    }),

  // -------------------------------------------------------------------------
  // Create ticket
  // -------------------------------------------------------------------------
  create: protectedProcedure
    .input(z.object({
      subject: z.string().min(1).max(500),
      description: z.string().optional(),
      priority: z.enum(TICKET_PRIORITIES).default('medium'),
      type: z.enum(['question', 'incident', 'problem', 'task', 'feature_request']).default('question'),
      channel: z.enum(TICKET_CHANNELS).default('web'),
      category_id: z.string().optional(),
      team_id: z.string().optional(),
      assignee_id: z.string().optional(),
      requester_name: z.string().optional(),
      requester_email: z.string().email().optional(),
      tags: z.array(z.string()).default([]),
      sla_policy_id: z.string().optional(),
      cc_emails: z.array(z.string().email()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      // Generate ticket number (simple counter fallback)
      const last = await ctx.prisma.hdTicket.findFirst({
        where: { organization_id: orgId },
        orderBy: { created_at: 'desc' },
        select: { ticket_number: true },
      });
      const lastNum = last ? parseInt(last.ticket_number.replace(/\D/g, ''), 10) : 0;
      const ticket_number = `TKT-${String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(5, '0')}`;

      const ticket = await ctx.prisma.hdTicket.create({
        data: {
          organization_id: orgId,
          creator_id: userId,
          ticket_number,
          subject: input.subject,
          description: input.description ?? null,
          priority: input.priority,
          type: input.type,
          channel: input.channel,
          category_id: input.category_id ?? null,
          team_id: input.team_id ?? null,
          assignee_id: input.assignee_id ?? null,
          requester_name: input.requester_name ?? null,
          requester_email: input.requester_email ?? null,
          tags: input.tags,
          sla_policy_id: input.sla_policy_id ?? null,
          cc_emails: input.cc_emails ?? [],
          status: 'open',
        },
        include: {
          category: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      });

      // Apply SLA due dates if policy set
      if (input.sla_policy_id) {
        const policy = await ctx.prisma.hdSlaPolicy.findFirst({
          where: { id: input.sla_policy_id, organization_id: orgId },
          include: { business_hours: true },
        });
        if (policy) {
          const frHours = (policy.first_response_hours as Record<string, number>)[input.priority] ?? 4;
          const resHours = (policy.resolution_hours as Record<string, number>)[input.priority] ?? 24;
          await ctx.prisma.hdTicket.update({
            where: { id: ticket.id },
            data: {
              first_response_due_at: new Date(ticket.created_at.getTime() + frHours * 3600000),
              resolution_due_at: new Date(ticket.created_at.getTime() + resHours * 3600000),
            },
          });
        }
      }

      return ticket;
    }),

  // -------------------------------------------------------------------------
  // Update ticket
  // -------------------------------------------------------------------------
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      subject: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      status: z.enum(TICKET_STATUSES).optional(),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      type: z.enum(['question', 'incident', 'problem', 'task', 'feature_request']).optional(),
      category_id: z.string().nullable().optional(),
      team_id: z.string().nullable().optional(),
      assignee_id: z.string().nullable().optional(),
      sla_policy_id: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      requester_name: z.string().optional(),
      requester_email: z.string().email().optional(),
      cc_emails: z.array(z.string().email()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const { id, ...data } = input;

      const existing = await ctx.prisma.hdTicket.findFirst({ where: { id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      const updateData: Record<string, unknown> = {};
      if (data.subject !== undefined) updateData['subject'] = data.subject;
      if (data.description !== undefined) updateData['description'] = data.description;
      if (data.status !== undefined) {
        updateData['status'] = data.status;
        if (data.status === 'resolved') updateData['resolved_at'] = new Date();
        if (data.status === 'closed') updateData['closed_at'] = new Date();
      }
      if (data.priority !== undefined) updateData['priority'] = data.priority;
      if (data.type !== undefined) updateData['type'] = data.type;
      if (data.category_id !== undefined) updateData['category_id'] = data.category_id;
      if (data.team_id !== undefined) updateData['team_id'] = data.team_id;
      if (data.assignee_id !== undefined) updateData['assignee_id'] = data.assignee_id;
      if (data.sla_policy_id !== undefined) updateData['sla_policy_id'] = data.sla_policy_id;
      if (data.tags !== undefined) updateData['tags'] = data.tags;
      if (data.requester_name !== undefined) updateData['requester_name'] = data.requester_name;
      if (data.requester_email !== undefined) updateData['requester_email'] = data.requester_email;
      if (data.cc_emails !== undefined) updateData['cc_emails'] = data.cc_emails;

      return ctx.prisma.hdTicket.update({ where: { id }, data: updateData });
    }),

  // -------------------------------------------------------------------------
  // Reply to ticket
  // -------------------------------------------------------------------------
  reply: protectedProcedure
    .input(z.object({
      ticket_id: z.string(),
      body: z.string().min(1),
      body_html: z.string().optional(),
      reply_type: z.enum(['reply', 'note', 'auto_reply', 'system']).default('reply'),
      is_public: z.boolean().default(true),
      to_emails: z.array(z.string().email()).optional(),
      cc_emails: z.array(z.string().email()).optional(),
      attachments: z.array(AttachmentSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const userId = ctx.session.user.id;

      const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id: input.ticket_id, organization_id: orgId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      const reply = await ctx.prisma.hdTicketReply.create({
        data: {
          ticket_id: input.ticket_id,
          body: input.body,
          body_html: input.body_html ?? null,
          reply_type: input.reply_type,
          is_public: input.is_public,
          to_emails: input.to_emails ?? [],
          cc_emails: input.cc_emails ?? [],
          bcc_emails: [],
          attachments: input.attachments ?? null,
          sent_via: 'ui',
          created_by: userId,
        },
      });

      // Set first_responded_at if this is first public reply from agent
      if (input.is_public && !ticket.first_responded_at) {
        await ctx.prisma.hdTicket.update({
          where: { id: input.ticket_id },
          data: {
            first_responded_at: new Date(),
            status: ticket.status === 'pending' ? 'in_progress' : ticket.status,
          },
        });
      }

      return reply;
    }),

  // -------------------------------------------------------------------------
  // Close, Resolve, Reopen
  // -------------------------------------------------------------------------
  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });
      return ctx.prisma.hdTicket.update({
        where: { id: input.id },
        data: { status: 'resolved', resolved_at: new Date() },
      });
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string(), resolution_note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      await ctx.prisma.hdTicket.update({
        where: { id: input.id },
        data: { status: 'closed', closed_at: new Date() },
      });

      if (input.resolution_note) {
        await ctx.prisma.hdTicketReply.create({
          data: {
            ticket_id: input.id,
            body: input.resolution_note,
            reply_type: 'system',
            is_public: false,
            created_by: ctx.session.user.id,
            to_emails: [],
            cc_emails: [],
            bcc_emails: [],
          },
        });
      }

      return { success: true };
    }),

  reopen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      return ctx.prisma.hdTicket.update({
        where: { id: input.id },
        data: {
          status: 'open',
          reopened_at: new Date(),
          reopen_count: { increment: 1 },
          resolved_at: null,
          closed_at: null,
          sla_status: 'ok',
        },
      });
    }),

  // -------------------------------------------------------------------------
  // Assign
  // -------------------------------------------------------------------------
  assign: protectedProcedure
    .input(z.object({
      id: z.string(),
      assignee_id: z.string().nullable(),
      team_id: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const existing = await ctx.prisma.hdTicket.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      return ctx.prisma.hdTicket.update({
        where: { id: input.id },
        data: { assignee_id: input.assignee_id, team_id: input.team_id },
      });
    }),

  // -------------------------------------------------------------------------
  // Merge tickets
  // -------------------------------------------------------------------------
  merge: protectedProcedure
    .input(z.object({ source_id: z.string(), target_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      if (input.source_id === input.target_id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot merge a ticket into itself' });

      const [source, target] = await Promise.all([
        ctx.prisma.hdTicket.findFirst({ where: { id: input.source_id, organization_id: orgId } }),
        ctx.prisma.hdTicket.findFirst({ where: { id: input.target_id, organization_id: orgId } }),
      ]);
      if (!source || !target) throw new TRPCError({ code: 'NOT_FOUND', message: 'One or both tickets not found' });

      // Move replies from source to target
      await ctx.prisma.hdTicketReply.updateMany({
        where: { ticket_id: input.source_id },
        data: { ticket_id: input.target_id },
      });

      // Mark source as merged
      await ctx.prisma.hdTicket.update({
        where: { id: input.source_id },
        data: { merged_into_id: input.target_id, status: 'closed', closed_at: new Date() },
      });

      // Add system note to target
      await ctx.prisma.hdTicketReply.create({
        data: {
          ticket_id: input.target_id,
          body: `Ticket ${source.ticket_number} was merged into this ticket.`,
          reply_type: 'system',
          is_public: false,
          created_by: ctx.session.user.id,
          to_emails: [],
          cc_emails: [],
          bcc_emails: [],
        },
      });

      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // Split reply into new ticket
  // -------------------------------------------------------------------------
  split: protectedProcedure
    .input(z.object({ reply_id: z.string(), subject: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const reply = await ctx.prisma.hdTicketReply.findFirst({ where: { id: input.reply_id } });
      if (!reply) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reply not found' });

      const parentTicket = await ctx.prisma.hdTicket.findFirst({ where: { id: reply.ticket_id, organization_id: orgId } });
      if (!parentTicket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent ticket not found' });

      const last = await ctx.prisma.hdTicket.findFirst({ where: { organization_id: orgId }, orderBy: { created_at: 'desc' }, select: { ticket_number: true } });
      const lastNum = last ? parseInt(last.ticket_number.replace(/\D/g, ''), 10) : 0;
      const ticket_number = `TKT-${String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(5, '0')}`;

      const newTicket = await ctx.prisma.hdTicket.create({
        data: {
          organization_id: orgId,
          creator_id: ctx.session.user.id,
          ticket_number,
          subject: input.subject,
          description: reply.body,
          channel: parentTicket.channel,
          priority: parentTicket.priority,
          type: parentTicket.type,
          status: 'open',
          parent_ticket_id: parentTicket.id,
          requester_email: parentTicket.requester_email,
          requester_name: parentTicket.requester_name,
          tags: [],
          cc_emails: [],
        },
      });

      // Cross-reference notes
      await Promise.all([
        ctx.prisma.hdTicketReply.create({
          data: {
            ticket_id: parentTicket.id,
            body: `A new ticket ${ticket_number} was split from this thread.`,
            reply_type: 'system',
            is_public: false,
            created_by: ctx.session.user.id,
            to_emails: [],
            cc_emails: [],
            bcc_emails: [],
          },
        }),
        ctx.prisma.hdTicketReply.create({
          data: {
            ticket_id: newTicket.id,
            body: `This ticket was split from ${parentTicket.ticket_number}.`,
            reply_type: 'system',
            is_public: false,
            created_by: ctx.session.user.id,
            to_emails: [],
            cc_emails: [],
            bcc_emails: [],
          },
        }),
      ]);

      return newTicket;
    }),

  // -------------------------------------------------------------------------
  // Bulk actions
  // -------------------------------------------------------------------------
  bulkAssign: protectedProcedure
    .input(z.object({ ids: z.array(z.string()), assignee_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const result = await ctx.prisma.hdTicket.updateMany({
        where: { id: { in: input.ids }, organization_id: orgId },
        data: { assignee_id: input.assignee_id },
      });
      return { updated: result.count };
    }),

  bulkClose: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const result = await ctx.prisma.hdTicket.updateMany({
        where: { id: { in: input.ids }, organization_id: orgId },
        data: { status: 'closed', closed_at: new Date() },
      });
      return { updated: result.count };
    }),

  bulkTag: protectedProcedure
    .input(z.object({ ids: z.array(z.string()), tags: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      // Individual updates needed since we append tags
      await Promise.all(
        input.ids.map(async (id) => {
          const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id, organization_id: orgId }, select: { tags: true } });
          if (!ticket) return;
          const newTags = Array.from(new Set([...ticket.tags, ...input.tags]));
          return ctx.prisma.hdTicket.update({ where: { id }, data: { tags: newTags } });
        }),
      );
      return { updated: input.ids.length };
    }),

  bulkSetPriority: protectedProcedure
    .input(z.object({ ids: z.array(z.string()), priority: z.enum(TICKET_PRIORITIES) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const result = await ctx.prisma.hdTicket.updateMany({
        where: { id: { in: input.ids }, organization_id: orgId },
        data: { priority: input.priority },
      });
      return { updated: result.count };
    }),

  // -------------------------------------------------------------------------
  // Time tracking
  // -------------------------------------------------------------------------
  logTime: protectedProcedure
    .input(z.object({
      ticket_id: z.string(),
      minutes: z.number().int().positive(),
      is_billable: z.boolean().default(false),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id: input.ticket_id, organization_id: orgId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      const [log] = await Promise.all([
        ctx.prisma.hdTimeLog.create({
          data: {
            ticket_id: input.ticket_id,
            agent_id: ctx.session.user.id,
            minutes: input.minutes,
            is_billable: input.is_billable,
            note: input.note ?? null,
          },
        }),
        ctx.prisma.hdTicket.update({
          where: { id: input.ticket_id },
          data: { time_tracked_minutes: { increment: input.minutes } },
        }),
      ]);

      return log;
    }),

  getTimeLogs: protectedProcedure
    .input(z.object({ ticket_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId;
      const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id: input.ticket_id, organization_id: orgId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      return ctx.prisma.hdTimeLog.findMany({
        where: { ticket_id: input.ticket_id },
        orderBy: { logged_at: 'desc' },
      });
    }),

  // -------------------------------------------------------------------------
  // CSAT
  // -------------------------------------------------------------------------
  submitCsat: publicProcedure
    .input(z.object({
      ticket_id: z.string(),
      rating: z.number().int().min(1).max(10),
      comment: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.prisma.hdTicket.findFirst({ where: { id: input.ticket_id } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      return ctx.prisma.hdTicket.update({
        where: { id: input.ticket_id },
        data: {
          satisfaction_rating: input.rating,
          satisfaction_comment: input.comment ?? null,
        },
      });
    }),

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------
  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId;
    const userId = ctx.session.user.id;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [open, inProgress, pending, myTickets, resolvedToday, slaBreached, unassigned] = await Promise.all([
      ctx.prisma.hdTicket.count({ where: { organization_id: orgId, status: 'open', deleted_at: null } }),
      ctx.prisma.hdTicket.count({ where: { organization_id: orgId, status: 'in_progress', deleted_at: null } }),
      ctx.prisma.hdTicket.count({ where: { organization_id: orgId, status: 'pending', deleted_at: null } }),
      ctx.prisma.hdTicket.count({ where: { organization_id: orgId, assignee_id: userId, status: { in: ['open', 'in_progress'] }, deleted_at: null } }),
      ctx.prisma.hdTicket.count({ where: { organization_id: orgId, status: 'resolved', resolved_at: { gte: startOfDay }, deleted_at: null } }),
      ctx.prisma.hdTicket.count({ where: { organization_id: orgId, sla_status: { in: ['breached_first', 'breached_resolution'] }, status: { notIn: ['closed', 'resolved'] }, deleted_at: null } }),
      ctx.prisma.hdTicket.count({ where: { organization_id: orgId, assignee_id: null, status: { in: ['open', 'in_progress'] }, deleted_at: null } }),
    ]);

    return { open, inProgress, pending, myTickets, resolvedToday, slaBreached, unassigned };
  }),
});
