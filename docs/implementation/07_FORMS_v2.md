# ZenFlow — FORMS v2 Implementation

> **Module:** Forms Builder v2
> **Stack:** Next.js 15 · tRPC v11 · Prisma v6 · PostgreSQL 16 · BullMQ · Redis · TypeScript 5
> **Author:** Mohit Yadav · **Date:** 2026-05-27
> **Status:** Ready for Implementation

---

## 1. Overview

Forms v2 is a complete rebuild of the existing lightweight `Form` / `FormField` / `FormSubmission` tables into an enterprise-grade form platform that matches and exceeds the SchoolERP PHP consent-forms module. The v2 system stores all field definitions inside a single `fields_info` JSONB column (eliminating the `form_fields` join table), adds 24 field types, a conditional logic engine, per-form rate limiting via Redis sorted sets, multi-level approval workflows, outbound webhooks with HMAC-SHA256 signing + BullMQ retry queue, Google reCAPTCHA v3, QR code generation, REST API with per-form bearer tokens, full audit trail, and form versioning.

### 1.1 Capabilities vs SchoolERP

| Feature | SchoolERP PHP | ZenFlow Forms v2 |
|---|---|---|
| Field types | 14 | 24 |
| Conditional logic | show/hide/require | show/hide/require/disable |
| Option sources | DB query + label template | DB query + raw SQL + label template + Mustache |
| Rate limiting | File-based rolling window | Redis ZADD sorted set |
| Webhooks | HMAC-SHA256 + retry | HMAC-SHA256 + BullMQ exponential backoff |
| Approval workflow | Multi-level | Multi-level + reassign + timeout |
| PDF generation | No | Puppeteer via BullMQ worker |
| Analytics | No | Views, conversion rate, drop-off per field |
| File output | PHP files generated | Next.js dynamic routing |
| API auth | Bearer token (file-based) | Bearer token (DB-hashed SHA-256) |

---

## 2. Database Schema (Prisma v6)

> Replaces existing `Form`, `FormField`, `FormSubmission` models. Add to `packages/db/prisma/schema.prisma`.

```prisma
// =============================================================================
// MODULE 3 — FORMS v2
// =============================================================================

model Form {
  id                        String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id           String      @db.Uuid
  created_by                String      @db.Uuid

  // Identity
  title                     String      @db.VarChar(255)
  slug                      String      @db.VarChar(64)   // bin2hex(32 bytes) globally unique
  description               String?     @db.Text

  // Fields (all field definitions embedded as JSONB array)
  fields_info               Json        // FormFieldDefinition[]

  // Lifecycle
  status                    FormStatusV2  @default(draft)
  version                   Int           @default(1)
  submissions_count         Int           @default(0)   // cached counter
  deleted_at                DateTime?

  // Access control
  available_for             FormAudience  @default(all)
  allowed_role_ids          String[]
  auth_required             Boolean       @default(true)
  password                  String?       @db.VarChar(255)

  // Submission rules
  allow_multiple_submissions Boolean      @default(false)
  enable_window             Boolean       @default(false)
  window_start              DateTime?
  window_end                DateTime?
  enable_max_submissions    Boolean       @default(false)
  max_submissions           Int?

  // Edit / delete permissions for submitter
  can_edit                  Boolean       @default(false)
  can_delete                Boolean       @default(false)
  edit_window_enabled       Boolean       @default(false)
  edit_window_start         DateTime?
  edit_window_end           DateTime?

  // Approval
  enable_approval           Boolean       @default(false)

  // Notifications
  enable_email_notification Boolean       @default(false)
  enable_sms_notification   Boolean       @default(false)
  notify_email_subject      String?       @db.VarChar(255)
  notify_email_body         String?       @db.Text         // Mustache template
  notify_sms_template       String?       @db.VarChar(500) // Mustache template
  notify_admin_emails       String[]

  // Post-submission
  success_action            SuccessAction @default(message)
  success_message           String?       @db.Text
  redirect_url              String?       @db.VarChar(500)

  // Branding
  custom_css                String?       @db.Text

  // Rate limiting (per-form, rolling window stored in Redis — NOT this table)
  // Redis key: form:ratelimit:{form_id}:{ip}  → sorted set of timestamps (score = epoch ms)
  // Logic: ZADD + ZREMRANGEBYSCORE(now - window_ms, 0) + ZCARD
  public_rate_limit         Int?          // max requests per hour per IP

  // reCAPTCHA v3
  recaptcha_site_key        String?       @db.VarChar(120)
  recaptcha_secret_key      String?       @db.VarChar(120)
  recaptcha_min_score       Decimal?      @db.Decimal(3, 2) // 0.00 – 1.00

  // Webhooks
  webhook_url               String?       @db.VarChar(500)
  webhook_secret            String?       @db.VarChar(120)

  // QR Code
  qr_code_path              String?       @db.VarChar(500)

  created_at                DateTime      @default(now())
  updated_at                DateTime      @updatedAt

  // Relations
  organization     Organization          @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator          User                  @relation("FormCreator", fields: [created_by], references: [id])
  submissions      FormSubmission[]
  approval_steps   FormApprovalStep[]
  api_tokens       FormApiToken[]
  webhook_queue    FormWebhookQueue[]
  audit_logs       FormAuditLog[]
  versions         FormVersion[]

  @@unique([slug])
  @@index([organization_id, status, deleted_at])
  @@map("forms")
}

model FormOptionSource {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String    @db.Uuid
  created_by      String    @db.Uuid

  name            String    @db.VarChar(100)
  description     String?   @db.Text

  // Query configuration
  query_mode      QueryMode @default(structured)
  source_table    String?   @db.VarChar(100)
  source_column   String?   @db.VarChar(100)   // label column
  value_column    String?   @db.VarChar(100)   // value column (if null, use source_column)
  where_clause    String?   @db.Text
  order_by        String?   @db.VarChar(150)
  raw_sql         String?   @db.Text           // used when query_mode = raw
  apply_distinct  Boolean   @default(true)
  row_limit       Int?                          // default 500

  // Label rendering
  // Mustache-style: "{first_name} {last_name} ({employee_code})"
  label_template  String?   @db.Text

  is_active       Boolean   @default(true)
  deleted_at      DateTime?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@unique([organization_id, name])
  @@map("form_option_sources")
}

model FormSubmission {
  id               String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  form_id          String              @db.Uuid

  // Reference number: CF-2026-000001 (per-form sequential counter in Redis)
  reference_number String              @unique @db.VarChar(50)

  // Submitter identity
  submitter_id     String?             @db.VarChar(50)
  submitter_type   SubmitterType?
  submitter_ip     String              @db.VarChar(45)
  user_agent       String?             @db.Text

  // Payload
  data             Json                // { field_name: value }

  // Approval state
  approval_status  ApprovalStatus?
  approval_remarks String?             @db.Text
  approved_by      String?             @db.VarChar(36)
  approved_at      DateTime?

  // Edit tracking
  is_edited        Boolean             @default(false)
  last_edited_at   DateTime?
  last_edited_by   String?             @db.VarChar(36)

  // Metadata
  financial_year   Int?
  is_trash         Boolean             @default(false)

  created_at       DateTime            @default(now())
  updated_at       DateTime            @updatedAt

  // Relations
  form             Form                @relation(fields: [form_id], references: [id], onDelete: Cascade)
  submitter_user   User?               @relation("SubmissionUser", fields: [submitter_id], references: [id])
  approval_logs    FormApprovalLog[]
  webhook_queue    FormWebhookQueue[]
  audit_logs       FormAuditLog[]

  @@index([form_id, is_trash, created_at])
  @@index([submitter_id, form_id])
  @@index([approval_status, form_id])
  @@map("form_submissions")
}

model FormApprovalStep {
  id                 String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  form_id            String        @db.Uuid
  position           Int           // 1-based order
  approver_type      ApproverType
  approver_id        String?       @db.VarChar(36)
  approver_role      String?       @db.VarChar(50)
  notification_email String?       @db.VarChar(255)
  created_at         DateTime      @default(now())

  form Form @relation(fields: [form_id], references: [id], onDelete: Cascade)

  @@index([form_id, position])
  @@map("form_approval_steps")
}

model FormApprovalLog {
  id            String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  submission_id String         @db.Uuid
  step_position Int
  approver_id   String         @db.VarChar(36)
  action        ApprovalAction
  remarks       String?        @db.Text
  created_at    DateTime       @default(now())

  submission FormSubmission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@index([submission_id])
  @@map("form_approval_logs")
}

model FormWebhookQueue {
  id           String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  form_id      String        @db.Uuid
  submission_id String       @db.Uuid
  webhook_url  String        @db.VarChar(500)
  payload      String        @db.Text  // JSON string (large — avoid JSONB for portability)
  attempts     Int           @default(0)
  max_attempts Int           @default(3)
  next_at      DateTime?
  status       WebhookStatus @default(pending)
  last_error   String?       @db.Text
  created_at   DateTime      @default(now())
  updated_at   DateTime      @updatedAt

  form       Form           @relation(fields: [form_id], references: [id], onDelete: Cascade)
  submission FormSubmission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@index([status, next_at])
  @@map("form_webhook_queue")
}

model FormApiToken {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  form_id     String    @db.Uuid
  created_by  String    @db.Uuid
  label       String    @db.VarChar(100)
  token_hash  String    @unique @db.Char(64)  // SHA-256 hex
  token_prefix String   @db.VarChar(8)        // shown in UI for identification
  scope       TokenScope @default(read)
  last_used_at DateTime?
  expires_at  DateTime?
  revoked_at  DateTime?
  created_at  DateTime  @default(now())

  form Form @relation(fields: [form_id], references: [id], onDelete: Cascade)

  @@index([token_hash])
  @@map("form_api_tokens")
}

model FormAuditLog {
  id            String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  form_id       String          @db.Uuid
  submission_id String?         @db.Uuid
  action        FormAuditAction
  actor_id      String          @db.VarChar(50)
  actor_type    String          @db.VarChar(20)
  old_data      Json?
  new_data      Json
  ip_address    String?         @db.VarChar(45)
  user_agent    String?         @db.VarChar(255)
  created_at    DateTime        @default(now())

  form       Form            @relation(fields: [form_id], references: [id], onDelete: Cascade)
  submission FormSubmission? @relation(fields: [submission_id], references: [id])

  @@index([form_id, action, created_at])
  @@map("form_audit_logs")
}

model FormVersion {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  form_id        String   @db.Uuid
  version_number Int
  fields_info    Json     // snapshot of fields_info at this version
  changed_by     String   @db.VarChar(36)
  change_note    String?  @db.VarChar(255)
  created_at     DateTime @default(now())

  form Form @relation(fields: [form_id], references: [id], onDelete: Cascade)

  @@unique([form_id, version_number])
  @@map("form_versions")
}

// --- New Enums ---

enum FormStatusV2 {
  draft
  published
  archived
}

enum FormAudience {
  all
  employee
  student
  specific_roles
}

enum SuccessAction {
  message
  redirect
}

enum QueryMode {
  structured
  raw
}

enum SubmitterType {
  admin
  employee
  student
  public
  user
}

enum ApprovalStatus {
  pending
  approved
  rejected
}

enum ApproverType {
  user
  role
  manager
}

enum ApprovalAction {
  approved
  rejected
  reassigned
}

enum WebhookStatus {
  pending
  delivered
  failed
}

enum TokenScope {
  read
  read_approve
}

enum FormAuditAction {
  create_form
  edit_form
  delete_form
  publish_form
  archive_form
  submit
  edit_submission
  delete_submission
  approve
  reject
}
```

---

## 3. fields_info JSONB — Field Definition Schema

Each element of the `fields_info` array follows this TypeScript interface:

```typescript
// packages/db/src/types/form-field.ts

export type FieldType =
  | 'input' | 'numeric' | 'textarea' | 'date' | 'datetime' | 'time'
  | 'file' | 'select' | 'radio' | 'checkbox' | 'button' | 'signature'
  | 'rating' | 'nps' | 'matrix' | 'repeater' | 'address' | 'phone'
  | 'payment' | 'hidden' | 'calculated' | 'pagebreak' | 'section'
  | 'richtext' | 'lookup';

export type ConditionalOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'is_empty' | 'is_not_empty' | 'in' | 'not_in';

export interface ConditionalRule {
  field_name: string;
  operator: ConditionalOperator;
  value: string | number | boolean | null;
}

export interface ConditionalLogic {
  rules: ConditionalRule[];
  logic: 'ALL' | 'ANY';
  action: 'show' | 'hide' | 'require' | 'disable';
}

export interface FieldValidation {
  min?: number | null;
  max?: number | null;
  pattern?: string | null;        // regex string
  file_types?: string[] | null;   // ['pdf','jpg','png']
  max_file_size_mb?: number;
  min_date?: string | null;
  max_date?: string | null;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface FormFieldDefinition {
  id: string;                          // UUIDv4 — stable identifier
  name: string;                        // snake_case key used in submission data
  type: FieldType;
  label: string;
  placeholder?: string;
  help_text?: string;
  default_value?: string;
  required: boolean;
  length?: number;                     // max char length for text fields
  validation?: FieldValidation;

  // Options for select/radio/checkbox
  options_source: 'manual' | 'table';
  option_source_id?: string | null;    // FK to FormOptionSource.id
  options?: FieldOption[];             // used when options_source = manual
  value_label_columns?: boolean;       // store separate label + value in submission
  select_multiple?: boolean;

  // Conditional display
  conditional?: ConditionalLogic | null;

  // Layout
  position: number;
  width: 'full' | 'half' | 'third';

  // Rating / NPS
  rating_max?: number;
  rating_type?: 'star' | 'number' | 'emoji';

  // Matrix
  matrix_rows?: string[];
  matrix_columns?: string[];

  // Calculated field
  formula?: string;                    // e.g. "{quantity} * {unit_price}"

  // Lookup (ZenFlow module search)
  lookup_module?: 'crm_contacts' | 'hr_employees' | 'inventory_products';

  // Payment
  payment_amount?: number | null;
  payment_currency?: string;

  // Page break / section
  page_title?: string;
  section_title?: string;
  section_description?: string;

  // File upload
  allow_multiple_files?: boolean;
  max_files?: number;
}
```

### Sample fields_info JSON

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "full_name",
    "type": "input",
    "label": "Full Name",
    "placeholder": "Enter your full name",
    "help_text": "As per official ID",
    "required": true,
    "length": 100,
    "validation": { "pattern": "^[a-zA-Z ]+$" },
    "options_source": "manual",
    "options": [],
    "position": 1,
    "width": "full"
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "name": "department",
    "type": "select",
    "label": "Department",
    "required": true,
    "options_source": "table",
    "option_source_id": "src-uuid-here",
    "value_label_columns": true,
    "position": 2,
    "width": "half",
    "conditional": null
  },
  {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "name": "manager_approval_note",
    "type": "textarea",
    "label": "Additional Notes",
    "required": false,
    "position": 3,
    "width": "full",
    "conditional": {
      "rules": [{ "field_name": "department", "operator": "eq", "value": "engineering" }],
      "logic": "ALL",
      "action": "show"
    }
  },
  {
    "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
    "name": "page_break_1",
    "type": "pagebreak",
    "label": "Page Break",
    "page_title": "Step 2: Upload Documents",
    "required": false,
    "position": 4,
    "width": "full"
  }
]
```

---

## 4. Redis Rate Limiting — Rolling Window Pattern

Rate limiting is implemented entirely in Redis (no database table needed).

**Key pattern:** `form:ratelimit:{form_id}:{client_ip}`
**Data structure:** Redis Sorted Set (score = timestamp in milliseconds)

```typescript
// apps/web/src/lib/forms/rate-limit.ts

import { redis } from '@/lib/redis';

export async function checkFormRateLimit(
  formId: string,
  ip: string,
  maxPerHour: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `form:ratelimit:${formId}:${ip}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);  // remove expired entries
  pipeline.zadd(key, { score: now, member: `${now}` });
  pipeline.zcard(key);
  pipeline.expire(key, 3600);
  const results = await pipeline.exec();

  const count = results[2] as number;
  const allowed = count <= maxPerHour;
  const resetAt = now + windowMs;

  if (!allowed) {
    // Remove the just-added entry since we're rejecting
    await redis.zrem(key, `${now}`);
  }

  return { allowed, remaining: Math.max(0, maxPerHour - count), resetAt };
}
```

---

## 5. File Structure

```
apps/web/src/
├── app/
│   ├── (dashboard)/
│   │   └── forms/
│   │       ├── page.tsx                          # Forms list
│   │       ├── new/
│   │       │   └── page.tsx                      # Create form wizard
│   │       └── [formId]/
│   │           ├── page.tsx                      # Form detail / redirect to builder
│   │           ├── builder/
│   │           │   └── page.tsx                  # Drag-and-drop form builder
│   │           ├── settings/
│   │           │   └── page.tsx                  # Form settings (access, notifications, etc)
│   │           ├── submissions/
│   │           │   ├── page.tsx                  # Submissions list + filter
│   │           │   └── [submissionId]/
│   │           │       └── page.tsx              # Single submission detail + approval
│   │           ├── analytics/
│   │           │   └── page.tsx                  # Views, conversion, drop-off charts
│   │           ├── api-tokens/
│   │           │   └── page.tsx                  # Manage API tokens
│   │           └── qr-code/
│   │               └── page.tsx                  # QR code download
│   ├── f/
│   │   └── [slug]/
│   │       ├── page.tsx                          # Public form render (no auth)
│   │       └── success/
│   │           └── page.tsx                      # Success message / redirect
│   └── api/
│       ├── forms/
│       │   └── [slug]/
│       │       ├── route.ts                      # REST: GET form definition (token auth)
│       │       └── submissions/
│       │           └── route.ts                  # REST: GET/POST submissions (token auth)
│       └── webhooks/
│           └── form/
│               └── [path]/
│                   └── route.ts                  # Inbound webhook endpoint (for triggers)
├── server/
│   └── routers/
│       └── forms.ts                              # All tRPC procedures
├── lib/
│   └── forms/
│       ├── builder/
│       │   ├── conditional-engine.ts             # Evaluates show/hide/require rules
│       │   ├── formula-engine.ts                 # Calculates formula fields
│       │   ├── option-source-resolver.ts         # Runs DB queries for option sources
│       │   └── field-validator.ts                # Per-field validation logic
│       ├── rate-limit.ts                         # Redis rolling window rate limiter
│       ├── recaptcha.ts                          # reCAPTCHA v3 score verification
│       ├── reference-number.ts                   # CF-YYYY-NNNNNN generator (Redis INCR)
│       ├── webhook-dispatch.ts                   # HMAC sign + enqueue to BullMQ
│       ├── pdf-generator.ts                      # Puppeteer PDF from submission data
│       └── qr-code.ts                            # QRCode generation (qrcode npm)
├── workers/
│   └── form-webhook.worker.ts                    # BullMQ worker for webhook delivery
└── components/
    └── forms/
        ├── builder/
        │   ├── FormBuilder.tsx                   # Main drag-drop canvas (@dnd-kit)
        │   ├── FieldPalette.tsx                  # Left sidebar — field type list
        │   ├── FieldSettings.tsx                 # Right sidebar — field config panel
        │   ├── ConditionBuilder.tsx              # Visual condition rule editor
        │   ├── OptionsEditor.tsx                 # Manual + DB-linked options editor
        │   ├── PageBreakBlock.tsx                # Page break visual indicator
        │   └── fields/
        │       ├── InputField.tsx
        │       ├── SelectField.tsx
        │       ├── MatrixField.tsx
        │       ├── RatingField.tsx
        │       ├── SignatureField.tsx
        │       ├── PaymentField.tsx
        │       ├── RepeaterField.tsx
        │       └── LookupField.tsx
        ├── renderer/
        │   ├── FormRenderer.tsx                  # Public form renderer
        │   ├── FormPage.tsx                      # Single page in multi-page form
        │   └── ProgressBar.tsx
        └── submissions/
            ├── SubmissionTable.tsx
            ├── SubmissionDetail.tsx
            ├── ApprovalPanel.tsx
            └── ExportButton.tsx
```

---

## 6. tRPC Router — All Procedures

```typescript
// apps/web/src/server/routers/forms.ts (outline)

export const formsRouter = createTRPCRouter({

  // ── Form CRUD ──────────────────────────────────────────────────────────────

  /** Create a new form (draft). Generates slug via crypto.randomBytes(32). */
  create: orgProcedure
    .input(z.object({ title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  /** Full form update — saves new version snapshot if fields_info changed. */
  update: orgProcedure
    .input(FormUpdateSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  /** Transition status to published. Validates required fields. */
  publish: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  /** Archive form. Existing submissions remain. */
  archive: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  /** Soft delete. */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  /** Duplicate form with new slug and draft status. */
  duplicate: orgProcedure
    .input(z.object({ id: z.string().uuid(), title: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  /** Paginated list with search, status filter. */
  list: orgProcedure
    .input(z.object({ page: z.number(), status: z.nativeEnum(FormStatusV2).optional(), search: z.string().optional() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  /** Single form by ID. */
  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // ── Option Sources ─────────────────────────────────────────────────────────

  optionSources: {
    list: orgProcedure.query(async ({ ctx }) => { /* ... */ }),
    create: orgProcedure.input(OptionSourceSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
    update: orgProcedure.input(OptionSourceSchema.extend({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    /** Execute query and return resolved label/value pairs for the builder preview. */
    preview: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── Submissions ─────────────────────────────────────────────────────────────

  submissions: {
    /** Paginated submissions with filter by approval_status, date range, search. */
    list: orgProcedure.input(SubmissionListSchema).query(async ({ ctx, input }) => { /* ... */ }),
    get: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => { /* ... */ }),
    /** Edit submission data (if can_edit and within edit_window). */
    edit: orgProcedure.input(SubmissionEditSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
    /** Soft delete (move to trash). */
    delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    /** Approve — advances approval workflow. */
    approve: orgProcedure.input(z.object({ id: z.string(), remarks: z.string().optional() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    /** Reject — terminates approval workflow. */
    reject: orgProcedure.input(z.object({ id: z.string(), remarks: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    /** Export submissions as CSV or XLSX. Returns signed S3 URL. */
    export: orgProcedure.input(z.object({ formId: z.string(), format: z.enum(['csv','xlsx']), filters: z.any().optional() })).mutation(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── API Tokens ─────────────────────────────────────────────────────────────

  apiTokens: {
    /** Create token. Returns raw token ONCE — only hash is stored. */
    create: orgProcedure.input(z.object({ formId: z.string(), label: z.string(), scope: z.nativeEnum(TokenScope), expiresAt: z.date().optional() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    list: orgProcedure.input(z.object({ formId: z.string() })).query(async ({ ctx, input }) => { /* ... */ }),
    revoke: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── Webhooks ────────────────────────────────────────────────────────────────

  webhooks: {
    /** List webhook queue entries for a form. */
    queueStatus: orgProcedure.input(z.object({ formId: z.string(), status: z.nativeEnum(WebhookStatus).optional() })).query(async ({ ctx, input }) => { /* ... */ }),
    /** Manually retry a failed webhook. */
    retry: orgProcedure.input(z.object({ queueId: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── Analytics ──────────────────────────────────────────────────────────────

  analytics: {
    /** Views count from Redis HLL. */
    views: orgProcedure.input(z.object({ formId: z.string(), period: z.enum(['7d','30d','90d']) })).query(async ({ ctx, input }) => { /* ... */ }),
    /** Submission count / conversion rate. */
    conversion: orgProcedure.input(z.object({ formId: z.string() })).query(async ({ ctx, input }) => { /* ... */ }),
    /** Drop-off rate per field (which fields are left blank in incomplete submissions). */
    dropoff: orgProcedure.input(z.object({ formId: z.string() })).query(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── QR Code ─────────────────────────────────────────────────────────────────

  qrCode: {
    /** Generates PNG QR code pointing to /f/{slug}. Stores path on form. */
    generate: orgProcedure.input(z.object({ formId: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
  },
});
```

---

## 7. Business Logic

### 7.1 Conditional Logic Engine

```typescript
// apps/web/src/lib/forms/builder/conditional-engine.ts

export function evaluateConditional(
  rule: ConditionalLogic,
  formValues: Record<string, unknown>
): boolean {
  const results = rule.rules.map(r => evaluateRule(r, formValues));
  const match = rule.logic === 'ALL' ? results.every(Boolean) : results.some(Boolean);
  // action 'show'/'require'/'disable' → return true if condition passes
  // action 'hide' → negate
  return rule.action === 'hide' ? !match : match;
}

function evaluateRule(rule: ConditionalRule, values: Record<string, unknown>): boolean {
  const fieldValue = values[rule.field_name];
  switch (rule.operator) {
    case 'eq': return String(fieldValue) === String(rule.value);
    case 'neq': return String(fieldValue) !== String(rule.value);
    case 'gt': return Number(fieldValue) > Number(rule.value);
    case 'gte': return Number(fieldValue) >= Number(rule.value);
    case 'lt': return Number(fieldValue) < Number(rule.value);
    case 'lte': return Number(fieldValue) <= Number(rule.value);
    case 'contains': return String(fieldValue).includes(String(rule.value));
    case 'not_contains': return !String(fieldValue).includes(String(rule.value));
    case 'starts_with': return String(fieldValue).startsWith(String(rule.value));
    case 'ends_with': return String(fieldValue).endsWith(String(rule.value));
    case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'in': return Array.isArray(rule.value) && rule.value.includes(fieldValue);
    case 'not_in': return Array.isArray(rule.value) && !rule.value.includes(fieldValue);
    default: return false;
  }
}
```

### 7.2 Option Source Resolver (SQL Execution + Label Template)

```typescript
// apps/web/src/lib/forms/builder/option-source-resolver.ts

import { prisma } from '@db';
import Mustache from 'mustache';

export async function resolveOptionSource(
  source: FormOptionSource
): Promise<{ label: string; value: string }[]> {
  let rows: Record<string, unknown>[];

  if (source.query_mode === 'raw' && source.raw_sql) {
    // SECURITY: raw_sql only executed for org-owned sources, validated on save
    rows = await prisma.$queryRawUnsafe(source.raw_sql) as Record<string, unknown>[];
  } else {
    // structured mode — build query dynamically
    const cols = [source.source_column, source.value_column].filter(Boolean).join(', ');
    const distinct = source.apply_distinct ? 'DISTINCT' : '';
    const where = source.where_clause ? `WHERE ${source.where_clause}` : '';
    const orderBy = source.order_by ? `ORDER BY ${source.order_by}` : '';
    const limit = source.row_limit ? `LIMIT ${source.row_limit}` : 'LIMIT 500';
    const sql = `SELECT ${distinct} ${cols} FROM ${source.source_table} ${where} ${orderBy} ${limit}`;
    rows = await prisma.$queryRawUnsafe(sql) as Record<string, unknown>[];
  }

  return rows.map(row => ({
    label: source.label_template
      ? Mustache.render(source.label_template, row)
      : String(row[source.source_column!] ?? ''),
    value: String(row[source.value_column ?? source.source_column!] ?? ''),
  }));
}
```

### 7.3 Reference Number Generator

```typescript
// apps/web/src/lib/forms/reference-number.ts

import { redis } from '@/lib/redis';

export async function generateReferenceNumber(formId: string): Promise<string> {
  const year = new Date().getFullYear();
  const key = `form:refseq:${formId}:${year}`;
  const seq = await redis.incr(key);
  await redis.expire(key, 366 * 24 * 3600); // TTL: 1 year
  return `CF-${year}-${String(seq).padStart(6, '0')}`;
}
```

### 7.4 Webhook Dispatch with HMAC-SHA256

```typescript
// apps/web/src/lib/forms/webhook-dispatch.ts

import crypto from 'crypto';
import { webhookQueue } from '@/workers/queues';

export async function enqueueWebhook(
  formId: string,
  submissionId: string,
  webhookUrl: string,
  secret: string | null,
  payload: object
): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  const signature = secret
    ? crypto.createHmac('sha256', secret).update(payloadStr).digest('hex')
    : null;

  // Store in DB queue first (durability)
  await prisma.formWebhookQueue.create({
    data: {
      form_id: formId,
      submission_id: submissionId,
      webhook_url: webhookUrl,
      payload: payloadStr,
      max_attempts: 3,
      next_at: new Date(),
      status: 'pending',
    },
  });

  // Then enqueue BullMQ job
  await webhookQueue.add('deliver', {
    formId, submissionId, webhookUrl, payloadStr, signature,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
```

### 7.5 BullMQ Webhook Worker

```typescript
// apps/web/src/workers/form-webhook.worker.ts

import { Worker } from 'bullmq';
import { redis } from '@/lib/redis';

const worker = new Worker('form-webhooks', async (job) => {
  const { webhookUrl, payloadStr, signature, formId, submissionId } = job.data;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-ZenFlow-Delivery': job.id!,
  };
  if (signature) headers['X-ZenFlow-Signature'] = `sha256=${signature}`;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: payloadStr,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  await prisma.formWebhookQueue.updateMany({
    where: { form_id: formId, submission_id: submissionId, status: 'pending' },
    data: { status: 'delivered', attempts: { increment: 1 } },
  });
}, { connection: redis });

worker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await prisma.formWebhookQueue.updateMany({
      where: { submission_id: job.data.submissionId, status: 'pending' },
      data: { status: 'failed', last_error: err.message, attempts: job.attemptsMade },
    });
  }
});
```

### 7.6 reCAPTCHA v3 Verification

```typescript
// apps/web/src/lib/forms/recaptcha.ts

export async function verifyRecaptchaV3(
  token: string,
  secretKey: string,
  minScore: number
): Promise<{ valid: boolean; score: number }> {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  });
  const data = await response.json();
  return { valid: data.success && data.score >= minScore, score: data.score ?? 0 };
}
```

### 7.7 Multi-Level Approval Workflow

On submission with `enable_approval = true`:
1. Set `approval_status = 'pending'` on the submission.
2. Look up `FormApprovalStep` rows ordered by `position`.
3. Send email notification to step 1 approver.
4. When approver calls `submissions.approve`:
   - Log `FormApprovalLog` entry.
   - Check if more steps remain. If yes, notify next approver. If no, set `approval_status = 'approved'`.
5. Any approver can call `submissions.reject` at any step — sets `approval_status = 'rejected'` immediately.

---

## 8. REST API Endpoints (Bearer Token Auth)

These endpoints are consumed by external integrations using `FormApiToken` bearer tokens.

| Method | Path | Scope | Description |
|---|---|---|---|
| GET | `/api/forms/:slug` | read | Return form schema (fields_info without sensitive config) |
| GET | `/api/forms/:slug/submissions` | read | Paginated submissions list |
| GET | `/api/forms/:slug/submissions/:id` | read | Single submission |
| POST | `/api/forms/:slug/submissions` | read | Submit form via API |
| PATCH | `/api/forms/:slug/submissions/:id/approve` | read_approve | Approve submission |
| PATCH | `/api/forms/:slug/submissions/:id/reject` | read_approve | Reject submission |

**Authentication:**
```
Authorization: Bearer zf_<token_prefix>_<raw_token>
```
Token is hashed with SHA-256 and looked up in `form_api_tokens.token_hash`.

```typescript
// apps/web/src/app/api/forms/[slug]/route.ts

import crypto from 'crypto';

async function authenticateFormToken(request: Request, formId: string) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Missing token');
  const raw = auth.slice(7);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const token = await prisma.formApiToken.findUnique({
    where: { token_hash: hash },
    include: { form: { select: { id: true } } },
  });
  if (!token || token.revoked_at || token.form.id !== formId) throw new Error('Invalid token');
  if (token.expires_at && token.expires_at < new Date()) throw new Error('Token expired');
  await prisma.formApiToken.update({ where: { id: token.id }, data: { last_used_at: new Date() } });
  return token;
}
```

---

## 9. QR Code Generation

```typescript
// apps/web/src/lib/forms/qr-code.ts

import QRCode from 'qrcode';
import { uploadToStorage } from '@/lib/storage';

export async function generateFormQrCode(formId: string, slug: string): Promise<string> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/f/${slug}`;
  const buffer = await QRCode.toBuffer(url, { width: 400, margin: 2 });
  const key = `forms/qr/${formId}.png`;
  const publicUrl = await uploadToStorage(key, buffer, 'image/png');
  await prisma.form.update({ where: { id: formId }, data: { qr_code_path: publicUrl } });
  return publicUrl;
}
```

---

## 10. npm Packages

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "bullmq": "^5.8.0",
    "mustache": "^4.2.0",
    "qrcode": "^1.5.4",
    "react-signature-canvas": "^1.0.6",
    "puppeteer": "^22.0.0",
    "xlsx": "^0.18.5",
    "zod": "^3.23.0",
    "ioredis": "^5.3.2",
    "crypto": "built-in"
  },
  "devDependencies": {
    "@types/mustache": "^4.2.5",
    "@types/qrcode": "^1.5.5"
  }
}
```

---

## 11. Migration Strategy

1. The existing `Form`, `FormField`, and `FormSubmission` tables are renamed/replaced.
2. A migration script reads existing `FormField` rows and packs them into `fields_info` JSONB on each `Form`.
3. Existing `FormSubmission` rows get assigned auto-generated `reference_number` values.
4. The `form_fields` table is dropped after data migration is confirmed.
5. Prisma migration file: `packages/db/prisma/migrations/YYYYMMDDHHMMSS_forms_v2/migration.sql`

---

## 12. Form Builder UI Notes

- **Canvas:** `@dnd-kit/sortable` for drag-and-drop field reordering. Fields snap to a 3-column grid (full/half/third width).
- **Field Palette:** Left sidebar groups field types by category (Basic, Advanced, Layout, Payment).
- **Settings Panel:** Right sidebar shows all field configuration options. Conditional logic UI uses a rule builder (field selector + operator dropdown + value input).
- **Live Preview:** Toggle between "Edit" and "Preview" modes. Preview mode evaluates conditions in real time using the form's current field values.
- **Page Break Navigation:** Multi-page forms show a step indicator. Each `pagebreak` field creates a new page boundary. Validation runs per-page.
- **Option Source Editor:** Visual query builder for structured mode; raw SQL textarea with syntax highlighting for raw mode. Preview button executes the query and shows first 20 rows.
