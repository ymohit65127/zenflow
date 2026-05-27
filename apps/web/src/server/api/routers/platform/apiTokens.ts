import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

// Uses existing ApiKey model: id, organization_id, name, key_hash, key_prefix, scopes, last_used_at, expires_at, is_active, created_at

function generateApiToken(): { raw: string; hash: string; prefix: string } {
  const raw = `zf_live_${crypto.randomBytes(32).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 10) + "...";
  return { raw, hash, prefix };
}

export const apiTokensRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId as string;
    return ctx.prisma.apiKey.findMany({
      where: { organization_id: orgId, is_active: true },
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
        name: z.string().min(1).max(200),
        scopes: z.array(z.string()).min(1),
        rate_limit_per_hour: z.number().int().min(1).max(100000).default(1000),
        expires_in_days: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const { raw, hash, prefix } = generateApiToken();

      const token = await ctx.prisma.apiKey.create({
        data: {
          organization_id: orgId,
          name: input.name,
          key_hash: hash,
          key_prefix: prefix,
          scopes: input.scopes,
          expires_at: input.expires_in_days
            ? new Date(Date.now() + input.expires_in_days * 86_400_000)
            : null,
          is_active: true,
        },
      });

      // Return raw key ONCE — never stored
      return { ...token, raw };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId as string;
      const token = await ctx.prisma.apiKey.findFirst({
        where: { id: input.id, organization_id: orgId },
      });
      if (!token) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.apiKey.update({
        where: { id: input.id },
        data: { is_active: false },
      });
    }),
});
