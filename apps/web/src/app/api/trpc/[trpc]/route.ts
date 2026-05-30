import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/trpc";

const handler = (req: NextRequest) => {
  // Reject oversized batches to prevent batch-flooding attacks
  const url = new URL(req.url);
  const batchParam = url.searchParams.get('batch');
  if (batchParam && parseInt(batchParam) > 20) {
    return new Response(JSON.stringify({ error: 'Batch size exceeded' }), { status: 400 });
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError: ({ path, error }) => {
      if (process.env.NODE_ENV === "development") {
        console.error(`❌ tRPC error on '${path ?? "<no-path>"}':`, error);
      }
    },
  });
};

export { handler as GET, handler as POST };
