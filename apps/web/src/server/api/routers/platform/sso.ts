import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";

// SSO config stored in organization settings JSON (no dedicated SsoConfig model in current schema)
// org.settings.sso: { provider, config, require_sso, domain_hint, is_enabled }

const SsoProviderEnum = z.enum([
  "saml",
  "oidc",
  "google_workspace",
  "microsoft",
  "okta",
  "auth0",
]);

export const ssoRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const org = await ctx.prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const sso = (org?.settings as any)?.sso ?? null;
    return sso;
  }),

  configure: protectedProcedure
    .input(
      z.object({
        provider: SsoProviderEnum,
        config: z.record(z.unknown()),
        require_sso: z.boolean().default(false),
        domain_hint: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const org = await ctx.prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      });
      const existing = (org?.settings as any) ?? {};
      await ctx.prisma.organization.update({
        where: { id: orgId },
        data: {
          settings: {
            ...existing,
            sso: {
              provider: input.provider,
              config: input.config,
              require_sso: input.require_sso,
              domain_hint: input.domain_hint ?? [],
              is_enabled: existing.sso?.is_enabled ?? false,
            },
          },
        },
      });
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ is_enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const org = await ctx.prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      });
      const existing = (org?.settings as any) ?? {};
      const sso = existing.sso ?? {};
      await ctx.prisma.organization.update({
        where: { id: orgId },
        data: {
          settings: {
            ...existing,
            sso: { ...sso, is_enabled: input.is_enabled },
          },
        },
      });
      return { success: true };
    }),

  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    const org = await ctx.prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const existing = (org?.settings as any) ?? {};
    const { sso: _, ...rest } = existing;
    await ctx.prisma.organization.update({
      where: { id: orgId },
      data: { settings: rest },
    });
    return { success: true };
  }),
});
