import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

export const settingsRouter = createTRPCRouter({
  // -----------------------------------------------------------------------
  // PROFILE
  // -----------------------------------------------------------------------
  profile: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.session.user.id as string;
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar_url: true,
          timezone: true,
          locale: true,
          two_factor_enabled: true,
          email_verified: true,
          last_login_at: true,
          created_at: true,
          is_owner: true,
        },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

    update: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100).optional(),
          phone: z.string().max(30).nullable().optional(),
          timezone: z.string().max(64).optional(),
          locale: z.string().max(10).optional(),
          avatar_url: z.string().url().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id as string;
        const user = await ctx.prisma.user.update({
          where: { id: userId },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.phone !== undefined && { phone: input.phone }),
            ...(input.timezone !== undefined && { timezone: input.timezone }),
            ...(input.locale !== undefined && { locale: input.locale }),
            ...(input.avatar_url !== undefined && { avatar_url: input.avatar_url }),
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar_url: true,
            timezone: true,
            locale: true,
          },
        });
        return user;
      }),

    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id as string;
        const user = await ctx.prisma.user.findUnique({
          where: { id: userId },
          select: { password_hash: true },
        });
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!user.password_hash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This account uses social login and has no password.",
          });
        }
        const valid = await bcrypt.compare(input.currentPassword, user.password_hash);
        if (!valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Current password is incorrect.",
          });
        }
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await ctx.prisma.user.update({
          where: { id: userId },
          data: { password_hash: newHash },
        });
        return { success: true };
      }),
  }),

  // -----------------------------------------------------------------------
  // ORGANIZATION
  // -----------------------------------------------------------------------
  org: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      const org = await ctx.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          logo_url: true,
          timezone: true,
          locale: true,
          currency: true,
          plan: true,
          plan_expires_at: true,
          max_users: true,
          is_active: true,
          settings: true,
          created_at: true,
          _count: { select: { users: { where: { is_active: true, deleted_at: null } } } },
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });
      return org;
    }),

    update: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(100).optional(),
          timezone: z.string().max(64).optional(),
          currency: z.string().max(10).optional(),
          locale: z.string().max(10).optional(),
          logo_url: z.string().url().nullable().optional(),
          domain: z.string().max(255).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;
        const org = await ctx.prisma.organization.update({
          where: { id: orgId },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.timezone !== undefined && { timezone: input.timezone }),
            ...(input.currency !== undefined && { currency: input.currency }),
            ...(input.locale !== undefined && { locale: input.locale }),
            ...(input.logo_url !== undefined && { logo_url: input.logo_url }),
            ...(input.domain !== undefined && { domain: input.domain }),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            locale: true,
            logo_url: true,
            domain: true,
          },
        });
        return org;
      }),
  }),

  // -----------------------------------------------------------------------
  // TEAM
  // -----------------------------------------------------------------------
  team: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      const users = await ctx.prisma.user.findMany({
        where: { organization_id: orgId, deleted_at: null },
        select: {
          id: true,
          name: true,
          email: true,
          avatar_url: true,
          is_active: true,
          is_owner: true,
          last_login_at: true,
          created_at: true,
          user_roles: {
            select: {
              role: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { created_at: "asc" },
      });
      return users;
    }),

    invite: protectedProcedure
      .input(
        z.object({
          email: z.string().email(),
          roleId: z.string().uuid().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;

        // Check if user already in org
        const existing = await ctx.prisma.user.findFirst({
          where: { organization_id: orgId, email: input.email, deleted_at: null },
        });
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This email is already a member of your organization.",
          });
        }

        // Cancel existing pending invite for same email
        await ctx.prisma.invitation.updateMany({
          where: { organization_id: orgId, email: input.email, status: "PENDING" },
          data: { status: "CANCELLED" },
        });

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitation = await ctx.prisma.invitation.create({
          data: {
            organization_id: orgId,
            email: input.email,
            role_id: input.roleId ?? null,
            token,
            status: "PENDING",
            expires_at: expiresAt,
          },
        });
        return invitation;
      }),

    cancelInvite: protectedProcedure
      .input(z.object({ inviteId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;
        const invite = await ctx.prisma.invitation.findFirst({
          where: { id: input.inviteId, organization_id: orgId },
        });
        if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
        await ctx.prisma.invitation.update({
          where: { id: input.inviteId },
          data: { status: "CANCELLED" },
        });
        return { success: true };
      }),

    listInvitations: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.invitation.findMany({
        where: { organization_id: orgId, status: "PENDING" },
        orderBy: { created_at: "desc" },
      });
    }),

    updateRole: protectedProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          roleId: z.string().uuid(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;
        // Verify user is in same org
        const user = await ctx.prisma.user.findFirst({
          where: { id: input.userId, organization_id: orgId, deleted_at: null },
        });
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });

        // Verify role is in same org
        const role = await ctx.prisma.role.findFirst({
          where: { id: input.roleId, organization_id: orgId },
        });
        if (!role) throw new TRPCError({ code: "NOT_FOUND" });

        // Remove all existing roles, add new one
        await ctx.prisma.userRole.deleteMany({ where: { user_id: input.userId } });
        await ctx.prisma.userRole.create({
          data: { user_id: input.userId, role_id: input.roleId },
        });
        return { success: true };
      }),

    removeUser: protectedProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;
        const currentUserId = ctx.session.user.id as string;

        if (input.userId === currentUserId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot remove yourself.",
          });
        }

        const user = await ctx.prisma.user.findFirst({
          where: { id: input.userId, organization_id: orgId },
        });
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (user.is_owner) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot remove the organization owner.",
          });
        }

        await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { is_active: false },
        });
        return { success: true };
      }),

    listRoles: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.role.findMany({
        where: { organization_id: orgId },
        orderBy: { name: "asc" },
      });
    }),
  }),

  // -----------------------------------------------------------------------
  // API KEYS
  // -----------------------------------------------------------------------
  apiKeys: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      return ctx.prisma.apiKey.findMany({
        where: { organization_id: orgId },
        select: {
          id: true,
          name: true,
          key_prefix: true,
          scopes: true,
          last_used_at: true,
          expires_at: true,
          is_active: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      });
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          scopes: z.array(z.enum(["read", "write", "admin"])).min(1),
          expiresAt: z.string().datetime().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;

        // Generate a random 40-char key: prefix "zf_" + 37 random hex chars
        const rawKey = `zf_${crypto.randomBytes(24).toString("hex")}`;
        const keyPrefix = rawKey.slice(0, 10) + "...";
        const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

        const apiKey = await ctx.prisma.apiKey.create({
          data: {
            organization_id: orgId,
            name: input.name,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            scopes: input.scopes,
            expires_at: input.expiresAt ? new Date(input.expiresAt) : null,
            is_active: true,
          },
          select: {
            id: true,
            name: true,
            key_prefix: true,
            scopes: true,
            expires_at: true,
            is_active: true,
            created_at: true,
          },
        });

        // Return the full raw key ONCE — it is not stored
        return { ...apiKey, fullKey: rawKey };
      }),

    revoke: protectedProcedure
      .input(z.object({ keyId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.session.user.organizationId as string;
        const key = await ctx.prisma.apiKey.findFirst({
          where: { id: input.keyId, organization_id: orgId },
        });
        if (!key) throw new TRPCError({ code: "NOT_FOUND" });
        await ctx.prisma.apiKey.update({
          where: { id: input.keyId },
          data: { is_active: false },
        });
        return { success: true };
      }),
  }),

  // -----------------------------------------------------------------------
  // BILLING
  // -----------------------------------------------------------------------
  billing: createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.session.user.organizationId as string;
      const org = await ctx.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          plan: true,
          plan_expires_at: true,
          max_users: true,
          _count: { select: { users: { where: { is_active: true, deleted_at: null } } } },
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const subscription = await ctx.prisma.subscription.findFirst({
        where: { organization_id: orgId },
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          plan: true,
          status: true,
          billing_cycle: true,
          amount: true,
          currency: true,
          started_at: true,
          expires_at: true,
          cancelled_at: true,
        },
      });

      return {
        plan: org.plan,
        plan_expires_at: org.plan_expires_at,
        max_users: org.max_users,
        current_users: org._count.users,
        subscription,
      };
    }),
  }),
});
