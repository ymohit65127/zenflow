// @ts-nocheck
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const WebFormFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'date']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

const WebFormCreateSchema = z.object({
  name: z.string().min(1).max(255),
  pipeline_id: z.string().optional(),
  stage_id: z.string().optional(),
  owner_id: z.string().optional(),
  fields: z.array(WebFormFieldSchema).min(1),
  custom_css: z.string().optional(),
  success_message: z.string().optional(),
  redirect_url: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const crmWebformsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.crmWebForm.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: {
        pipeline: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.crmWebForm.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
        include: {
          pipeline: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
          _count: { select: { submissions: true } },
        },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Web form not found' });
      return form;
    }),

  getByEmbedKey: publicProcedure
    .input(z.object({ embedKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const form = await ctx.prisma.crmWebForm.findFirst({
        where: { embed_key: input.embedKey, deleted_at: null, is_active: true },
        select: {
          id: true,
          name: true,
          fields: true,
          custom_css: true,
          success_message: true,
          redirect_url: true,
          embed_key: true,
        },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found or inactive' });
      return form;
    }),

  create: protectedProcedure
    .input(WebFormCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const embedKey = crypto.randomUUID().replace(/-/g, '');

      return ctx.prisma.crmWebForm.create({
        data: {
          organization_id: orgId,
          name: input.name,
          pipeline_id: input.pipeline_id ?? null,
          stage_id: input.stage_id ?? null,
          owner_id: input.owner_id ?? null,
          fields: input.fields,
          custom_css: input.custom_css ?? null,
          success_message: input.success_message ?? null,
          redirect_url: input.redirect_url ?? null,
          embed_key: embedKey,
          is_active: input.is_active,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: WebFormCreateSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const existing = await ctx.prisma.crmWebForm.findFirst({
        where: { id: input.id, organization_id: orgId, deleted_at: null },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Web form not found' });

      const { data } = input;
      return ctx.prisma.crmWebForm.update({
        where: { id: input.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.pipeline_id !== undefined && { pipeline_id: data.pipeline_id ?? null }),
          ...(data.stage_id !== undefined && { stage_id: data.stage_id ?? null }),
          ...(data.owner_id !== undefined && { owner_id: data.owner_id ?? null }),
          ...(data.fields !== undefined && { fields: data.fields }),
          ...(data.custom_css !== undefined && { custom_css: data.custom_css ?? null }),
          ...(data.success_message !== undefined && { success_message: data.success_message ?? null }),
          ...(data.redirect_url !== undefined && { redirect_url: data.redirect_url ?? null }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.crmWebForm.update({
        where: { id: input.id, organization_id: orgId },
        data: { deleted_at: new Date() },
      });
    }),

  submit: publicProcedure
    .input(
      z.object({
        embedKey: z.string(),
        data: z.record(z.unknown()),
        utmParams: z.object({
          utm_source: z.string().optional(),
          utm_medium: z.string().optional(),
          utm_campaign: z.string().optional(),
          utm_term: z.string().optional(),
          utm_content: z.string().optional(),
        }).optional(),
        referrer: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.prisma.crmWebForm.findFirst({
        where: { embed_key: input.embedKey, deleted_at: null, is_active: true },
        include: { organization: true },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      // Validate required fields
      const fields = form.fields as Array<{ key: string; required?: boolean; type: string }>;
      for (const field of fields) {
        if (field.required && !input.data[field.key]) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Field "${field.key}" is required`,
          });
        }
      }

      // Create or find contact from email field
      const emailField = fields.find((f) => f.type === 'email');
      let contactId: string | null = null;

      if (emailField && input.data[emailField.key]) {
        const email = String(input.data[emailField.key]);
        const nameField = fields.find((f) => f.key === 'first_name' || f.key === 'name');
        const firstName = nameField ? String(input.data[nameField.key] ?? 'Unknown') : 'Unknown';

        const existingContact = await ctx.prisma.crmContact.findFirst({
          where: { email, organization_id: form.organization_id, deleted_at: null },
        });

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const newContact = await ctx.prisma.crmContact.create({
            data: {
              organization_id: form.organization_id,
              first_name: firstName,
              email,
              source: 'web_form',
              source_detail: form.name,
              owner_id: form.owner_id ?? null,
              lifecycle_stage: 'lead',
              tags: [],
            },
          });
          contactId = newContact.id;
        }
      }

      // Create submission
      const submission = await ctx.prisma.crmWebFormSubmission.create({
        data: {
          form_id: form.id,
          data: input.data,
          contact_id: contactId ?? null,
          utm_source: input.utmParams?.utm_source ?? null,
          utm_medium: input.utmParams?.utm_medium ?? null,
          utm_campaign: input.utmParams?.utm_campaign ?? null,
          utm_term: input.utmParams?.utm_term ?? null,
          utm_content: input.utmParams?.utm_content ?? null,
          referrer: input.referrer ?? null,
        },
      });

      await ctx.prisma.crmWebForm.update({
        where: { id: form.id },
        data: { submissions_count: { increment: 1 } },
      });

      return {
        success: true,
        submissionId: submission.id,
        redirectUrl: form.redirect_url ?? null,
        successMessage: form.success_message ?? 'Thank you for your submission!',
      };
    }),

  getSubmissions: protectedProcedure
    .input(
      z.object({
        formId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.crmWebForm.findFirst({
        where: { id: input.formId, organization_id: orgId },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      const submissions = await ctx.prisma.crmWebFormSubmission.findMany({
        where: {
          form_id: input.formId,
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        take: (input.limit ?? 25) + 1,
        orderBy: { created_at: 'desc' },
        include: {
          contact: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      });

      let nextCursor: string | undefined;
      if (submissions.length > (input.limit ?? 25)) {
        const next = submissions.pop();
        nextCursor = next?.id;
      }

      return { submissions, nextCursor };
    }),
});
