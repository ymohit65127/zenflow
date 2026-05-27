import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const MODULES = [
  "crm",
  "projects",
  "hr",
  "helpdesk",
  "accounting",
  "inventory",
  "forms",
  "analytics",
  "documents",
  "chat",
  "workflows",
  "settings",
];

const ACTIONS = ["view", "create", "edit", "delete", "export", "admin"] as const;

export const rolesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.role.findMany({
      where: { organization_id: orgId },
      include: {
        role_permissions: {
          include: { permission: true },
        },
        _count: { select: { user_roles: true } },
      },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.role.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          organization_id: orgId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.prisma.role.findFirst({ where: { id: input.id } });
      if (!role) throw new TRPCError({ code: "NOT_FOUND" });
      if (role.is_system) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot modify system roles" });
      }
      return ctx.prisma.role.update({ where: { id: input.id }, data: input.data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.prisma.role.findFirst({ where: { id: input.id } });
      if (!role) throw new TRPCError({ code: "NOT_FOUND" });
      if (role.is_system) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete system roles" });
      }
      return ctx.prisma.role.delete({ where: { id: input.id } });
    }),

  // Get or create permission record for module+action combo
  // Since existing schema uses Permission model (module, resource, action),
  // we use module as "module", action as "action", resource as "all"
  setPermission: protectedProcedure
    .input(
      z.object({
        role_id: z.string(),
        module: z.string().min(1).max(50),
        action: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find or create the Permission record
      const perm = await ctx.prisma.permission.upsert({
        where: {
          module_resource_action: {
            module: input.module,
            resource: "all",
            action: input.action,
          },
        },
        create: {
          module: input.module,
          resource: "all",
          action: input.action,
          description: `${input.module}.${input.action}`,
        },
        update: {},
      });

      // Create role_permission if not exists
      return ctx.prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: input.role_id,
            permission_id: perm.id,
          },
        },
        create: {
          role_id: input.role_id,
          permission_id: perm.id,
        },
        update: {},
      });
    }),

  revokePermission: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.rolePermission.delete({ where: { id: input.id } });
    }),

  assignRole: protectedProcedure
    .input(z.object({ user_id: z.string(), role_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userRole.upsert({
        where: {
          user_id_role_id: {
            user_id: input.user_id,
            role_id: input.role_id,
          },
        },
        create: {
          user_id: input.user_id,
          role_id: input.role_id,
        },
        update: {},
      });
    }),

  revokeRole: protectedProcedure
    .input(z.object({ user_id: z.string(), role_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userRole.delete({
        where: {
          user_id_role_id: {
            user_id: input.user_id,
            role_id: input.role_id,
          },
        },
      });
    }),

  listMembers: protectedProcedure
    .input(z.object({ role_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.userRole.findMany({
        where: { role_id: input.role_id },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
        },
      });
    }),
});
