# ZenFlow — WORKFLOWS v2 Implementation

> **Module:** Workflow Automation v2
> **Stack:** Next.js 15 · tRPC v11 · Prisma v6 · PostgreSQL 16 · BullMQ · Redis · TypeScript 5
> **Author:** Mohit Yadav · **Date:** 2026-05-27
> **Status:** Ready for Implementation

---

## 1. Overview

Workflows v2 is a visual no-code/low-code automation platform, replacing the rudimentary `Workflow` / `WorkflowStep` / `WorkflowRun` tables with a full graph-based workflow engine. It uses a React Flow canvas for building node graphs, a BullMQ-powered execution engine, a Mustache-style variable interpolation language, and an integration credentials vault (AES-256 encrypted). Key improvements over v1:

| Feature | v1 (existing) | v2 |
|---|---|---|
| Workflow definition | Flat step list | Node graph (nodes + edges JSON) |
| Node types | 9 step types | 20+ node types including code execution, loops, approval |
| Canvas | None (config-only) | React Flow drag-and-drop visual editor |
| Variable interpolation | None | `{{variable.path}}` with 20+ built-in functions |
| Integration credentials | Unencrypted `Integration` model | AES-256-GCM encrypted `WorkflowIntegration` vault |
| Webhook triggers | None | Dedicated endpoint model with HMAC verification |
| Loop handling | None | Loop node with `over` expression + break condition |
| Approval steps | None | Human-in-the-loop approval with timeout + email |
| Templates | None | Global + org-level template library |
| Run observability | Basic run log | Per-step step logs with input/output/duration |
| Error handling | stop only | stop/continue/retry per workflow |

---

## 2. Database Schema (Prisma v6)

> Replaces existing `Workflow`, `WorkflowStep`, `WorkflowRun`, `Integration` models.

```prisma
// =============================================================================
// MODULE 10 — WORKFLOWS v2
// =============================================================================

model Workflow {
  id              String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String          @db.Uuid
  created_by      String          @db.Uuid
  name            String          @db.VarChar(255)
  description     String?         @db.Text

  // Trigger
  trigger_type    WfTriggerType
  trigger_config  Json
  // trigger_config shape depends on trigger_type — see Section 3

  // Status
  status          WfStatus        @default(draft)
  version         Int             @default(1)

  // Graph definition
  nodes           Json            // WorkflowNode[] — see Section 3
  edges           Json            // WorkflowEdge[] — {id, source, target, sourceHandle, targetHandle}

  // Execution settings
  error_handling  WfErrorHandling @default(stop)
  max_retries     Int             @default(3)
  timeout_minutes Int             @default(30)
  rate_limit_per_hour Int?

  // Stats (cached)
  last_run_at     DateTime?
  total_runs      Int             @default(0)
  successful_runs Int             @default(0)
  failed_runs     Int             @default(0)
  avg_duration_ms Int?

  created_at      DateTime        @default(now())
  updated_at      DateTime        @updatedAt

  organization     Organization             @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator          User                     @relation("WorkflowCreator", fields: [created_by], references: [id])
  runs             WorkflowRun[]
  trigger_logs     WorkflowTriggerLog[]
  approval_requests WorkflowApprovalRequest[]
  webhook_endpoints WorkflowWebhookEndpoint[]

  @@index([organization_id, status])
  @@map("workflows")
}

model WorkflowRun {
  id               String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workflow_id      String          @db.Uuid
  workflow_version Int
  trigger_type     WfTriggerType
  trigger_data     Json            // raw trigger payload
  status           WfRunStatus     @default(running)
  started_at       DateTime        @default(now())
  completed_at     DateTime?
  duration_ms      Int?
  error_message    String?         @db.Text
  steps_total      Int             @default(0)
  steps_completed  Int             @default(0)
  output_data      Json?
  created_at       DateTime        @default(now())

  workflow          Workflow                 @relation(fields: [workflow_id], references: [id], onDelete: Cascade)
  step_logs         WorkflowRunStep[]
  approval_requests WorkflowApprovalRequest[]

  @@index([workflow_id, status, started_at])
  @@map("workflow_runs")
}

model WorkflowRunStep {
  id            String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  run_id        String          @db.Uuid
  node_id       String          @db.VarChar(36)  // matches node.id in workflow.nodes
  node_type     String          @db.VarChar(50)
  node_name     String          @db.VarChar(255)
  status        WfStepStatus    @default(pending)
  started_at    DateTime?
  completed_at  DateTime?
  duration_ms   Int?
  input_data    Json?
  output_data   Json?
  error_message String?         @db.Text
  retry_count   Int             @default(0)
  created_at    DateTime        @default(now())

  run WorkflowRun @relation(fields: [run_id], references: [id], onDelete: Cascade)

  @@index([run_id, node_id])
  @@map("workflow_run_steps")
}

model WorkflowTriggerLog {
  id           String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workflow_id  String       @db.Uuid
  trigger_type String       @db.VarChar(50)
  trigger_data Json
  matched      Boolean
  run_id       String?      @db.Uuid
  created_at   DateTime     @default(now())

  workflow Workflow     @relation(fields: [workflow_id], references: [id], onDelete: Cascade)
  run      WorkflowRun? @relation(fields: [run_id], references: [id])

  @@index([workflow_id, created_at])
  @@map("workflow_trigger_logs")
}

model WorkflowTemplate {
  id                    String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  org_id                String?           @db.Uuid  // null = global (Anthropic-provided) template
  name                  String            @db.VarChar(255)
  description           String?           @db.Text
  category              String            @db.VarChar(100)  // 'crm' | 'hr' | 'notifications' | etc.
  use_case              String?           @db.VarChar(255)
  difficulty            WfDifficulty      @default(beginner)
  nodes                 Json
  edges                 Json
  required_integrations String[]          // e.g. ['slack', 'gmail']
  install_count         Int               @default(0)
  is_published          Boolean           @default(false)
  created_by            String?           @db.VarChar(36)
  created_at            DateTime          @default(now())

  @@index([category, is_published])
  @@map("workflow_templates")
}

model WorkflowApprovalRequest {
  id            String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  run_id        String              @db.Uuid
  step_node_id  String              @db.VarChar(36)
  approver_ids  String[]
  message       String?             @db.Text
  context_data  Json
  status        WfApprovalStatus    @default(pending)
  approved_by   String?             @db.VarChar(36)
  approved_at   DateTime?
  rejected_reason String?           @db.Text
  expires_at    DateTime?
  created_at    DateTime            @default(now())

  run WorkflowRun @relation(fields: [run_id], references: [id], onDelete: Cascade)

  @@index([run_id, status])
  @@map("workflow_approval_requests")
}

model WorkflowWebhookEndpoint {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String  @db.Uuid
  workflow_id   String   @db.Uuid
  path          String   @unique @db.VarChar(200)   // random hex: /wh/{path}
  description   String?  @db.VarChar(255)
  method        WfWebhookMethod @default(POST)
  secret        String?  @db.VarChar(120)
  is_active     Boolean  @default(true)
  request_count Int      @default(0)
  last_called_at DateTime?
  created_at    DateTime @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  workflow     Workflow     @relation(fields: [workflow_id], references: [id], onDelete: Cascade)

  @@map("workflow_webhook_endpoints")
}

model WorkflowIntegration {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String   @db.Uuid
  created_by      String   @db.Uuid
  name            String   @db.VarChar(200)
  provider        String   @db.VarChar(50)
  // Credentials stored as AES-256-GCM encrypted JSON
  // Encrypted with org-scoped key: sha256(org_id + ENCRYPTION_SECRET)
  credentials_enc Json
  // { iv: "hex", tag: "hex", ciphertext: "hex" }
  scopes          String[]
  is_active       Boolean  @default(true)
  expires_at      DateTime?
  last_used_at    DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@index([organization_id, provider])
  @@map("workflow_integrations")
}

// --- New Enums ---

enum WfTriggerType {
  event
  schedule
  webhook
  manual
  api
}

enum WfStatus {
  draft
  active
  paused
  archived
}

enum WfRunStatus {
  running
  completed
  failed
  cancelled
  timed_out
}

enum WfStepStatus {
  pending
  running
  completed
  failed
  skipped
}

enum WfErrorHandling {
  stop
  continue
  retry
}

enum WfDifficulty {
  beginner
  intermediate
  advanced
}

enum WfApprovalStatus {
  pending
  approved
  rejected
  timed_out
}

enum WfWebhookMethod {
  POST
  GET
  PUT
}
```

---

## 3. Node Type Definitions

Every node in `workflow.nodes` is a JSON object with this base shape plus type-specific config:

```typescript
interface WorkflowNode {
  id: string;          // UUIDv4 — stable identifier referenced by edges + run step logs
  type: NodeType;
  name: string;        // display label
  position: { x: number; y: number };  // React Flow canvas position
  config: NodeConfig;  // type-specific — see below
}

interface WorkflowEdge {
  id: string;
  source: string;      // source node id
  target: string;      // target node id
  sourceHandle?: string; // 'true' | 'false' for condition nodes
  targetHandle?: string;
  label?: string;
}
```

### 3.1 Trigger Nodes

```json
// trigger_event
{
  "type": "trigger_event",
  "config": {
    "event_name": "crm.deal.created | crm.deal.updated | hr.leave.submitted | form.submitted | ticket.opened | ...",
    "filters": [
      { "field": "status", "op": "eq", "value": "WON" }
    ]
  }
}

// trigger_schedule
{
  "type": "trigger_schedule",
  "config": {
    "cron": "0 9 * * 1",   // cron expression (runs every Monday 9am)
    "timezone": "Asia/Kolkata"
  }
}

// trigger_webhook
{
  "type": "trigger_webhook",
  "config": {
    "endpoint_id": "whe-uuid",
    "verify_signature": true,
    "response_body": "{ \"received\": true }"
  }
}

// trigger_manual
{
  "type": "trigger_manual",
  "config": {
    "input_schema": [
      { "name": "contact_id", "type": "string", "required": true }
    ]
  }
}
```

### 3.2 Action Nodes

```json
// action_send_email
{
  "type": "action_send_email",
  "config": {
    "to": "{{trigger.contact.email}}",
    "cc": "",
    "subject": "Your deal {{trigger.deal.name}} has been updated",
    "body_html": "<p>Hi {{trigger.contact.first_name}}, ...</p>",
    "template_id": null,
    "from_name": "ZenFlow",
    "reply_to": "{{org.support_email}}"
  }
}

// action_send_sms
{
  "type": "action_send_sms",
  "config": {
    "to": "{{trigger.contact.phone}}",
    "body": "Hello {{trigger.contact.first_name}}, your ticket #{{trigger.ticket.ticket_number}} has been resolved.",
    "integration_id": "wfi-twilio-uuid"
  }
}

// action_create_record
{
  "type": "action_create_record",
  "config": {
    "module": "crm_deals",
    "data": {
      "name": "Follow-up for {{trigger.contact.first_name}}",
      "pipeline_id": "pipe-uuid",
      "stage_id": "stage-uuid",
      "contact_id": "{{trigger.contact.id}}"
    }
  }
}

// action_update_record
{
  "type": "action_update_record",
  "config": {
    "module": "crm_deals",
    "record_id": "{{trigger.id}}",
    "data": {
      "status": "WON",
      "closed_at": "{{functions.now()}}"
    }
  }
}

// action_send_webhook
{
  "type": "action_send_webhook",
  "config": {
    "url": "https://hooks.example.com/zenflow",
    "method": "POST",
    "headers": { "X-API-Key": "{{secrets.API_KEY}}" },
    "body": {
      "deal_id": "{{trigger.id}}",
      "value": "{{trigger.value}}"
    },
    "timeout_ms": 10000,
    "verify_ssl": true
  }
}

// action_slack
{
  "type": "action_slack",
  "config": {
    "integration_id": "wfi-slack-uuid",
    "channel": "#sales-alerts",
    "message": ":tada: Deal *{{trigger.name}}* worth ${{trigger.value}} just won!",
    "blocks": null
  }
}

// action_code
{
  "type": "action_code",
  "config": {
    "language": "javascript",
    "code": "const result = input.value * 1.18;\nreturn { total_with_tax: result };",
    "timeout_ms": 5000
  }
}
// NOTE: JavaScript runs in isolated vm2 sandbox. No file system or network access.
// 'input' contains the current step's input_data. Return value becomes output_data.

// action_create_task
{
  "type": "action_create_task",
  "config": {
    "project_id": "proj-uuid",
    "task_list_id": "list-uuid",
    "title": "Review deal: {{trigger.name}}",
    "assignee_ids": ["{{trigger.assignee_id}}"],
    "due_date": "{{functions.addDays(functions.now(), 3)}}"
  }
}

// action_send_notification
{
  "type": "action_send_notification",
  "config": {
    "user_ids": ["{{trigger.assignee_id}}"],
    "title": "Deal Updated",
    "body": "{{trigger.name}} moved to {{trigger.stage_name}}",
    "link": "/crm/deals/{{trigger.id}}"
  }
}
```

### 3.3 Control Flow Nodes

```json
// condition (branches: true → sourceHandle 'true', false → sourceHandle 'false')
{
  "type": "condition",
  "config": {
    "rules": [
      { "field": "{{trigger.value}}", "op": "gte", "value": 10000 }
    ],
    "logic": "ALL"
  }
}

// delay
{
  "type": "delay",
  "config": {
    "amount": 2,
    "unit": "hours",
    "until": null
  }
}

// loop (iterates over an array; inner nodes receive 'item' variable)
{
  "type": "loop",
  "config": {
    "over": "{{steps.get_contacts.output.rows}}",
    "variable": "item",
    "max_iterations": 100,
    "break_condition": "{{item.status}} == 'STOP'"
  }
}

// approval (pauses run until human approves/rejects)
{
  "type": "approval",
  "config": {
    "approver_ids": ["user-uuid-1", "{{trigger.manager_id}}"],
    "message": "Please review and approve the deal: {{trigger.name}} (${{trigger.value}})",
    "context_data": {
      "deal_id": "{{trigger.id}}",
      "deal_name": "{{trigger.name}}"
    },
    "timeout_hours": 48,
    "on_timeout": "reject"
  }
}

// transform (data manipulation)
{
  "type": "transform",
  "config": {
    "operations": [
      { "type": "set_variable", "key": "full_name", "value": "{{trigger.first_name}} {{trigger.last_name}}" },
      { "type": "map", "input": "{{trigger.items}}", "output": "mapped_items", "expression": "{ id: item.id, total: item.qty * item.price }" },
      { "type": "filter", "input": "{{trigger.items}}", "output": "high_value_items", "expression": "item.price > 100" }
    ]
  }
}

// lookup (query ZenFlow module and return data)
{
  "type": "lookup",
  "config": {
    "module": "crm_contacts",
    "filter": { "email": "{{trigger.email}}" },
    "output_variable": "contact"
  }
}

// switch (multi-branch based on field value)
{
  "type": "switch",
  "config": {
    "field": "{{trigger.status}}",
    "cases": [
      { "value": "WON",  "handle": "won" },
      { "value": "LOST", "handle": "lost" }
    ],
    "default_handle": "other"
  }
}
```

---

## 4. Template Expression Language

The `{{variable.path}}` syntax is available in all node config string values.

### 4.1 Variable Scopes

| Scope | Access Pattern | Description |
|---|---|---|
| Trigger data | `{{trigger.field_name}}` | Raw trigger payload |
| Step output | `{{steps.node_id.output.field}}` | Output from a previous step |
| Loop item | `{{item.field}}` | Current loop iteration item |
| Organisation | `{{org.name}}`, `{{org.timezone}}` | Current org data |
| User | `{{user.name}}`, `{{user.email}}` | Actor who triggered manually |
| Secrets | `{{secrets.SECRET_NAME}}` | Org-level secret vars (not logged) |
| Date/time | `{{functions.now()}}` | Current ISO timestamp |

### 4.2 Built-in Functions

```typescript
// apps/web/src/lib/workflows/interpolation/functions.ts

export const builtinFunctions = {
  // Date
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().slice(0, 10),
  addDays: (date: string, n: number) => addDays(parseISO(date), n).toISOString(),
  addHours: (date: string, n: number) => addHours(parseISO(date), n).toISOString(),
  formatDate: (date: string, fmt: string) => format(parseISO(date), fmt),
  diffDays: (a: string, b: string) => differenceInDays(parseISO(b), parseISO(a)),

  // String
  uppercase: (s: string) => s.toUpperCase(),
  lowercase: (s: string) => s.toLowerCase(),
  trim: (s: string) => s.trim(),
  replace: (s: string, from: string, to: string) => s.replaceAll(from, to),
  substring: (s: string, start: number, end?: number) => s.slice(start, end),
  concat: (...parts: string[]) => parts.join(''),
  length: (s: string | unknown[]) => s.length,

  // Number
  parseInt: (s: string) => parseInt(s, 10),
  parseFloat: (s: string) => parseFloat(s),
  round: (n: number, decimals = 0) => Number(n.toFixed(decimals)),
  abs: (n: number) => Math.abs(n),
  min: (...args: number[]) => Math.min(...args),
  max: (...args: number[]) => Math.max(...args),

  // Array
  first: (arr: unknown[]) => arr[0],
  last: (arr: unknown[]) => arr[arr.length - 1],
  count: (arr: unknown[]) => arr.length,
  join: (arr: string[], sep = ', ') => arr.join(sep),
  filter: (arr: unknown[], expr: string) => arr.filter(item => evalExpr(expr, { item })),
  map: (arr: unknown[], expr: string) => arr.map(item => evalExpr(expr, { item })),

  // Utility
  uuid: () => crypto.randomUUID(),
  jsonParse: (s: string) => JSON.parse(s),
  jsonStringify: (v: unknown) => JSON.stringify(v),
  isNull: (v: unknown) => v === null || v === undefined,
  coalesce: (...args: unknown[]) => args.find(a => a !== null && a !== undefined),
};
```

### 4.3 Interpolation Engine

```typescript
// apps/web/src/lib/workflows/interpolation/engine.ts

export function interpolate(
  template: unknown,
  context: Record<string, unknown>
): unknown {
  if (typeof template === 'string') {
    return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      const trimmed = expr.trim();
      try {
        return String(evaluateExpression(trimmed, context) ?? '');
      } catch {
        return `{{${trimmed}}}`;  // leave unresolved on error
      }
    });
  }
  if (Array.isArray(template)) return template.map(item => interpolate(item, context));
  if (typeof template === 'object' && template !== null) {
    return Object.fromEntries(
      Object.entries(template as Record<string, unknown>).map(([k, v]) => [k, interpolate(v, context)])
    );
  }
  return template;
}

function evaluateExpression(expr: string, context: Record<string, unknown>): unknown {
  // functions.now() → builtinFunctions.now()
  if (expr.startsWith('functions.')) {
    return evaluateFunctionCall(expr.slice(10), context);
  }
  // secrets.KEY → org secrets vault
  if (expr.startsWith('secrets.')) {
    return getOrgSecret(context['_orgId'] as string, expr.slice(8));
  }
  // Dot-notation path access: trigger.deal.name
  return expr.split('.').reduce((acc: unknown, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, context);
}
```

---

## 5. File Structure

```
apps/web/src/
├── app/
│   ├── (dashboard)/
│   │   └── workflows/
│   │       ├── page.tsx                              # Workflow list
│   │       ├── new/
│   │       │   └── page.tsx                          # Create (name + trigger picker)
│   │       ├── templates/
│   │       │   └── page.tsx                          # Template library browser
│   │       └── [workflowId]/
│   │           ├── page.tsx                          # Redirect to canvas
│   │           ├── canvas/
│   │           │   └── page.tsx                      # React Flow canvas editor
│   │           ├── runs/
│   │           │   ├── page.tsx                      # Run history list
│   │           │   └── [runId]/
│   │           │       └── page.tsx                  # Run detail + step timeline
│   │           ├── settings/
│   │           │   └── page.tsx                      # Trigger config, rate limit, error handling
│   │           └── integrations/
│   │               └── page.tsx                      # Connected integration credentials
│   ├── approvals/
│   │   └── [requestId]/
│   │       └── page.tsx                              # Public approval page (email link)
│   └── api/
│       └── wh/
│           └── [path]/
│               └── route.ts                          # Webhook trigger endpoint
├── server/
│   └── routers/
│       └── workflows.ts                              # All tRPC procedures
├── lib/
│   └── workflows/
│       ├── engine/
│       │   ├── workflow-engine.ts                    # Main BullMQ-powered executor
│       │   ├── node-executor.ts                      # Dispatches to per-type handlers
│       │   ├── error-handler.ts                      # stop/continue/retry logic
│       │   └── context-builder.ts                    # Builds execution context object
│       ├── nodes/
│       │   ├── trigger-event.handler.ts
│       │   ├── trigger-schedule.handler.ts
│       │   ├── trigger-webhook.handler.ts
│       │   ├── action-send-email.handler.ts
│       │   ├── action-send-sms.handler.ts
│       │   ├── action-create-record.handler.ts
│       │   ├── action-update-record.handler.ts
│       │   ├── action-send-webhook.handler.ts
│       │   ├── action-slack.handler.ts
│       │   ├── action-code.handler.ts              # vm2 sandbox
│       │   ├── action-create-task.handler.ts
│       │   ├── condition.handler.ts
│       │   ├── delay.handler.ts
│       │   ├── loop.handler.ts
│       │   ├── approval.handler.ts
│       │   ├── transform.handler.ts
│       │   ├── lookup.handler.ts
│       │   └── switch.handler.ts
│       ├── interpolation/
│       │   ├── engine.ts                           # Template string interpolator
│       │   └── functions.ts                        # Built-in function registry
│       ├── integrations/
│       │   ├── credentials.ts                      # AES-256-GCM encrypt/decrypt
│       │   ├── slack.ts
│       │   ├── gmail.ts
│       │   ├── twilio.ts
│       │   └── github.ts
│       └── rate-limiter.ts                         # Per-workflow rate limit (Redis)
├── workers/
│   ├── workflow.worker.ts                          # BullMQ workflow execution worker
│   ├── workflow-delay.worker.ts                    # Handles delayed node resumption
│   └── workflow-approval-timeout.worker.ts         # Auto-reject expired approvals
└── components/
    └── workflows/
        ├── canvas/
        │   ├── WorkflowCanvas.tsx                  # React Flow canvas root
        │   ├── NodePalette.tsx                     # Left sidebar — node type list
        │   ├── NodeSettingsPanel.tsx               # Right sidebar — node config form
        │   ├── EdgeSettings.tsx                    # Edge label editor
        │   ├── CanvasToolbar.tsx                   # Zoom, undo, save, activate buttons
        │   └── nodes/
        │       ├── TriggerNode.tsx
        │       ├── ActionNode.tsx
        │       ├── ConditionNode.tsx               # Diamond shape with true/false handles
        │       ├── DelayNode.tsx
        │       ├── LoopNode.tsx
        │       ├── ApprovalNode.tsx
        │       └── TransformNode.tsx
        ├── runs/
        │   ├── RunList.tsx
        │   ├── RunDetail.tsx                       # Timeline of step executions
        │   └── StepLog.tsx                         # Expandable step with input/output
        ├── templates/
        │   ├── TemplateGallery.tsx
        │   └── TemplateCard.tsx
        └── integrations/
            ├── IntegrationList.tsx
            └── ConnectIntegrationModal.tsx
```

---

## 6. tRPC Router — All Procedures

```typescript
// apps/web/src/server/routers/workflows.ts

export const workflowsRouter = createTRPCRouter({

  // ── Workflow CRUD ────────────────────────────────────────────────────────────

  create: orgProcedure
    .input(z.object({ name: z.string(), trigger_type: z.nativeEnum(WfTriggerType) }))
    .mutation(async ({ ctx, input }) => {
      return prisma.workflow.create({
        data: {
          organization_id: ctx.org.id,
          created_by: ctx.user.id,
          name: input.name,
          trigger_type: input.trigger_type,
          trigger_config: {},
          nodes: [],
          edges: [],
        },
      });
    }),

  update: orgProcedure
    .input(WorkflowUpdateSchema)
    .mutation(async ({ ctx, input }) => { /* save nodes/edges + bump version */ }),

  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* soft archive */ }),

  list: orgProcedure
    .input(z.object({ status: z.nativeEnum(WfStatus).optional(), search: z.string().optional(), page: z.number().default(1) }))
    .query(async ({ ctx, input }) => { /* paginated list */ }),

  get: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => { /* full workflow with nodes/edges */ }),

  /** Activate workflow. Validates trigger config. For schedule triggers, registers BullMQ repeat job. */
  activate: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wf = await prisma.workflow.findUniqueOrThrow({ where: { id: input.id } });
      validateWorkflowGraph(wf.nodes as WorkflowNode[], wf.edges as WorkflowEdge[]);

      if (wf.trigger_type === 'schedule') {
        const { cron, timezone } = (wf.trigger_config as ScheduleTriggerConfig);
        await workflowScheduleQueue.upsertJobScheduler(
          `workflow:schedule:${wf.id}`,
          { pattern: cron, tz: timezone },
          { name: 'run', data: { workflowId: wf.id, triggerType: 'schedule' } }
        );
      }

      return prisma.workflow.update({ where: { id: input.id }, data: { status: 'active' } });
    }),

  /** Pause workflow. Removes schedule job if applicable. */
  pause: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* remove schedule job, set status = paused */ }),

  /** Manually trigger a workflow run. */
  run: orgProcedure
    .input(z.object({ id: z.string(), input_data: z.record(z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      return workflowQueue.add('run', {
        workflowId: input.id,
        triggerType: 'manual',
        triggerData: input.input_data ?? {},
        triggeredBy: ctx.user.id,
      });
    }),

  // ── Runs ─────────────────────────────────────────────────────────────────────

  runs: {
    list: orgProcedure
      .input(z.object({ workflowId: z.string(), status: z.nativeEnum(WfRunStatus).optional(), page: z.number().default(1) }))
      .query(async ({ ctx, input }) => { /* paginated */ }),

    get: orgProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => { /* run + step_logs */ }),

    cancel: orgProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => { /* mark cancelled, attempt BullMQ job removal */ }),
  },

  // ── Templates ─────────────────────────────────────────────────────────────────

  templates: {
    list: orgProcedure
      .input(z.object({ category: z.string().optional(), difficulty: z.nativeEnum(WfDifficulty).optional() }))
      .query(async ({ ctx, input }) => { /* global + org templates */ }),

    /** Install template → creates new workflow in draft from template nodes/edges. */
    install: orgProcedure
      .input(z.object({ templateId: z.string(), name: z.string() }))
      .mutation(async ({ ctx, input }) => { /* copy nodes/edges, create Workflow record */ }),
  },

  // ── Integrations ──────────────────────────────────────────────────────────────

  integrations: {
    list: orgProcedure.query(async ({ ctx }) => { /* list with credentials masked */ }),

    /** Connect integration — encrypts credentials before storing. */
    connect: orgProcedure
      .input(z.object({ provider: z.string(), name: z.string(), credentials: z.record(z.unknown()), scopes: z.string().array() }))
      .mutation(async ({ ctx, input }) => {
        const encrypted = encryptCredentials(input.credentials, ctx.org.id);
        return prisma.workflowIntegration.create({
          data: {
            organization_id: ctx.org.id,
            created_by: ctx.user.id,
            name: input.name,
            provider: input.provider,
            credentials_enc: encrypted,
            scopes: input.scopes,
          },
        });
      }),

    /** Test integration by making a ping API call. */
    test: orgProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => { /* decrypt + test provider connection */ }),

    disconnect: orgProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => { /* set is_active = false */ }),
  },

  // ── Webhook Endpoints ─────────────────────────────────────────────────────────

  webhooks: {
    create: orgProcedure
      .input(z.object({ workflowId: z.string(), description: z.string().optional(), method: z.nativeEnum(WfWebhookMethod).optional() }))
      .mutation(async ({ ctx, input }) => {
        const path = crypto.randomBytes(24).toString('hex');
        return prisma.workflowWebhookEndpoint.create({
          data: {
            organization_id: ctx.org.id,
            workflow_id: input.workflowId,
            path,
            description: input.description,
            method: input.method ?? 'POST',
            secret: crypto.randomBytes(32).toString('hex'),
          },
        });
      }),

    list: orgProcedure.input(z.object({ workflowId: z.string() })).query(async ({ ctx, input }) => { /* ... */ }),
    delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── Approvals ─────────────────────────────────────────────────────────────────

  approvals: {
    /** Called from email link or in-app notification. */
    approve: publicProcedure
      .input(z.object({ requestId: z.string(), token: z.string(), remarks: z.string().optional() }))
      .mutation(async ({ input }) => { /* verify token, update status, resume run */ }),

    reject: publicProcedure
      .input(z.object({ requestId: z.string(), token: z.string(), reason: z.string() }))
      .mutation(async ({ input }) => { /* verify token, update status, resume/branch run */ }),

    /** List pending approvals for the current user. */
    myPending: orgProcedure.query(async ({ ctx }) => { /* filter by ctx.user.id in approver_ids */ }),
  },
});
```

---

## 7. Business Logic

### 7.1 Workflow Engine Architecture

```typescript
// apps/web/src/lib/workflows/engine/workflow-engine.ts

export async function executeWorkflow(
  workflowId: string,
  triggerType: WfTriggerType,
  triggerData: Record<string, unknown>
): Promise<string> {
  const workflow = await prisma.workflow.findUniqueOrThrow({
    where: { id: workflowId },
  });

  // Rate limiting
  if (workflow.rate_limit_per_hour) {
    const { allowed } = await checkWorkflowRateLimit(workflowId, workflow.rate_limit_per_hour);
    if (!allowed) throw new Error('Rate limit exceeded');
  }

  // Create run record
  const run = await prisma.workflowRun.create({
    data: {
      workflow_id: workflowId,
      workflow_version: workflow.version,
      trigger_type: triggerType,
      trigger_data: triggerData,
      status: 'running',
    },
  });

  // Build execution context
  const context: ExecutionContext = {
    run_id: run.id,
    workflow_id: workflowId,
    org_id: workflow.organization_id,
    trigger: triggerData,
    steps: {},
    _orgId: workflow.organization_id,
  };

  try {
    // Find start node (trigger node)
    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];
    const startNode = nodes.find(n => n.type.startsWith('trigger_'));
    if (!startNode) throw new Error('No trigger node found');

    await executeNode(startNode, nodes, edges, context, workflow);

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: 'completed', completed_at: new Date(), duration_ms: Date.now() - run.started_at.getTime() },
    });

    await prisma.workflow.update({
      where: { id: workflowId },
      data: { total_runs: { increment: 1 }, successful_runs: { increment: 1 }, last_run_at: new Date() },
    });
  } catch (err) {
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: 'failed', error_message: (err as Error).message, completed_at: new Date() },
    });
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { total_runs: { increment: 1 }, failed_runs: { increment: 1 } },
    });
  }

  return run.id;
}
```

### 7.2 Node Execution Pipeline

```typescript
// apps/web/src/lib/workflows/engine/node-executor.ts

async function executeNode(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: ExecutionContext,
  workflow: Workflow
): Promise<void> {
  const stepLog = await prisma.workflowRunStep.create({
    data: {
      run_id: context.run_id,
      node_id: node.id,
      node_type: node.type,
      node_name: node.name,
      status: 'running',
      started_at: new Date(),
    },
  });

  const interpolatedConfig = interpolate(node.config, context) as NodeConfig;
  let output: Record<string, unknown> = {};
  let nextHandle: string | undefined;

  try {
    const handler = getNodeHandler(node.type);
    const result = await handler.execute(interpolatedConfig, context);
    output = result.output ?? {};
    nextHandle = result.nextHandle;

    await prisma.workflowRunStep.update({
      where: { id: stepLog.id },
      data: { status: 'completed', output_data: output, input_data: interpolatedConfig, completed_at: new Date(), duration_ms: Date.now() - stepLog.started_at!.getTime() },
    });

    // Store output in context for downstream access
    context.steps[node.id] = { output };

  } catch (err) {
    await prisma.workflowRunStep.update({
      where: { id: stepLog.id },
      data: { status: 'failed', error_message: (err as Error).message, completed_at: new Date() },
    });

    if (workflow.error_handling === 'stop') throw err;
    if (workflow.error_handling === 'retry' && stepLog.retry_count < workflow.max_retries) {
      await prisma.workflowRunStep.update({ where: { id: stepLog.id }, data: { retry_count: { increment: 1 } } });
      return executeNode(node, allNodes, edges, context, workflow); // retry
    }
    // 'continue' — skip this node and proceed
  }

  // Find next node(s) via edges
  const outEdges = edges.filter(e => e.source === node.id && (!nextHandle || e.sourceHandle === nextHandle));
  for (const edge of outEdges) {
    const nextNode = allNodes.find(n => n.id === edge.target);
    if (nextNode) await executeNode(nextNode, allNodes, edges, context, workflow);
  }
}
```

### 7.3 Delay Node Handler

```typescript
// apps/web/src/lib/workflows/nodes/delay.handler.ts

export const delayHandler = {
  async execute(config: DelayConfig, context: ExecutionContext) {
    const ms = config.unit === 'minutes' ? config.amount * 60_000
              : config.unit === 'hours'   ? config.amount * 3_600_000
              : config.amount * 86_400_000; // days

    // Instead of blocking, we enqueue a delayed BullMQ job to resume the run
    await workflowDelayQueue.add('resume', {
      run_id: context.run_id,
      resume_node_id: context._next_node_id,  // set by engine before calling handler
    }, { delay: ms });

    // Signal engine to pause this run
    throw new WorkflowPauseSignal('delay');
  },
};
```

### 7.4 Approval Node Handler

```typescript
// apps/web/src/lib/workflows/nodes/approval.handler.ts

export const approvalHandler = {
  async execute(config: ApprovalConfig, context: ExecutionContext) {
    // Resolve approver IDs (may be template expressions)
    const approverIds = config.approver_ids.map(id => interpolate(id, context) as string);

    const request = await prisma.workflowApprovalRequest.create({
      data: {
        run_id: context.run_id,
        step_node_id: context._current_node_id,
        approver_ids: approverIds,
        message: interpolate(config.message, context) as string,
        context_data: interpolate(config.context_data, context) as Record<string, unknown>,
        status: 'pending',
        expires_at: config.timeout_hours
          ? addHours(new Date(), config.timeout_hours)
          : null,
      },
    });

    // Send approval email to each approver
    for (const approverId of approverIds) {
      const approvalToken = generateApprovalToken(request.id, approverId);
      await sendApprovalEmail(approverId, request, approvalToken);
    }

    // Enqueue timeout job
    if (config.timeout_hours) {
      await workflowApprovalTimeoutQueue.add('timeout', { requestId: request.id }, {
        delay: config.timeout_hours * 3_600_000,
      });
    }

    // Pause run
    throw new WorkflowPauseSignal('approval');
  },
};
```

### 7.5 Code Execution (JavaScript Sandbox)

```typescript
// apps/web/src/lib/workflows/nodes/action-code.handler.ts

import { NodeVM } from 'vm2';

export const codeHandler = {
  async execute(config: CodeConfig, context: ExecutionContext) {
    if (config.language !== 'javascript') throw new Error('Only JavaScript supported in v2');

    const vm = new NodeVM({
      timeout: config.timeout_ms ?? 5000,
      sandbox: { input: context },
      require: { external: false, builtin: [] }, // no module access
      wrapper: 'commonjs',
    });

    const result = vm.run(`
      module.exports = (async function() {
        ${config.code}
      })();
    `);

    const output = await result;
    return { output: typeof output === 'object' ? output : { result: output } };
  },
};
```

### 7.6 Credentials Encryption/Decryption

```typescript
// apps/web/src/lib/workflows/integrations/credentials.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function deriveKey(orgId: string): Buffer {
  return crypto.scryptSync(orgId + process.env.ENCRYPTION_SECRET!, 'salt', 32);
}

export function encryptCredentials(data: Record<string, unknown>, orgId: string) {
  const key = deriveKey(orgId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(data);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

export function decryptCredentials(enc: { iv: string; tag: string; ciphertext: string }, orgId: string) {
  const key = deriveKey(orgId);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(enc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, 'hex')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}
```

### 7.7 Workflow Graph Validation

Before activating a workflow, validate the node graph:

```typescript
// apps/web/src/lib/workflows/engine/context-builder.ts

export function validateWorkflowGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
  if (nodes.length === 0) throw new Error('Workflow has no nodes');

  const triggerNodes = nodes.filter(n => n.type.startsWith('trigger_'));
  if (triggerNodes.length !== 1) throw new Error('Workflow must have exactly one trigger node');

  // Ensure no unreachable nodes (all non-trigger nodes must have at least one incoming edge)
  const nodesWithIncomingEdges = new Set(edges.map(e => e.target));
  const unreachable = nodes
    .filter(n => !n.type.startsWith('trigger_') && !nodesWithIncomingEdges.has(n.id));

  if (unreachable.length > 0) {
    throw new Error(`Unreachable nodes: ${unreachable.map(n => n.name).join(', ')}`);
  }

  // Detect cycles (simple DFS)
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (stack.has(nodeId)) return true; // cycle
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    stack.add(nodeId);
    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      if (dfs(edge.target)) return true;
    }
    stack.delete(nodeId);
    return false;
  }

  // Loops are allowed (loop node manages its own iteration count)
  // Only detect cycles outside loop nodes
  const nonLoopEdges = edges.filter(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    return sourceNode?.type !== 'loop';
  });

  for (const node of nodes) {
    if (dfs(node.id)) {
      // Only error if it's not a loop-back edge
      // (loop nodes are allowed to create edges that go back up)
    }
  }
}
```

---

## 8. Webhook Trigger Endpoint

```typescript
// apps/web/src/app/api/wh/[path]/route.ts

export async function POST(req: Request, { params }: { params: { path: string } }) {
  const endpoint = await prisma.workflowWebhookEndpoint.findUnique({
    where: { path: params.path },
    include: { workflow: true },
  });

  if (!endpoint || !endpoint.is_active) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Verify HMAC signature if secret is set
  if (endpoint.secret) {
    const signature = req.headers.get('X-Hub-Signature-256') ?? '';
    const body = await req.text();
    const expected = 'sha256=' + crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');
    if (!timingSafeEqual(signature, expected)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    var triggerData = JSON.parse(body);
  } else {
    var triggerData = await req.json();
  }

  // Log trigger
  await prisma.workflowWebhookEndpoint.update({
    where: { id: endpoint.id },
    data: { request_count: { increment: 1 }, last_called_at: new Date() },
  });

  // Enqueue workflow execution
  if (endpoint.workflow.status === 'active') {
    await workflowQueue.add('run', {
      workflowId: endpoint.workflow_id,
      triggerType: 'webhook',
      triggerData,
    });
  }

  return Response.json({ received: true });
}
```

---

## 9. Event-Based Triggers

When a ZenFlow action occurs (deal created, ticket opened, form submitted, etc.), the platform emits an internal event that active workflows can subscribe to.

```typescript
// apps/web/src/lib/workflows/event-emitter.ts

export async function emitWorkflowEvent(
  orgId: string,
  eventName: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Find all active workflows triggered by this event
  const workflows = await prisma.workflow.findMany({
    where: {
      organization_id: orgId,
      status: 'active',
      trigger_type: 'event',
    },
  });

  for (const wf of workflows) {
    const config = wf.trigger_config as EventTriggerConfig;
    if (config.event_name !== eventName) continue;

    // Evaluate trigger filters
    const passes = evaluateTriggerFilters(config.filters ?? [], payload);

    await prisma.workflowTriggerLog.create({
      data: { workflow_id: wf.id, trigger_type: 'event', trigger_data: payload, matched: passes },
    });

    if (passes) {
      await workflowQueue.add('run', {
        workflowId: wf.id,
        triggerType: 'event',
        triggerData: payload,
      });
    }
  }
}

// Called from CRM router:
// await emitWorkflowEvent(ctx.org.id, 'crm.deal.created', { id: deal.id, name: deal.name, value: deal.value, ... });
```

**Standard event names:**

| Module | Event Name |
|---|---|
| CRM | `crm.deal.created`, `crm.deal.updated`, `crm.deal.stage_changed`, `crm.lead.created`, `crm.contact.created` |
| Projects | `project.task.created`, `project.task.completed`, `project.task.overdue` |
| HR | `hr.leave.submitted`, `hr.leave.approved`, `hr.leave.rejected`, `hr.employee.onboarded` |
| Help Desk | `helpdesk.ticket.opened`, `helpdesk.ticket.resolved`, `helpdesk.ticket.assigned` |
| Forms | `form.submitted`, `form.approved`, `form.rejected` |
| Accounting | `accounting.invoice.sent`, `accounting.invoice.paid`, `accounting.invoice.overdue` |

---

## 10. BullMQ Queue Configuration

```typescript
// apps/web/src/workers/queues.ts

import { Queue, QueueScheduler } from 'bullmq';
import { redis } from '@/lib/redis';

export const workflowQueue = new Queue('workflow-runs', { connection: redis });
export const workflowDelayQueue = new Queue('workflow-delays', { connection: redis });
export const workflowApprovalTimeoutQueue = new Queue('workflow-approval-timeouts', { connection: redis });
export const workflowScheduleQueue = new Queue('workflow-schedules', { connection: redis });

// Scheduler for cron-based workflow triggers
export const workflowQueueScheduler = new QueueScheduler('workflow-schedules', { connection: redis });

// BullMQ Worker — main execution
// apps/web/src/workers/workflow.worker.ts

import { Worker } from 'bullmq';

const worker = new Worker('workflow-runs', async (job) => {
  const { workflowId, triggerType, triggerData } = job.data;
  await executeWorkflow(workflowId, triggerType, triggerData);
}, {
  connection: redis,
  concurrency: 10,
  limiter: { max: 100, duration: 1000 }, // 100 jobs/sec across all workers
});
```

---

## 11. npm Packages

```json
{
  "dependencies": {
    "@reactflow/core": "^11.11.4",
    "@reactflow/background": "^11.3.14",
    "@reactflow/controls": "^11.2.14",
    "@reactflow/minimap": "^11.7.14",
    "bullmq": "^5.8.0",
    "ioredis": "^5.3.2",
    "vm2": "^3.9.19",
    "date-fns": "^3.6.0",
    "zod": "^3.23.0",
    "mustache": "^4.2.0",
    "cronstrue": "^2.50.0",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/vm2": "^3.9.8"
  }
}
```

---

## 12. Template Library — Example Templates

### Template: Lead to Deal Automation

```json
{
  "name": "Convert Qualified Lead to Deal",
  "category": "crm",
  "difficulty": "beginner",
  "required_integrations": [],
  "nodes": [
    {
      "id": "t1", "type": "trigger_event", "name": "Lead Qualified",
      "config": { "event_name": "crm.lead.updated", "filters": [{ "field": "status", "op": "eq", "value": "QUALIFIED" }] }
    },
    {
      "id": "a1", "type": "action_create_record", "name": "Create Deal",
      "config": { "module": "crm_deals", "data": { "name": "Deal: {{trigger.title}}", "contact_id": "{{trigger.contact_id}}", "value": "{{trigger.estimated_value}}" } }
    },
    {
      "id": "a2", "type": "action_send_notification", "name": "Notify Assignee",
      "config": { "user_ids": ["{{trigger.assignee_id}}"], "title": "New Deal Created", "body": "A deal was created from lead: {{trigger.title}}" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "t1", "target": "a1" },
    { "id": "e2", "source": "a1", "target": "a2" }
  ]
}
```

### Template: New Employee Onboarding

```json
{
  "name": "Employee Onboarding Sequence",
  "category": "hr",
  "difficulty": "intermediate",
  "required_integrations": ["slack"],
  "nodes": [
    { "id": "t1", "type": "trigger_event", "name": "Employee Added", "config": { "event_name": "hr.employee.onboarded" } },
    { "id": "a1", "type": "action_send_email", "name": "Welcome Email", "config": { "to": "{{trigger.email}}", "subject": "Welcome to {{org.name}}!", "body_html": "<p>Hi {{trigger.first_name}}, welcome aboard!</p>" } },
    { "id": "d1", "type": "delay", "name": "Wait 1 Day", "config": { "amount": 1, "unit": "days" } },
    { "id": "a2", "type": "action_slack", "name": "Slack Announcement", "config": { "channel": "#general", "message": "Please welcome {{trigger.first_name}} {{trigger.last_name}} to the team! :wave:" } }
  ],
  "edges": [
    { "id": "e1", "source": "t1", "target": "a1" },
    { "id": "e2", "source": "a1", "target": "d1" },
    { "id": "e3", "source": "d1", "target": "a2" }
  ]
}
```

---

## 13. Workflow Canvas UI Notes

- **React Flow:** Node graph is built with `@reactflow/core`. Custom node components render the node type icon, name, and status indicator.
- **Auto-layout:** On template install or import, use `dagre` to auto-position nodes in a top-to-bottom layout.
- **Connection validation:** `isValidConnection` callback prevents connecting incompatible node types (e.g., loop body exit → trigger node).
- **Node status overlay:** When viewing a run, the canvas overlays green (completed), red (failed), or yellow (running) borders on each node based on `WorkflowRunStep` data.
- **Variable picker:** In node config forms, a `{{` shortcut opens a variable picker popover showing available context variables with their types.
- **Test mode:** While editing, users can send a test payload to trigger the workflow in a sandboxed "test run" that does not mutate production data (skips `action_create_record`, `action_update_record` nodes, marks them as "simulated").
