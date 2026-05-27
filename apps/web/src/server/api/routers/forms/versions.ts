import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const versionsRouter = createTRPCRouter({
  /** List version history for a form */
  list: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formVersion.findMany({
        where: { form_id: input.formId },
        orderBy: { version_number: 'desc' },
        select: {
          id: true,
          version_number: true,
          changed_by: true,
          change_note: true,
          created_at: true,
          // Omit fields_info for list view to keep payload small
        },
      });
    }),

  /** Get a specific version's fields_info snapshot */
  get: protectedProcedure
    .input(z.object({ formId: z.string().uuid(), versionNumber: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const version = await (ctx.prisma as any).formVersion.findUnique({
        where: {
          form_id_version_number: {
            form_id: input.formId,
            version_number: input.versionNumber,
          },
        },
      });
      if (!version) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });
      return version;
    }),

  /**
   * Restore a form to a previous version's fields_info.
   * Creates a new version snapshot before overwriting.
   */
  restore: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        versionNumber: z.number().int().min(1),
        changeNote: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const actorId = ctx.session.user.id as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetVersion = await (ctx.prisma as any).formVersion.findUnique({
        where: {
          form_id_version_number: {
            form_id: input.formId,
            version_number: input.versionNumber,
          },
        },
      });
      if (!targetVersion) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });

      // Get current max version number to create next snapshot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latest = await (ctx.prisma as any).formVersion.findFirst({
        where: { form_id: input.formId },
        orderBy: { version_number: 'desc' },
        select: { version_number: true },
      });
      const newVersionNum = ((latest?.version_number as number) ?? 0) + 1;

      // Snapshot current state before restore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentFieldsInfo = (form as any).fields_info;
      if (currentFieldsInfo !== null && currentFieldsInfo !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (ctx.prisma as any).formVersion.create({
          data: {
            form_id: input.formId,
            version_number: newVersionNum,
            fields_info: currentFieldsInfo as object,
            changed_by: actorId,
            change_note: `Auto-snapshot before restore to v${input.versionNumber}`,
          },
        });
      }

      // Apply restored fields_info
      const restoredFields = targetVersion.fields_info as object;
      return ctx.prisma.form.update({
        where: { id: input.formId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { fields_info: restoredFields } as Parameters<typeof ctx.prisma.form.update>[0]['data'],
      });
    }),

  /** Snapshot the current form fields into a new version entry */
  snapshot: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        changeNote: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const actorId = ctx.session.user.id as string;
      const form = await ctx.prisma.form.findFirst({
        where: { id: input.formId, organization_id: orgId, deleted_at: null },
      });
      if (!form) throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latest = await (ctx.prisma as any).formVersion.findFirst({
        where: { form_id: input.formId },
        orderBy: { version_number: 'desc' },
        select: { version_number: true },
      });
      const newVersionNum = ((latest?.version_number as number) ?? 0) + 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fieldsInfo = (form as any).fields_info ?? [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.prisma as any).formVersion.create({
        data: {
          form_id: input.formId,
          version_number: newVersionNum,
          fields_info: fieldsInfo as object,
          changed_by: actorId,
          change_note: input.changeNote ?? null,
        },
      });
    }),
});
