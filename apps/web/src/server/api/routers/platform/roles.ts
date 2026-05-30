import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from '@/lib/audit';

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
      const orgId = ctx.session.user.organizationId as string;
      const role = await ctx.prisma.role.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Role not found or access denied" });
      if (role.is_system) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot modify system roles" });
      }
      return ctx.prisma.role.update({ where: { id: input.id }, data: input.data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const role = await ctx.prisma.role.findFirst({ where: { id: input.id, organization_id: orgId } });
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Role not found or access denied" });
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
      const orgId = ctx.session.user.organizationId as string;
      // Verify role belongs to this org
      const role = await ctx.prisma.role.findFirst({ where: { id: input.role_id, organization_id: orgId } });
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Role not found or access denied" });

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
      const orgId = ctx.session.user.organizationId as string;
      // Verify the rolePermission's role belongs to this org
      const rp = await ctx.prisma.rolePermission.findFirst({
        where: { id: input.id, role: { organization_id: orgId } },
      });
      if (!rp) throw new TRPCError({ code: "FORBIDDEN", message: "Role not found or access denied" });
      return ctx.prisma.rolePermission.delete({ where: { id: input.id } });
    }),

  assignRole: protectedProcedure
    .input(z.object({ user_id: z.string(), role_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // Verify both role and user belong to this org
      const role = await ctx.prisma.role.findFirst({ where: { id: input.role_id, organization_id: orgId } });
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Role not found or access denied" });
      const user = await ctx.prisma.user.findFirst({ where: { id: input.user_id, organization_id: orgId } });
      if (!user) throw new TRPCError({ code: "FORBIDDEN", message: "User not found or access denied" });
      const result = await ctx.prisma.userRole.upsert({
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
      void logAudit(ctx.prisma, {
        orgId,
        userId: ctx.session.user.id as string,
        action: 'ROLE_ASSIGNED',
        resourceType: 'user_role',
        resourceId: input.user_id,
        after: { role_id: input.role_id },
      });
      return result;
    }),

  revokeRole: protectedProcedure
    .input(z.object({ user_id: z.string(), role_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      // Verify both role and user belong to this org
      const role = await ctx.prisma.role.findFirst({ where: { id: input.role_id, organization_id: orgId } });
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "Role not found or access denied" });
      const user = await ctx.prisma.user.findFirst({ where: { id: input.user_id, organization_id: orgId } });
      if (!user) throw new TRPCError({ code: "FORBIDDEN", message: "User not found or access denied" });
      const deleted = await ctx.prisma.userRole.delete({
        where: {
          user_id_role_id: {
            user_id: input.user_id,
            role_id: input.role_id,
          },
        },
      });
      void logAudit(ctx.prisma, {
        orgId,
        userId: ctx.session.user.id as string,
        action: 'ROLE_REVOKED',
        resourceType: 'user_role',
        resourceId: input.user_id,
        before: { role_id: input.role_id },
      });
      return deleted;
    }),

  listMembers: protectedProcedure
    .input(z.object({ role_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.userRole.findMany({
        where: { role_id: input.role_id, role: { organization_id: orgId } },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
        },
      });
    }),
});
