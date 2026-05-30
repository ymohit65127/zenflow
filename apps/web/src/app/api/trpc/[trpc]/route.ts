import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/trpc";

const ALLOWED_ORIGIN = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST',
  'Access-Control-Allow-Headers': 'Content-Type, trpc-batch-mode',
  'Access-Control-Max-Age': '86400',
};

const handler = (req: NextRequest) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    responseMeta() {
      return { headers: corsHeaders };
    },
    onError: ({ path, error }) => {
      if (process.env.NODE_ENV === "development") {
        console.error(`tRPC error on '${path ?? "<no-path>"}':`, error);
      }
    },
  });
};

export { handler as GET, handler as POST, handler as OPTIONS };
