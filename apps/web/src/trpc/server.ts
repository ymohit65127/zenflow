import "server-only";
import { createCallerFactory, createTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/api/root";
import { headers } from "next/headers";
import { type NextRequest } from "next/server";

const createContext = async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({
    req: new Request("http://internal/trpc", { headers: heads }) as unknown as NextRequest,
  });
};

const createCaller = createCallerFactory(appRouter);

export const api = createCaller(createContext);
