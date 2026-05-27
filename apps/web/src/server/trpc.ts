import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@zenflow/db";

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const session = await auth();
  return {
    session,
    prisma,
    req: opts.req,
  };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  if (!(ctx.session.user as { organizationId?: string }).organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No organization found" });
  }
  return next({
    ctx: {
      session: ctx.session as typeof ctx.session & {
        user: NonNullable<typeof ctx.session>["user"] & { organizationId: string };
      },
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
