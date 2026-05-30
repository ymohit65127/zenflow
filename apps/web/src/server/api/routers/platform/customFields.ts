import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { Prisma } from "@zenflow/db";

// Uses existing CustomField model:
// id, organization_id, module, entity_type, label, field_key, field_type(enum), options(Json), is_required, sort_order, created_at

const CustomFieldTypeEnum = z.enum([
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "URL",
  "EMAIL",
  "PHONE",
]);

const fieldInput = z.object({
  module: z.string().min(1).max(50),
  entity_type: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  field_key: z.string().min(1).max(100),
  field_type: CustomFieldTypeEnum,
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        color: z.string().optional(),
      })
    )
    .optional(),
  is_required: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export const customFieldsRouter = createTRPCRouter({
  "definitions.list": protectedProcedure
    .input(
      z.object({
        entity_type: z.string().optional(),
        module: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.customField.findMany({
        where: {
          organization_id: orgId,
          ...(input.entity_type && { entity_type: input.entity_type }),
          ...(input.module && { module: input.module }),
        },
        orderBy: { sort_order: "asc" },
      });
    }),

  "definitions.create": protectedProcedure
    .input(fieldInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const field_key = input.field_key || toSnakeCase(input.label);
      return ctx.prisma.customField.create({
        data: {
          organization_id: orgId,
          module: input.module,
          entity_type: input.entity_type,
          label: input.label,
          field_key,
          field_type: input.field_type as any,
          options: input.options !== undefined ? input.options as Prisma.InputJsonValue : Prisma.JsonNull,
          is_required: input.is_required,
          sort_order: input.sort_order,
        },
      });
    }),

  "definitions.update": protectedProcedure
    .input(z.object({ id: z.string(), data: fieldInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.customField.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  "definitions.reorder": protectedProcedure
    .input(z.array(z.object({ id: z.string(), position: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.map((item) =>
          ctx.prisma.customField.update({
            where: { id: item.id },
            data: { sort_order: item.position },
          })
        )
      );
      return { success: true };
    }),

  "definitions.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.customField.delete({ where: { id: input.id } });
    }),

  // Custom field values are stored as JSON on each entity (e.g., crm_contact.custom_fields)
  // These procedures are stubs for the value get/set pattern
  "values.get": protectedProcedure
    .input(z.object({ entity_type: z.string(), entity_id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Values are stored on entity records directly as custom_fields JSON
      // This is a placeholder — actual retrieval depends on entity type
      return [];
    }),

  "values.set": protectedProcedure
    .input(
      z.object({
        entity_type: z.string(),
        entity_id: z.string(),
        field_key: z.string(),
        value: z.unknown(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Values are stored directly on entity records as custom_fields JSON
      // This is a generic handler — type-specific updates handled per-entity router
      return { success: true };
    }),
});
