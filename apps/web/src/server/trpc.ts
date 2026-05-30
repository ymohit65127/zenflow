import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@zenflow/db";

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  // CSRF: reject requests whose Origin header doesn't match the host
  const origin = opts.req.headers.get('origin');
  const host =
    opts.req.headers.get('host') ?? opts.req.headers.get('x-forwarded-host');
  if (origin) {
    let originHost: string;
    try { originHost = new URL(origin).host; } catch { originHost = ''; }
    if (originHost && host && originHost !== host) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Cross-origin request rejected' });
    }
  }

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
    const isInternal = error.code === 'INTERNAL_SERVER_ERROR';
    const message = isInternal && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : shape.message;
    return {
      ...shape,
      message,
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
