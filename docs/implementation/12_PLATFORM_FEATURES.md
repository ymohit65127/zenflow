# 12 — Platform Features Implementation

**Stack:** Next.js 15 App Router · TypeScript 5 · tRPC v11 · Prisma v6 · PostgreSQL 16 · BullMQ · Redis · passport-saml · openid-client · speakeasy · @simplewebauthn/server

---

## 1. Overview

This document covers the six platform-wide cross-cutting concerns that underpin all ZenFlow modules: **Custom Fields**, **RBAC v2**, **Audit Logging**, **Notifications v2**, **API Platform**, and **SSO / MFA**. Each section includes the complete Prisma schema, tRPC procedures, business logic, and file paths.

---

## A. Custom Fields System

### A.1 Overview

Custom Fields lets admins extend any entity (CRM contact, deal, project, task, HR employee, helpdesk ticket, invoice, product, form submission) with additional typed columns — without schema migrations. Values are stored in `CustomFieldValue` and joined at query time. A formula engine evaluates expressions referencing other field keys.

### A.2 Database Schema

```prisma
model CustomFieldDefinition {
  id                    String         @id @default(cuid())
  org_id                String
  entity_type           EntityType
  name                  String         @db.VarChar(200)
  field_key             String         @db.VarChar(100)  // snake_case, auto-derived from name
  label                 String         @db.VarChar(200)
  field_type            CustomFieldType
  options               Json?          @db.JsonB
  // options for select/multi_select:
  // [{ label: "High", value: "high", color: "#ef4444" }]
  formula_expression    String?        @db.Text   // e.g. "{revenue} * {discount_rate} / 100"
  relation_entity_type  String?        @db.VarChar(50)
  is_required           Boolean        @default(false)
  default_value         String?        @db.Text
  min_value             Decimal?       @db.Decimal(15, 4)
  max_value             Decimal?       @db.Decimal(15, 4)
  max_length            Int?
  position              Int            @default(0)
  show_in_list          Boolean        @default(true)
  show_in_form          Boolean        @default(true)
  is_filterable         Boolean        @default(true)
  is_searchable         Boolean        @default(false)
  visibility            FieldVisibility @default(all)
  created_by            String         @db.VarChar(36)
  is_active             Boolean        @default(true)
  created_at            DateTime       @default(now())
  updated_at            DateTime       @updatedAt

  org    Organization        @relation(fields: [org_id], references: [id], onDelete: Cascade)
  values CustomFieldValue[]

  @@unique([org_id, entity_type, field_key])
  @@index([org_id, entity_type, is_active])
  @@map("custom_field_definitions")
}

model CustomFieldValue {
  id             String    @id @default(cuid())
  entity_type    String    @db.VarChar(50)
  entity_id      String    @db.VarChar(36)
  field_id       String
  value_text     String?   @db.Text
  value_number   Decimal?  @db.Decimal(15, 4)
  value_date     DateTime?
  value_boolean  Boolean?
  value_json     Json?     @db.JsonB
  // value_json used for: multi_select (string[]), person (user_id[]), file ({key,name,size}[]), relation (entity_id[])
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt

  field CustomFieldDefinition @relation(fields: [field_id], references: [id], onDelete: Cascade)

  @@unique([entity_id, field_id])
  @@index([entity_type, entity_id])
  @@map("custom_field_values")
}

enum EntityType {
  crm_contact
  crm_deal
  crm_account
  project
  task
  hr_employee
  ticket
  invoice
  product
  form_submission
}

enum CustomFieldType {
  text
  textarea
  number
  decimal
  date
  datetime
  boolean
  select
  multi_select
  person
  file
  url
  email
  phone
  formula
  relation
}

enum FieldVisibility { all admin_only owner_only }
```

### A.3 tRPC Router

```typescript
// apps/web/src/server/api/routers/custom-fields.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";

const fieldDefInput = z.object({
  entity_type:           z.nativeEnum(EntityType),
  name:                  z.string().min(1).max(200),
  label:                 z.string().max(200),
  field_type:            z.nativeEnum(CustomFieldType),
  options:               z.array(z.object({ label: z.string(), value: z.string(), color: z.string().optional() })).optional(),
  formula_expression:    z.string().optional(),
  relation_entity_type:  z.string().optional(),
  is_required:           z.boolean().default(false),
  default_value:         z.string().optional(),
  min_value:             z.number().optional(),
  max_value:             z.number().optional(),
  max_length:            z.number().int().optional(),
  position:              z.number().int().default(0),
  show_in_list:          z.boolean().default(true),
  show_in_form:          z.boolean().default(true),
  is_filterable:         z.boolean().default(true),
  is_searchable:         z.boolean().default(false),
  visibility:            z.enum(["all","admin_only","owner_only"]).default("all"),
});

export const customFieldsRouter = createTRPCRouter({

  "definitions.list": protectedProcedure
    .input(z.object({ entity_type: z.nativeEnum(EntityType) }))
    .query(async ({ ctx, input }) => {
      return db.customFieldDefinition.findMany({
        where: { org_id: ctx.org.id, entity_type: input.entity_type, is_active: true },
        orderBy: { position: "asc" },
      });
    }),

  "definitions.create": protectedProcedure
    .input(fieldDefInput)
    .mutation(async ({ ctx, input }) => {
      const field_key = toSnakeCase(input.name);
      return db.customFieldDefinition.create({
        data: { ...input, field_key, org_id: ctx.org.id, created_by: ctx.user.id },
      });
    }),

  "definitions.update": protectedProcedure
    .input(z.object({ id: z.string(), data: fieldDefInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      return db.customFieldDefinition.update({ where: { id: input.id }, data: input.data });
    }),

  "definitions.reorder": protectedProcedure
    .input(z.array(z.object({ id: z.string(), position: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      await db.$transaction(input.map(item =>
        db.customFieldDefinition.update({ where: { id: item.id }, data: { position: item.position } })
      ));
    }),

  "definitions.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.customFieldDefinition.update({ where: { id: input.id }, data: { is_active: false } });
    }),

  "values.get": protectedProcedure
    .input(z.object({ entity_type: z.string(), entity_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const values = await db.customFieldValue.findMany({
        where: { entity_type: input.entity_type, entity_id: input.entity_id },
        include: { field: true },
      });
      return values;
    }),

  "values.set": protectedProcedure
    .input(z.object({
      entity_type: z.string(),
      entity_id:   z.string(),
      field_id:    z.string(),
      value_text:    z.string().optional().nullable(),
      value_number:  z.number().optional().nullable(),
      value_date:    z.string().datetime().optional().nullable(),
      value_boolean: z.boolean().optional().nullable(),
      value_json:    z.any().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { entity_type, entity_id, field_id, ...values } = input;
      return db.customFieldValue.upsert({
        where: { entity_id_field_id: { entity_id, field_id } },
        create: { entity_type, entity_id, field_id, ...values },
        update: values,
      });
    }),

  "values.bulk_set": protectedProcedure
    .input(z.object({
      entity_type: z.string(),
      entity_id:   z.string(),
      values: z.array(z.object({
        field_id:      z.string(),
        value_text:    z.string().optional().nullable(),
        value_number:  z.number().optional().nullable(),
        value_date:    z.string().optional().nullable(),
        value_boolean: z.boolean().optional().nullable(),
        value_json:    z.any().optional().nullable(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.$transaction(input.values.map(v =>
        db.customFieldValue.upsert({
          where: { entity_id_field_id: { entity_id: input.entity_id, field_id: v.field_id } },
          create: { entity_type: input.entity_type, entity_id: input.entity_id, ...v },
          update: { value_text: v.value_text, value_number: v.value_number ? new Prisma.Decimal(v.value_number) : null,
                    value_date: v.value_date ? new Date(v.value_date) : null, value_boolean: v.value_boolean, value_json: v.value_json },
        })
      ));
    }),
});

function toSnakeCase(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
```

### A.4 Formula Engine

```typescript
// apps/web/src/lib/custom-fields/formula-engine.ts
export function evaluateFormula(expression: string, values: Record<string, number | null>): number | null {
  // Replace {field_key} placeholders with their numeric values
  let expr = expression;
  for (const [key, val] of Object.entries(values)) {
    if (val === null) return null;  // Short-circuit if any dependency is null
    expr = expr.replaceAll(`{${key}}`, String(val));
  }
  // Evaluate using a safe math-only evaluator (no eval())
  try {
    return Function(`"use strict"; return (${expr})`)() as number;
  } catch {
    return null;
  }
}
```

---

## B. RBAC v2

### B.1 Overview

RBAC v2 replaces the flat role system with a fully configurable role-permission matrix. Each permission entry targets a specific module + action combination and optionally restricts scope (all records, only owned, only team) and hides specific fields from the response.

### B.2 Database Schema

```prisma
model Role {
  id          String   @id @default(cuid())
  org_id      String
  name        String   @db.VarChar(100)
  description String?  @db.Text
  is_system   Boolean  @default(false)  // System roles (owner, admin, member) cannot be deleted
  color       String?  @db.VarChar(7)
  user_count  Int      @default(0)      // Cached for display
  created_at  DateTime @default(now())

  org         Organization     @relation(fields: [org_id], references: [id], onDelete: Cascade)
  permissions RolePermission[]
  members     UserRole[]

  @@index([org_id])
  @@map("roles")
}

model RolePermission {
  id                String          @id @default(cuid())
  role_id           String
  module            String          @db.VarChar(50)  // e.g. "crm", "hr", "documents", "chat"
  action            PermAction
  resource_scope    ResourceScope   @default(all)
  field_restrictions Json?          @db.JsonB        // ["phone", "salary"] — fields to hide
  created_at        DateTime        @default(now())

  role Role @relation(fields: [role_id], references: [id], onDelete: Cascade)

  @@unique([role_id, module, action])
  @@map("role_permissions")
}

model UserRole {
  id         String   @id @default(cuid())
  user_id    String
  role_id    String
  org_id     String
  assigned_by String? @db.VarChar(36)
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  role Role @relation(fields: [role_id], references: [id], onDelete: Cascade)

  @@unique([user_id, role_id])
  @@index([user_id, org_id])
  @@map("user_roles")
}

enum PermAction    { view create edit delete export import approve admin }
enum ResourceScope { all own team }
```

### B.3 Permission Checker Middleware

```typescript
// apps/web/src/lib/rbac/check-permission.ts
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";

interface PermCheck {
  userId:     string;
  orgId:      string;
  module:     string;
  action:     PermAction;
  ownerId?:   string;  // For `own` scope check
  teamId?:    string;  // For `team` scope check
  userTeamId?: string;
}

export async function checkPermission(check: PermCheck): Promise<ResourceScope> {
  const permissions = await db.$queryRaw<Array<{ resource_scope: string }>>`
    SELECT rp.resource_scope
    FROM role_permissions rp
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ${check.userId}
      AND ur.org_id  = ${check.orgId}
      AND rp.module  = ${check.module}
      AND rp.action  = ${check.action}
    LIMIT 1
  `;

  if (permissions.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${check.module}.${check.action}` });
  }

  const scope = permissions[0].resource_scope as ResourceScope;

  if (scope === "own" && check.ownerId !== check.userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access restricted to owned records" });
  }
  if (scope === "team" && check.teamId !== check.userTeamId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access restricted to team records" });
  }

  return scope;
}

export async function getFieldRestrictions(userId: string, orgId: string, module: string, action: PermAction): Promise<string[]> {
  const result = await db.$queryRaw<Array<{ field_restrictions: string[] }>>`
    SELECT rp.field_restrictions
    FROM role_permissions rp
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ${userId} AND ur.org_id = ${orgId}
      AND rp.module = ${module} AND rp.action = ${action}
    LIMIT 1
  `;
  return result[0]?.field_restrictions ?? [];
}
```

### B.4 tRPC Router

```typescript
// apps/web/src/server/api/routers/rbac.ts
export const rbacRouter = createTRPCRouter({
  "roles.list": protectedProcedure.query(async ({ ctx }) => {
    return db.role.findMany({ where: { org_id: ctx.org.id }, include: { permissions: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } });
  }),
  "roles.create": protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100), description: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => db.role.create({ data: { ...input, org_id: ctx.org.id } })),
  "roles.update": protectedProcedure
    .input(z.object({ id: z.string(), data: z.object({ name: z.string().optional(), description: z.string().optional(), color: z.string().optional() }) }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.role.findUniqueOrThrow({ where: { id: input.id } });
      if (role.is_system) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot modify system roles" });
      return db.role.update({ where: { id: input.id }, data: input.data });
    }),
  "roles.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.role.findUniqueOrThrow({ where: { id: input.id } });
      if (role.is_system) throw new TRPCError({ code: "FORBIDDEN" });
      return db.role.delete({ where: { id: input.id } });
    }),
  "permissions.set": protectedProcedure
    .input(z.object({ role_id: z.string(), module: z.string(), action: z.nativeEnum(PermAction), resource_scope: z.nativeEnum(ResourceScope).default("all"), field_restrictions: z.array(z.string()).optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.rolePermission.upsert({
        where: { role_id_module_action: { role_id: input.role_id, module: input.module, action: input.action } },
        create: input,
        update: { resource_scope: input.resource_scope, field_restrictions: input.field_restrictions },
      });
    }),
  "permissions.revoke": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => db.rolePermission.delete({ where: { id: input.id } })),
  "users.assign_role": protectedProcedure
    .input(z.object({ user_id: z.string(), role_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.userRole.upsert({
        where: { user_id_role_id: { user_id: input.user_id, role_id: input.role_id } },
        create: { user_id: input.user_id, role_id: input.role_id, org_id: ctx.org.id, assigned_by: ctx.user.id },
        update: {},
      });
    }),
  "users.revoke_role": protectedProcedure
    .input(z.object({ user_id: z.string(), role_id: z.string() }))
    .mutation(async ({ ctx, input }) => db.userRole.delete({ where: { user_id_role_id: { user_id: input.user_id, role_id: input.role_id } } })),
});
```

---

## C. Audit Log

### C.1 Overview

Every state-changing operation across all ZenFlow modules writes an immutable audit entry. Audit entries are append-only — no update or delete procedures. The viewer provides filterable, paginated access with diff display.

### C.2 Database Schema

```prisma
model AuditLog {
  id            String      @id @default(cuid())
  org_id        String
  actor_id      String      @db.VarChar(50)
  actor_type    ActorType
  actor_name    String      @db.VarChar(200)
  action        String      @db.VarChar(100)
  // action format: "module.entity.verb"  e.g. "crm.deal.stage_changed", "hr.employee.terminated"
  entity_type   String      @db.VarChar(50)
  entity_id     String      @db.VarChar(36)
  entity_name   String      @db.VarChar(500)
  old_data      Json?       @db.JsonB
  new_data      Json?       @db.JsonB
  ip_address    String?     @db.VarChar(45)
  user_agent    String?     @db.Text
  session_id    String?     @db.VarChar(36)
  api_token_id  String?     @db.VarChar(36)
  metadata      Json?       @db.JsonB   // Extra context specific to the action
  created_at    DateTime    @default(now())

  org Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)

  @@index([org_id, actor_id, created_at])
  @@index([entity_type, entity_id])
  @@index([org_id, action, created_at])
  @@index([org_id, created_at])
  @@map("audit_logs")
}

enum ActorType { user api_token system webhook }
```

### C.3 Audit Logger Utility

```typescript
// apps/web/src/lib/audit/audit-logger.ts
import { db } from "@/server/db";

export interface AuditLogInput {
  orgId:      string;
  actorId:    string;
  actorType:  ActorType;
  actorName:  string;
  action:     string;
  entityType: string;
  entityId:   string;
  entityName: string;
  oldData?:   object;
  newData?:   object;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  apiTokenId?: string;
  metadata?:  object;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  // Fire-and-forget: never let audit logging break the main operation
  db.auditLog.create({
    data: {
      org_id:       input.orgId,
      actor_id:     input.actorId,
      actor_type:   input.actorType,
      actor_name:   input.actorName,
      action:       input.action,
      entity_type:  input.entityType,
      entity_id:    input.entityId,
      entity_name:  input.entityName,
      old_data:     input.oldData,
      new_data:     input.newData,
      ip_address:   input.ipAddress,
      user_agent:   input.userAgent,
      session_id:   input.sessionId,
      api_token_id: input.apiTokenId,
      metadata:     input.metadata,
    },
  }).catch(err => console.error("[AuditLog] Failed to write:", err));
}

// tRPC middleware: inject req context into audit logger
export function createAuditContext(ctx: TRPCContext) {
  return {
    orgId:     ctx.org.id,
    actorId:   ctx.user.id,
    actorType: "user" as ActorType,
    actorName: ctx.user.name,
    ipAddress: ctx.req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: ctx.req.headers.get("user-agent") ?? undefined,
    sessionId: ctx.session.id,
  };
}
```

### C.4 tRPC Router

```typescript
export const auditLogRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      actor_id:    z.string().optional(),
      entity_type: z.string().optional(),
      entity_id:   z.string().optional(),
      action:      z.string().optional(),
      from:        z.string().datetime().optional(),
      to:          z.string().datetime().optional(),
      limit:       z.number().int().max(100).default(50),
      cursor:      z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return db.auditLog.findMany({
        where: {
          org_id:      ctx.org.id,
          actor_id:    input.actor_id,
          entity_type: input.entity_type,
          entity_id:   input.entity_id,
          ...(input.action && { action: { contains: input.action } }),
          ...(input.from || input.to) && { created_at: { gte: input.from ? new Date(input.from) : undefined, lte: input.to ? new Date(input.to) : undefined } },
          ...(input.cursor && { created_at: { lt: new Date(input.cursor) } }),
        },
        orderBy: { created_at: "desc" },
        take:    input.limit,
      });
    }),

  export: protectedProcedure
    .input(z.object({ from: z.string().datetime(), to: z.string().datetime(), format: z.enum(["csv","json"]).default("csv") }))
    .mutation(async ({ ctx, input }) => {
      const job = await auditExportQueue.add("audit-export", { org_id: ctx.org.id, from: input.from, to: input.to, format: input.format, user_id: ctx.user.id });
      return { job_id: job.id };
    }),
});
```

---

## D. Notifications v2

### D.1 Database Schema

```prisma
model Notification {
  id                 String      @id @default(cuid())
  user_id            String
  org_id             String
  notification_type  String      @db.VarChar(100)
  // Types: "mention", "task.assigned", "deal.stage_changed", "comment.reply", "doc.shared", etc.
  title              String      @db.VarChar(500)
  body               String?     @db.Text
  entity_type        String?     @db.VarChar(50)
  entity_id          String?     @db.VarChar(36)
  action_url         String?     @db.VarChar(500)
  is_read            Boolean     @default(false)
  read_at            DateTime?
  delivered_channels String[]    // ["in_app", "email"]
  created_by_type    CreatedByType @default(system)
  created_by_id      String?     @db.VarChar(36)
  created_at         DateTime    @default(now())

  user User         @relation(fields: [user_id], references: [id], onDelete: Cascade)
  org  Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)

  @@index([user_id, is_read, created_at])
  @@index([user_id, notification_type])
  @@map("notifications")
}

model NotificationPreference {
  id                  String   @id @default(cuid())
  user_id             String
  event_type          String   @db.VarChar(100)
  channels            Json     @db.JsonB  // {in_app:true, email:true, sms:false, push:true}
  schedule_quiet_start String?  @db.VarChar(5)    // "22:00"
  schedule_quiet_end   String?  @db.VarChar(5)    // "08:00"
  schedule_timezone    String?  @db.VarChar(100)
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, event_type])
  @@map("notification_preferences")
}

enum CreatedByType { user system workflow api }
```

### D.2 Notification Dispatcher

```typescript
// apps/web/src/lib/notifications/dispatcher.ts
import { db } from "@/server/db";
import { notificationQueue } from "@/lib/queues";

export interface NotificationPayload {
  userId:           string;
  orgId:            string;
  notificationType: string;
  title:            string;
  body?:            string;
  entityType?:      string;
  entityId?:        string;
  actionUrl?:       string;
  createdByType?:   CreatedByType;
  createdById?:     string;
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // 1. Check user preferences
  const pref = await db.notificationPreference.findFirst({
    where: { user_id: payload.userId, event_type: payload.notificationType },
  });
  const channels = pref?.channels as { in_app: boolean; email: boolean; sms: boolean; push: boolean }
    ?? { in_app: true, email: true, sms: false, push: false };

  // 2. Check quiet hours
  if (pref?.schedule_quiet_start && pref?.schedule_timezone) {
    const inQuiet = isInQuietHours(pref.schedule_quiet_start, pref.schedule_quiet_end!, pref.schedule_timezone);
    if (inQuiet) {
      channels.email = false;
      channels.sms   = false;
      channels.push  = false;
    }
  }

  const deliveredChannels: string[] = [];

  // 3. In-app notification (always stored in DB if enabled)
  if (channels.in_app) {
    await db.notification.create({ data: { ...payload, notification_type: payload.notificationType, delivered_channels: [], created_by_type: payload.createdByType ?? "system", created_by_id: payload.createdById } });
    deliveredChannels.push("in_app");
    // Push via Socket.io
    io.to(`user:${payload.userId}`).emit("notification", { ...payload });
  }

  // 4. Queue async channels
  if (channels.email) await notificationQueue.add("email", payload);
  if (channels.sms)   await notificationQueue.add("sms",   payload);
  if (channels.push)  await notificationQueue.add("push",  payload);
}

function isInQuietHours(start: string, end: string, tz: string): boolean {
  const now = new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: tz, hour: "2-digit", minute: "2-digit" });
  return start <= end ? (now >= start && now < end) : (now >= start || now < end);
}
```

### D.3 tRPC Router

```typescript
export const notificationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ unread_only: z.boolean().default(false), limit: z.number().int().max(100).default(30), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return db.notification.findMany({
        where: { user_id: ctx.user.id, ...(input.unread_only && { is_read: false }), ...(input.cursor && { created_at: { lt: new Date(input.cursor) } }) },
        orderBy: { created_at: "desc" },
        take: input.limit,
      });
    }),
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return db.notification.updateMany({ where: { id: { in: input.ids }, user_id: ctx.user.id }, data: { is_read: true, read_at: new Date() } });
    }),
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return db.notification.updateMany({ where: { user_id: ctx.user.id, is_read: false }, data: { is_read: true, read_at: new Date() } });
  }),
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return db.notification.count({ where: { user_id: ctx.user.id, is_read: false } });
  }),
  "preferences.get": protectedProcedure.query(async ({ ctx }) => {
    return db.notificationPreference.findMany({ where: { user_id: ctx.user.id } });
  }),
  "preferences.set": protectedProcedure
    .input(z.object({ event_type: z.string(), channels: z.object({ in_app: z.boolean(), email: z.boolean(), sms: z.boolean(), push: z.boolean() }), quiet_start: z.string().optional(), quiet_end: z.string().optional(), timezone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.notificationPreference.upsert({
        where: { user_id_event_type: { user_id: ctx.user.id, event_type: input.event_type } },
        create: { user_id: ctx.user.id, event_type: input.event_type, channels: input.channels, schedule_quiet_start: input.quiet_start, schedule_quiet_end: input.quiet_end, schedule_timezone: input.timezone },
        update: { channels: input.channels, schedule_quiet_start: input.quiet_start, schedule_quiet_end: input.quiet_end, schedule_timezone: input.timezone },
      });
    }),
});
```

---

## E. API Platform

### E.1 Database Schema

```prisma
model ApiToken {
  id                 String    @id @default(cuid())
  org_id             String
  name               String    @db.VarChar(200)
  token_hash         String    @unique @db.Char(64)  // SHA-256 of the actual token
  token_prefix       String    @db.VarChar(12)        // e.g. "zf_live_abcd" shown in UI
  created_by         String    @db.VarChar(36)
  scopes             String[]  // e.g. ["crm:read", "hr:write", "documents:read"]
  rate_limit_per_hour Int      @default(1000)
  last_used_at       DateTime?
  last_used_ip       String?   @db.VarChar(45)
  request_count      Int       @default(0)
  expires_at         DateTime?
  revoked_at         DateTime?
  created_at         DateTime  @default(now())

  org Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)

  @@index([token_hash])
  @@index([org_id, revoked_at])
  @@map("api_tokens")
}

model WebhookSubscription {
  id               String   @id @default(cuid())
  org_id           String
  name             String   @db.VarChar(200)
  url              String   @db.VarChar(500)
  secret           String   @db.VarChar(120)   // HMAC signing secret
  events           String[]  // e.g. ["crm.deal.created", "hr.leave.approved"]
  is_active        Boolean  @default(true)
  last_triggered_at DateTime?
  failure_count    Int      @default(0)
  created_by       String   @db.VarChar(36)
  created_at       DateTime @default(now())

  org       Organization      @relation(fields: [org_id], references: [id], onDelete: Cascade)
  deliveries WebhookDelivery[]

  @@index([org_id, is_active])
  @@map("webhook_subscriptions")
}

model WebhookDelivery {
  id              String           @id @default(cuid())
  subscription_id String
  event_type      String           @db.VarChar(100)
  payload         String           @db.Text
  response_status Int?
  response_body   String?          @db.Text
  attempts        Int              @default(0)
  max_attempts    Int              @default(3)
  next_retry_at   DateTime?
  status          DeliveryStatus2  @default(pending)
  delivered_at    DateTime?
  created_at      DateTime         @default(now())

  subscription WebhookSubscription @relation(fields: [subscription_id], references: [id], onDelete: Cascade)

  @@index([subscription_id, status])
  @@index([status, next_retry_at])
  @@map("webhook_deliveries")
}

enum DeliveryStatus2 { pending delivered failed }
```

### E.2 API Token Service

```typescript
// apps/web/src/lib/api/token-service.ts
import crypto from "crypto";

export function generateApiToken(): { raw: string; hash: string; prefix: string } {
  const raw    = `zf_live_${crypto.randomBytes(32).toString("hex")}`;
  const hash   = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
```

### E.3 API Token Middleware (Rate Limiting)

```typescript
// apps/web/src/middleware/api-auth.ts
import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { db } from "@/server/db";
import { hashToken } from "@/lib/api/token-service";

export async function authenticateApiToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const raw  = authHeader.slice(7);
  const hash = hashToken(raw);

  const token = await db.apiToken.findFirst({
    where: { token_hash: hash, revoked_at: null, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
  });
  if (!token) return null;

  // Rate limit check using Redis sliding window
  const windowKey = `api_rate:${token.id}:${Math.floor(Date.now() / 3_600_000)}`;
  const count = await redis.incr(windowKey);
  if (count === 1) await redis.expire(windowKey, 3600);
  if (count > token.rate_limit_per_hour) return { error: "rate_limit_exceeded" };

  // Update usage stats (fire and forget)
  db.apiToken.update({ where: { id: token.id }, data: { last_used_at: new Date(), last_used_ip: req.headers.get("x-forwarded-for"), request_count: { increment: 1 } } }).catch(() => {});

  return token;
}
```

### E.4 Webhook Dispatcher

```typescript
// apps/web/src/lib/api/webhook-dispatcher.ts
import crypto from "crypto";
import { db } from "@/server/db";
import { webhookQueue } from "@/lib/queues";

export async function dispatchWebhookEvent(orgId: string, eventType: string, payload: object): Promise<void> {
  const subs = await db.webhookSubscription.findMany({
    where: { org_id: orgId, is_active: true, events: { has: eventType } },
  });
  for (const sub of subs) {
    const delivery = await db.webhookDelivery.create({
      data: { subscription_id: sub.id, event_type: eventType, payload: JSON.stringify(payload), status: "pending" },
    });
    await webhookQueue.add("deliver", { delivery_id: delivery.id });
  }
}

// BullMQ worker for webhook delivery with exponential backoff
export async function deliverWebhook(deliveryId: string): Promise<void> {
  const delivery = await db.webhookDelivery.findUniqueOrThrow({
    where: { id: deliveryId }, include: { subscription: true },
  });
  const { subscription } = delivery;
  const body    = delivery.payload;
  const hmac    = crypto.createHmac("sha256", subscription.secret).update(body).digest("hex");
  const headers = { "Content-Type": "application/json", "X-ZenFlow-Signature": `sha256=${hmac}`, "X-ZenFlow-Event": delivery.event_type };

  try {
    const res = await fetch(subscription.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
    const resBody = await res.text().catch(() => "");
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: res.ok ? "delivered" : "failed", response_status: res.status, response_body: resBody.slice(0, 2000), attempts: { increment: 1 }, delivered_at: res.ok ? new Date() : null },
    });
    if (!res.ok) await db.webhookSubscription.update({ where: { id: subscription.id }, data: { failure_count: { increment: 1 } } });
  } catch (err) {
    const nextAttempt = delivery.attempts + 1;
    const delayMs = Math.min(Math.pow(2, nextAttempt) * 30_000, 3_600_000); // max 1h
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attempts: { increment: 1 }, status: nextAttempt >= delivery.max_attempts ? "failed" : "pending", next_retry_at: new Date(Date.now() + delayMs) },
    });
  }
}
```

### E.5 tRPC Router

```typescript
export const apiPlatformRouter = createTRPCRouter({
  "tokens.list": protectedProcedure.query(async ({ ctx }) => {
    return db.apiToken.findMany({ where: { org_id: ctx.org.id, revoked_at: null }, select: { id: true, name: true, token_prefix: true, scopes: true, rate_limit_per_hour: true, last_used_at: true, request_count: true, expires_at: true, created_at: true } });
  }),
  "tokens.create": protectedProcedure
    .input(z.object({ name: z.string().min(1).max(200), scopes: z.array(z.string()), rate_limit_per_hour: z.number().int().default(1000), expires_in_days: z.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { raw, hash, prefix } = generateApiToken();
      const token = await db.apiToken.create({
        data: { org_id: ctx.org.id, name: input.name, token_hash: hash, token_prefix: prefix, scopes: input.scopes, rate_limit_per_hour: input.rate_limit_per_hour, created_by: ctx.user.id, expires_at: input.expires_in_days ? new Date(Date.now() + input.expires_in_days * 86_400_000) : null },
      });
      return { ...token, raw };  // raw token shown ONCE — never stored
    }),
  "tokens.revoke": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => db.apiToken.update({ where: { id: input.id, org_id: ctx.org.id }, data: { revoked_at: new Date() } })),
  "webhooks.list": protectedProcedure.query(async ({ ctx }) => db.webhookSubscription.findMany({ where: { org_id: ctx.org.id }, include: { _count: { select: { deliveries: true } } } })),
  "webhooks.create": protectedProcedure
    .input(z.object({ name: z.string().min(1).max(200), url: z.string().url(), events: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const secret = crypto.randomBytes(32).toString("hex");
      return db.webhookSubscription.create({ data: { ...input, org_id: ctx.org.id, secret, created_by: ctx.user.id } });
    }),
  "webhooks.delete": protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => db.webhookSubscription.update({ where: { id: input.id }, data: { is_active: false } })),
  "webhooks.deliveries": protectedProcedure
    .input(z.object({ subscription_id: z.string(), limit: z.number().int().max(50).default(20) }))
    .query(async ({ ctx, input }) => db.webhookDelivery.findMany({ where: { subscription_id: input.subscription_id }, orderBy: { created_at: "desc" }, take: input.limit })),
  "webhooks.redeliver": protectedProcedure
    .input(z.object({ delivery_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.webhookDelivery.update({ where: { id: input.delivery_id }, data: { status: "pending", attempts: 0 } });
      await webhookQueue.add("deliver", { delivery_id: input.delivery_id });
    }),
});
```

---

## F. SSO / MFA

### F.1 Database Schema

```prisma
model SsoConfig {
  id             String      @id @default(cuid())
  org_id         String      @unique
  provider       SsoProvider
  config         Json        @db.JsonB
  // SAML config:   { idp_url, entity_id, x509_cert, sp_acs_url, attribute_mapping }
  // OIDC config:   { discovery_url, client_id, client_secret, scopes }
  // Google WS:     { client_id, client_secret, hd (hosted domain) }
  // Microsoft:     { tenant_id, client_id, client_secret }
  // Okta/Auth0:    { domain, client_id, client_secret }
  is_enabled     Boolean     @default(false)
  require_sso    Boolean     @default(false)  // Force all users to use SSO
  domain_hint    String[]                      // Auto-redirect if email matches domain
  created_by     String      @db.VarChar(36)
  created_at     DateTime    @default(now())
  updated_at     DateTime    @updatedAt

  org Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  @@map("sso_configs")
}

model MfaConfig {
  id                String     @id @default(cuid())
  user_id           String     @unique
  method            MfaMethod
  secret_enc        String?    @db.VarChar(500)  // AES-256-GCM encrypted TOTP secret
  backup_codes_enc  String?    @db.Text           // JSON array of 10 hashed backup codes
  phone_number      String?    @db.VarChar(20)
  is_enabled        Boolean    @default(false)
  enabled_at        DateTime?
  last_used_at      DateTime?
  created_at        DateTime   @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  @@map("mfa_configs")
}

model Session {
  id               String    @id @default(cuid())
  user_id          String
  session_token    String    @unique @db.Char(64)
  ip_address       String?   @db.VarChar(45)
  user_agent       String?   @db.Text
  device_name      String?   @db.VarChar(255)
  location_country String?   @db.VarChar(100)
  location_city    String?   @db.VarChar(100)
  is_current       Boolean   @default(false)
  last_active_at   DateTime  @default(now())
  expires_at       DateTime
  revoked_at       DateTime?
  created_at       DateTime  @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, revoked_at])
  @@index([session_token])
  @@map("sessions")
}

enum SsoProvider { saml oidc google_workspace microsoft okta auth0 }
enum MfaMethod   { totp sms email webauthn }
```

### F.2 MFA Implementation

```typescript
// apps/web/src/lib/mfa/totp.ts
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { encryptAES, decryptAES } from "@/lib/crypto";

export function generateTotpSecret(userEmail: string, orgName: string) {
  const secret = speakeasy.generateSecret({ name: `${orgName} (${userEmail})`, length: 32 });
  return { secret: secret.base32, otpauth_url: secret.otpauth_url! };
}

export async function generateTotpQrCode(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl);
}

export function verifyTotpCode(encryptedSecret: string, code: string): boolean {
  const secret = decryptAES(encryptedSecret);
  return speakeasy.totp.verify({ secret, encoding: "base32", token: code, window: 1 });
}

export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain  = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString("hex").toUpperCase());
  const hashed = plain.map(c => crypto.createHash("sha256").update(c).digest("hex"));
  return { plain, hashed };
}

export function verifyBackupCode(hashedCodes: string[], submittedCode: string): { valid: boolean; remainingCodes: string[] } {
  const hash  = crypto.createHash("sha256").update(submittedCode.toUpperCase()).digest("hex");
  const index = hashedCodes.indexOf(hash);
  if (index === -1) return { valid: false, remainingCodes: hashedCodes };
  const remainingCodes = hashedCodes.filter((_, i) => i !== index);
  return { valid: true, remainingCodes };
}
```

### F.3 SAML SSO Handler

```typescript
// apps/web/src/app/api/auth/sso/saml/[orgId]/route.ts
import { Strategy as SamlStrategy } from "passport-saml";
import { db } from "@/server/db";

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  const ssoConfig = await db.ssoConfig.findFirst({ where: { org_id: params.orgId, is_enabled: true, provider: "saml" } });
  if (!ssoConfig) return new Response("SSO not configured", { status: 404 });

  const cfg = ssoConfig.config as { idp_url: string; entity_id: string; x509_cert: string };
  const strategy = new SamlStrategy({
    entryPoint: cfg.idp_url,
    issuer:     cfg.entity_id,
    cert:       cfg.x509_cert,
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/saml/${params.orgId}/callback`,
  }, async (profile, done) => {
    // Map SAML attributes to user record
    const email = profile.nameID ?? profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
    const user = await db.user.findFirst({ where: { email, org_id: params.orgId } });
    done(null, user ?? false);
  });

  // Initiate SAML redirect
  return new Response(null, { status: 302, headers: { Location: cfg.idp_url } });
}
```

### F.4 tRPC Router

```typescript
export const ssoMfaRouter = createTRPCRouter({
  // SSO
  "sso.get": protectedProcedure.query(async ({ ctx }) => {
    return db.ssoConfig.findFirst({ where: { org_id: ctx.org.id } });
  }),
  "sso.configure": protectedProcedure
    .input(z.object({ provider: z.nativeEnum(SsoProvider), config: z.any(), require_sso: z.boolean().default(false), domain_hint: z.array(z.string()).optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.ssoConfig.upsert({
        where:  { org_id: ctx.org.id },
        create: { org_id: ctx.org.id, ...input, created_by: ctx.user.id },
        update: { provider: input.provider, config: input.config, require_sso: input.require_sso, domain_hint: input.domain_hint ?? [] },
      });
    }),
  "sso.toggle": protectedProcedure
    .input(z.object({ is_enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => db.ssoConfig.update({ where: { org_id: ctx.org.id }, data: { is_enabled: input.is_enabled } })),

  // MFA
  "mfa.setup_totp": protectedProcedure.mutation(async ({ ctx }) => {
    const { secret, otpauth_url } = generateTotpSecret(ctx.user.email, ctx.org.name);
    const qrCode = await generateTotpQrCode(otpauth_url);
    // Temporarily cache secret in Redis for verification step
    await redis.setEx(`mfa:setup:${ctx.user.id}`, 300, secret);
    return { qrCode, secret };  // secret shown once for manual entry
  }),
  "mfa.verify_totp_setup": protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const secret = await redis.get(`mfa:setup:${ctx.user.id}`);
      if (!secret) throw new TRPCError({ code: "BAD_REQUEST", message: "Setup session expired" });
      const valid = speakeasy.totp.verify({ secret, encoding: "base32", token: input.code, window: 1 });
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code" });

      const { plain, hashed } = await generateBackupCodes();
      await db.mfaConfig.upsert({
        where:  { user_id: ctx.user.id },
        create: { user_id: ctx.user.id, method: "totp", secret_enc: encryptAES(secret), backup_codes_enc: JSON.stringify(hashed), is_enabled: true, enabled_at: new Date() },
        update: { secret_enc: encryptAES(secret), backup_codes_enc: JSON.stringify(hashed), is_enabled: true, enabled_at: new Date() },
      });
      await redis.del(`mfa:setup:${ctx.user.id}`);
      return { backup_codes: plain };  // shown once
    }),
  "mfa.disable": protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mfa = await db.mfaConfig.findUniqueOrThrow({ where: { user_id: ctx.user.id } });
      if (!verifyTotpCode(mfa.secret_enc!, input.code)) throw new TRPCError({ code: "UNAUTHORIZED" });
      return db.mfaConfig.update({ where: { user_id: ctx.user.id }, data: { is_enabled: false } });
    }),
  "mfa.get_status": protectedProcedure.query(async ({ ctx }) => {
    const mfa = await db.mfaConfig.findFirst({ where: { user_id: ctx.user.id }, select: { is_enabled: true, method: true, enabled_at: true, last_used_at: true } });
    return mfa ?? { is_enabled: false };
  }),

  // Sessions
  "sessions.list": protectedProcedure.query(async ({ ctx }) => {
    return db.session.findMany({ where: { user_id: ctx.user.id, revoked_at: null, expires_at: { gt: new Date() } }, orderBy: { last_active_at: "desc" } });
  }),
  "sessions.revoke": protectedProcedure
    .input(z.object({ session_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.session.update({ where: { id: input.session_id, user_id: ctx.user.id }, data: { revoked_at: new Date() } });
    }),
  "sessions.revoke_all_others": protectedProcedure.mutation(async ({ ctx }) => {
    return db.session.updateMany({ where: { user_id: ctx.user.id, is_current: false, revoked_at: null }, data: { revoked_at: new Date() } });
  }),
});
```

---

## G. Files Structure

```
apps/web/src/
├── app/
│   ├── (dashboard)/
│   │   └── settings/
│   │       ├── custom-fields/
│   │       │   └── page.tsx              # Custom field definitions manager
│   │       ├── roles/
│   │       │   └── page.tsx              # RBAC role + permission matrix editor
│   │       ├── audit-log/
│   │       │   └── page.tsx              # Filterable audit log viewer
│   │       ├── notifications/
│   │       │   └── page.tsx              # Per-event notification preference matrix
│   │       ├── api/
│   │       │   ├── tokens/page.tsx       # API token management
│   │       │   └── webhooks/page.tsx     # Outgoing webhook subscriptions
│   │       └── security/
│   │           ├── sso/page.tsx          # SSO provider configuration
│   │           ├── mfa/page.tsx          # User MFA setup/disable
│   │           └── sessions/page.tsx     # Active session management
│   └── api/
│       └── auth/
│           └── sso/
│               └── [provider]/
│                   └── [orgId]/
│                       ├── route.ts      # SSO initiation
│                       └── callback/route.ts
├── components/
│   └── settings/
│       ├── CustomFieldsTable.tsx
│       ├── CustomFieldDrawer.tsx         # Create/edit field form
│       ├── RolePermissionMatrix.tsx      # Checkbox grid: role x module x action
│       ├── AuditLogTable.tsx
│       ├── AuditLogFilters.tsx
│       ├── NotificationPreferenceTable.tsx
│       ├── ApiTokenList.tsx
│       ├── ApiTokenCreate.tsx
│       ├── WebhookList.tsx
│       ├── WebhookDeliveryLog.tsx
│       ├── SsoConfigForm.tsx             # Dynamic form based on provider
│       ├── MfaSetupWizard.tsx            # QR code step, verify step, backup codes step
│       └── SessionList.tsx
├── lib/
│   ├── rbac/
│   │   ├── check-permission.ts
│   │   └── use-permission.ts             # React hook: usePermission("crm", "edit")
│   ├── audit/
│   │   └── audit-logger.ts
│   ├── notifications/
│   │   └── dispatcher.ts
│   ├── api/
│   │   ├── token-service.ts
│   │   └── webhook-dispatcher.ts
│   ├── mfa/
│   │   └── totp.ts
│   └── custom-fields/
│       ├── formula-engine.ts
│       └── field-renderer.tsx            # Renders correct input for any field type
└── server/
    └── api/
        └── routers/
            ├── custom-fields.ts
            ├── rbac.ts
            ├── audit-log.ts
            ├── notifications.ts
            ├── api-platform.ts
            └── sso-mfa.ts
```

---

## H. npm Packages

```json
{
  "passport-saml": "^3.x",
  "openid-client": "^5.x",
  "speakeasy": "^2.x",
  "qrcode": "^1.x",
  "@simplewebauthn/server": "^9.x",
  "@simplewebauthn/browser": "^9.x",
  "crypto": "built-in (Node.js)",
  "ioredis": "^5.x"
}
```

---

## I. Environment Variables

```bash
# Encryption key for MFA secrets (32 bytes hex)
MFA_ENCRYPTION_KEY=your_32_byte_hex_key_here

# SSO Callback base URL
NEXT_PUBLIC_APP_URL=https://app.zenflow.io

# Token prefix
API_TOKEN_ENV=live   # or "test"

# WebAuthn
WEBAUTHN_RPID=app.zenflow.io
WEBAUTHN_ORIGIN=https://app.zenflow.io
WEBAUTHN_RP_NAME=ZenFlow

# Rate limiting Redis
REDIS_URL=redis://localhost:6379
```

---

## J. Cross-cutting Integration Notes

### Injecting Custom Field Values

Every entity list query (e.g. CRM contacts, deals) should accept a `include_custom_fields: boolean` parameter and LEFT JOIN the `custom_field_values` table:

```typescript
// Pattern for any entity router
const contacts = await db.crmContact.findMany({ where: { org_id: ctx.org.id } });
if (input.include_custom_fields) {
  const fieldDefs  = await db.customFieldDefinition.findMany({ where: { org_id: ctx.org.id, entity_type: "crm_contact", is_active: true } });
  const entityIds  = contacts.map(c => c.id);
  const allValues  = await db.customFieldValue.findMany({ where: { entity_type: "crm_contact", entity_id: { in: entityIds } } });
  return contacts.map(c => ({
    ...c,
    custom_fields: fieldDefs.map(def => ({ ...def, value: allValues.find(v => v.entity_id === c.id && v.field_id === def.id) })),
  }));
}
return contacts;
```

### Audit Logging Pattern

Wrap every mutation with the audit logger after the database operation succeeds:

```typescript
// In any router mutation, after db.XXX.update(...)
await writeAuditLog({
  ...createAuditContext(ctx),
  action:     "crm.deal.stage_changed",
  entityType: "crm_deal",
  entityId:   deal.id,
  entityName: deal.title,
  oldData:    { stage: oldDeal.stage },
  newData:    { stage: deal.stage },
});
```

### Permission Check Pattern

Every tRPC procedure that reads or mutates sensitive data must call `checkPermission` before the DB query:

```typescript
// Example: HR employee data
"hr.employees.list": protectedProcedure.query(async ({ ctx }) => {
  const scope = await checkPermission({ userId: ctx.user.id, orgId: ctx.org.id, module: "hr", action: "view" });
  const where = scope === "own" ? { id: ctx.user.id } : scope === "team" ? { team_id: ctx.user.team_id } : {};
  const hiddenFields = await getFieldRestrictions(ctx.user.id, ctx.org.id, "hr", "view");
  const employees = await db.hrEmployee.findMany({ where: { org_id: ctx.org.id, ...where } });
  return employees.map(e => omit(e, hiddenFields));
}),
```
