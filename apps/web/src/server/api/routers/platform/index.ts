import { createTRPCRouter } from "@/server/trpc";
import { rolesRouter } from "./roles";
import { customFieldsRouter } from "./customFields";
import { auditLogRouter } from "./auditLog";
import { notificationsRouter } from "./notifications";
import { apiTokensRouter } from "./apiTokens";
import { webhooksRouter } from "./webhooks";
import { ssoRouter } from "./sso";
import { mfaRouter } from "./mfa";

export const platformRouter = createTRPCRouter({
  roles: rolesRouter,
  customFields: customFieldsRouter,
  auditLog: auditLogRouter,
  notifications: notificationsRouter,
  apiTokens: apiTokensRouter,
  webhooks: webhooksRouter,
  sso: ssoRouter,
  mfa: mfaRouter,
});
