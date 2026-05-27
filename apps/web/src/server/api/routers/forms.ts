import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { slugify } from '@/lib/utils';

// ─── Fields sub-router ────────────────────────────────────────────────────────

const fieldsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ form_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.form_id, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      return ctx.prisma.formField.findMany({
        where: { form_id: input.form_id },
        orderBy: { sort_order: 'asc' },
      });
    }),

  save: protectedProcedure
    .input(
      z.object({
        form_id: z.string(),
        fields: z.array(
          z.object({
            id: z.string().optional(),
            type: z.enum([
              'SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'NUMBER',
              'DATE', 'TIME', 'DATETIME', 'DROPDOWN', 'MULTI_SELECT',
              'RADIO', 'CHECKBOX', 'FILE_UPLOAD', 'RATING', 'SCALE',
              'MATRIX', 'DIVIDER', 'HEADING', 'PARAGRAPH', 'SIGNATURE',
            ]),
            label: z.string(),
            placeholder: z.string().optional(),
            description: z.string().optional(),
            field_key: z.string(),
            is_required: z.boolean().default(false),
            is_hidden: z.boolean().default(false),
            sort_order: z.number().int(),
            options: z.unknown().optional(),
            validations: z.unknown().optional(),
            conditions: z.unknown().optional(),
            settings: z.record(z.unknown()).default({}),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.form_id, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      // Delete existing fields and recreate
      await ctx.prisma.formField.deleteMany({ where: { form_id: input.form_id } });

      const created = await ctx.prisma.$transaction(
        input.fields.map((field) =>
          ctx.prisma.formField.create({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: {
              form_id: input.form_id,
              type: field.type,
              label: field.label,
              ...(field.placeholder !== undefined ? { placeholder: field.placeholder } : {}),
              ...(field.description !== undefined ? { description: field.description } : {}),
              field_key: field.field_key,
              is_required: field.is_required,
              is_hidden: field.is_hidden,
              sort_order: field.sort_order,
              ...(field.options !== undefined ? { options: field.options as object } : {}),
              ...(field.validations !== undefined ? { validations: field.validations as object } : {}),
              ...(field.conditions !== undefined ? { conditions: field.conditions as object } : {}),
              settings: field.settings as object,
            } as Parameters<typeof ctx.prisma.formField.create>[0]['data'],
          })
        )
      );

      return created;
    }),
});

// ─── Submissions sub-router ───────────────────────────────────────────────────

const submissionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        form_id: z.string(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.form_id, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      return ctx.prisma.formSubmission.findMany({
        where: { form_id: input.form_id },
        orderBy: { submitted_at: 'desc' },
        take: input.limit,
        skip: input.offset,
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const submission = await ctx.prisma.formSubmission.findFirst({
        where: { id: input.id },
        include: {
          form: { select: { id: true, title: true, organization_id: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
      if (!submission || submission.form.organization_id !== orgId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return submission;
    }),

  stats: protectedProcedure
    .input(z.object({ form_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.form_id, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);

      const [total, today, thisWeek, complete] = await Promise.all([
        ctx.prisma.formSubmission.count({ where: { form_id: input.form_id } }),
        ctx.prisma.formSubmission.count({
          where: { form_id: input.form_id, submitted_at: { gte: todayStart } },
        }),
        ctx.prisma.formSubmission.count({
          where: { form_id: input.form_id, submitted_at: { gte: weekStart } },
        }),
        ctx.prisma.formSubmission.count({
          where: { form_id: input.form_id, is_complete: true },
        }),
      ]);

      return {
        total,
        today,
        thisWeek,
        completionRate: total > 0 ? Math.round((complete / total) * 100) : 0,
      };
    }),
});

// ─── Root forms router ────────────────────────────────────────────────────────

export const formsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const forms = await ctx.prisma.form.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { submissions: true, fields: true } } },
    });
    return forms;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          fields: { orderBy: { sort_order: 'asc' } },
          _count: { select: { submissions: true } },
        },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      return form;
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx }) => {
      // Note: org context not available on public; slug is globally unique per org
      // handled on public page — fetch first matching published form
      return null; // placeholder; real impl uses server-side fetch in page.tsx
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        is_public: z.boolean().default(true),
        requires_auth: z.boolean().default(false),
        success_message: z.string().optional(),
        redirect_url: z.string().optional(),
        notification_emails: z.array(z.string().email()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;

      // Generate unique slug
      let slug = slugify(input.title);
      const existing = await ctx.prisma.form.findMany({
        where: { organization_id: orgId, slug: { startsWith: slug }, deleted_at: null },
        select: { slug: true },
      });
      if (existing.length > 0) {
        slug = `${slug}-${Date.now()}`;
      }

      return ctx.prisma.form.create({
        data: {
          ...input,
          organization_id: orgId,
          slug,
          status: 'DRAFT',
          description: input.description ?? null,
          success_message: input.success_message ?? null,
          redirect_url: input.redirect_url ?? null,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        is_public: z.boolean().optional(),
        requires_auth: z.boolean().optional(),
        close_on_limit: z.boolean().optional(),
        submission_limit: z.number().int().optional(),
        close_at: z.string().optional(),
        success_message: z.string().optional(),
        redirect_url: z.string().optional(),
        notification_emails: z.array(z.string().email()).optional(),
        settings: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { id, ...data } = input;
      const existing = await ctx.prisma.form.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      const updateData: Record<string, unknown> = { ...data };
      if (data.close_at) { updateData['close_at'] = new Date(data.close_at); } else { delete updateData['close_at']; }
      if (data.settings) { updateData['settings'] = data.settings as object; } else { delete updateData['settings']; }

      return ctx.prisma.form.update({
        where: { id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: updateData as any,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.form.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      return ctx.prisma.form.update({
        where: { id: input.id },
        data: { deleted_at: new Date(), status: 'ARCHIVED' },
      });
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const original = await ctx.prisma.form.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: { fields: { orderBy: { sort_order: 'asc' } } },
      });
      if (!original) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      const newTitle = `${original.title} (Copy)`;
      const newSlug = `${original.slug}-copy-${Date.now()}`;

      const newForm = await ctx.prisma.form.create({
        data: {
          organization_id: orgId,
          title: newTitle,
          description: original.description,
          slug: newSlug,
          status: 'DRAFT',
          is_public: original.is_public,
          requires_auth: original.requires_auth,
          close_on_limit: original.close_on_limit,
          submission_limit: original.submission_limit,
          success_message: original.success_message,
          redirect_url: original.redirect_url,
          notification_emails: original.notification_emails,
          settings: original.settings as object,
        },
      });

      if (original.fields.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (ctx.prisma.formField.createMany as any)({
          data: original.fields.map((f) => ({
            form_id: newForm.id,
            type: f.type,
            label: f.label,
            placeholder: f.placeholder ?? null,
            description: f.description ?? null,
            field_key: f.field_key,
            is_required: f.is_required,
            is_hidden: f.is_hidden,
            sort_order: f.sort_order,
            ...(f.options != null ? { options: f.options } : {}),
            ...(f.validations != null ? { validations: f.validations } : {}),
            ...(f.conditions != null ? { conditions: f.conditions } : {}),
            settings: f.settings,
          })),
        });
      }

      return newForm;
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.form.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      return ctx.prisma.form.update({ where: { id: input.id }, data: { status: 'PUBLISHED' } });
    }),

  unpublish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.form.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      return ctx.prisma.form.update({ where: { id: input.id }, data: { status: 'DRAFT' } });
    }),

  // Public submission endpoint — no auth required
  submitPublic: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        data: z.record(z.unknown()),
        ip_address: z.string().optional(),
        user_agent: z.string().optional(),
        referrer: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find form by slug across all orgs (public access)
      const form = await ctx.prisma.form.findFirst({
        where: { slug: input.slug, deleted_at: null, status: 'PUBLISHED', is_public: true },
        include: { fields: true },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found or not published' });

      // Check submission limit
      if (form.close_on_limit && form.submission_limit) {
        const count = await ctx.prisma.formSubmission.count({ where: { form_id: form.id } });
        if (count >= form.submission_limit) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Form submission limit reached' });
        }
      }

      // Check close date
      if (form.close_at && new Date() > new Date(form.close_at)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Form is closed' });
      }

      const submission = await ctx.prisma.formSubmission.create({
        data: {
          form_id: form.id,
          data: input.data as object,
          ip_address: input.ip_address ?? null,
          user_agent: input.user_agent ?? null,
          referrer: input.referrer ?? null,
          is_complete: true,
        },
      });

      return {
        id: submission.id,
        success_message: form.success_message,
        redirect_url: form.redirect_url,
      };
    }),

  fields: fieldsRouter,
  submissions: submissionsRouter,
});
