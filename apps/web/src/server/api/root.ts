import { createTRPCRouter } from "@/server/trpc";
import { crmRouter } from "@/server/api/routers/crm";
import { projectsRouter } from "@/server/api/routers/projects";
import { hrRouter } from "@/server/api/routers/hr";
import { helpdeskRouter } from "@/server/api/routers/helpdesk";
import { accountingRouter } from "@/server/api/routers/accounting";
import { inventoryRouter } from "@/server/api/routers/inventory";
import { formsRouter } from "@/server/api/routers/forms";
import { analyticsRouter } from "@/server/api/routers/analytics";
import { workflowsRouter } from "@/server/api/routers/workflows";
import { documentsRouter } from "@/server/api/routers/documents";
import { chatRouter } from "@/server/api/routers/chat";
import { settingsRouter } from "@/server/api/routers/settings";

export const appRouter = createTRPCRouter({
  crm: crmRouter,
  projects: projectsRouter,
  hr: hrRouter,
  helpdesk: helpdeskRouter,
  accounting: accountingRouter,
  inventory: inventoryRouter,
  forms: formsRouter,
  analytics: analyticsRouter,
  workflows: workflowsRouter,
  documents: documentsRouter,
  chat: chatRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
