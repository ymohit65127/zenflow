# ZenFlow CRM v2 — Full Implementation Specification

**Document version:** 1.0  
**Date:** 2026-05-27  
**Author:** Senior Architecture Team  
**Platform:** Next.js 15 · tRPC v11 · Prisma v6 · PostgreSQL 16 · Turborepo

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [File Structure](#file-structure)
4. [tRPC Procedures](#trpc-procedures)
5. [Pages & Routes](#pages--routes)
6. [Business Logic](#business-logic)
7. [External Dependencies](#external-dependencies)

---

## 1. Overview

CRM v2 upgrades ZenFlow's basic contact/deal CRUD into a full enterprise CRM system. The upgrade introduces:

- **Multi-pipeline deal management** with configurable stages, win probabilities, and rotting detection
- **Account (Company) management** with hierarchy (parent/child accounts)
- **Contact lifecycle management** with lead scoring, segmentation, and sequences
- **Email integration** with Gmail/Outlook OAuth sync and IMAP polling
- **Sales sequences** (automated multi-step email/call/task workflows)
- **Quote builder** with PDF generation and open-tracking pixel
- **Product catalog** for line-item quoting
- **Web forms** with embeddable capture widgets that route leads into pipelines
- **CRM reports** covering pipeline velocity, win rates, forecasting, and rep performance

All new tables follow the existing `snake_case` naming convention. All IDs use `cuid()` (Prisma `@default(cuid())`). Timestamps are `timestamptz` in PostgreSQL (Prisma `DateTime @default(now())`).

---

## 2. Database Schema

### 2.1 CrmPipeline

```prisma
model CrmPipeline {
  id                       String    @id @default(cuid())
  organization_id          String    @db.VarChar(36)
  name                     String    @db.VarChar(255)
  description              String?   @db.Text
  color                    String    @db.VarChar(7)           // hex e.g. "#3B82F6"
  is_default               Boolean   @default(false)
  position                 Int       @default(0)
  currency                 String    @db.VarChar(3)           @default("USD")
  win_probability_enabled  Boolean   @default(true)
  rotting_enabled          Boolean   @default(false)
  rotting_days             Int       @default(14)
  deleted_at               DateTime?
  created_by               String    @db.VarChar(36)
  created_at               DateTime  @default(now())
  updated_at               DateTime  @updatedAt

  // Relations
  organization             Organization     @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator                  User             @relation("PipelineCreator", fields: [created_by], references: [id])
  stages                   CrmStage[]
  deals                    CrmDeal[]
  web_forms                CrmWebForm[]

  @@index([organization_id])
  @@index([organization_id, is_default])
  @@index([organization_id, position])
  @@index([deleted_at])
  @@map("crm_pipelines")
}
```

### 2.2 CrmStage

```prisma
enum CrmStageType {
  active
  won
  lost
}

model CrmStage {
  id           String        @id @default(cuid())
  pipeline_id  String        @db.VarChar(36)
  name         String        @db.VarChar(255)
  color        String        @db.VarChar(7)               // hex e.g. "#10B981"
  position     Int
  probability  Decimal       @db.Decimal(5, 2)            // 0.00–100.00
  stage_type   CrmStageType  @default(active)
  rottable     Boolean       @default(true)
  created_at   DateTime      @default(now())
  updated_at   DateTime      @updatedAt

  // Relations
  pipeline     CrmPipeline   @relation(fields: [pipeline_id], references: [id], onDelete: Cascade)
  deals        CrmDeal[]
  web_forms    CrmWebForm[]

  @@index([pipeline_id])
  @@index([pipeline_id, position])
  @@index([pipeline_id, stage_type])
  @@map("crm_stages")
}
```

### 2.3 CrmAccount (Company)

```prisma
enum CrmCompanySize {
  SIZE_1_10       @map("1-10")
  SIZE_11_50      @map("11-50")
  SIZE_51_200     @map("51-200")
  SIZE_201_1000   @map("201-1000")
  SIZE_1001_5000  @map("1001-5000")
  SIZE_5001_PLUS  @map("5001+")
}

model CrmAccount {
  id                String          @id @default(cuid())
  organization_id   String          @db.VarChar(36)
  name              String          @db.VarChar(255)
  domain            String?         @db.VarChar(255)
  industry          String?         @db.VarChar(100)
  size              CrmCompanySize?
  annual_revenue    Decimal?        @db.Decimal(15, 2)
  website           String?         @db.VarChar(500)
  phone             String?         @db.VarChar(30)
  address           Json?           // { street, city, state, postal_code, country }
  description       String?         @db.Text
  owner_id          String?         @db.VarChar(36)
  parent_account_id String?         @db.VarChar(36)   // self-relation
  logo_url          String?         @db.VarChar(500)
  linkedin_url      String?         @db.VarChar(500)
  twitter_url       String?         @db.VarChar(500)
  lead_score        Int             @default(0)
  health_score      Int             @default(0)        // 0–100
  tags              String[]
  custom_fields     Json?           @db.JsonB
  deleted_at        DateTime?
  created_at        DateTime        @default(now())
  updated_at        DateTime        @updatedAt

  // Relations
  organization      Organization    @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  owner             User?           @relation("AccountOwner", fields: [owner_id], references: [id])
  parent_account    CrmAccount?     @relation("AccountHierarchy", fields: [parent_account_id], references: [id])
  child_accounts    CrmAccount[]    @relation("AccountHierarchy")
  contacts          CrmContact[]
  deals             CrmDeal[]
  notes             CrmNote[]
  email_logs        CrmEmailLog[]
  files             CrmFile[]

  @@index([organization_id])
  @@index([organization_id, owner_id])
  @@index([organization_id, domain])
  @@index([organization_id, industry])
  @@index([organization_id, lead_score])
  @@index([parent_account_id])
  @@index([deleted_at])
  @@map("crm_accounts")
}
```

### 2.4 CrmContact (Upgraded)

```prisma
enum CrmLifecycleStage {
  lead
  subscriber
  opportunity
  customer
  evangelist
}

model CrmContact {
  id                String              @id @default(cuid())
  organization_id   String              @db.VarChar(36)
  account_id        String?             @db.VarChar(36)
  first_name        String              @db.VarChar(100)
  last_name         String?             @db.VarChar(100)
  email             String              @db.VarChar(255)
  phone             String?             @db.VarChar(30)
  mobile            String?             @db.VarChar(30)
  job_title         String?             @db.VarChar(255)
  department        String?             @db.VarChar(100)
  linkedin_url      String?             @db.VarChar(500)
  twitter_url       String?             @db.VarChar(500)
  lead_score        Int                 @default(0)
  lifecycle_stage   CrmLifecycleStage   @default(lead)
  source            String?             @db.VarChar(100)    // e.g. "organic", "paid_search", "referral"
  source_detail     String?             @db.VarChar(255)
  tags              String[]
  custom_fields     Json?               @db.JsonB
  last_activity_at  DateTime?
  unsubscribed      Boolean             @default(false)
  unsubscribed_at   DateTime?
  owner_id          String?             @db.VarChar(36)
  deleted_at        DateTime?
  created_at        DateTime            @default(now())
  updated_at        DateTime            @updatedAt

  // Relations
  organization      Organization        @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  account           CrmAccount?         @relation(fields: [account_id], references: [id])
  owner             User?               @relation("ContactOwner", fields: [owner_id], references: [id])
  deals             CrmDeal[]
  notes             CrmNote[]
  email_logs        CrmEmailLog[]
  files             CrmFile[]
  quotes            CrmQuote[]
  sequence_enrollments CrmSequenceEnrollment[]

  @@index([organization_id])
  @@index([organization_id, email])
  @@index([organization_id, account_id])
  @@index([organization_id, lifecycle_stage])
  @@index([organization_id, lead_score])
  @@index([organization_id, owner_id])
  @@index([organization_id, unsubscribed])
  @@index([deleted_at])
  @@map("crm_contacts")
}
```

### 2.5 CrmLostReason

```prisma
model CrmLostReason {
  id           String   @id @default(cuid())
  organization_id String @db.VarChar(36)
  name         String   @db.VarChar(255)
  position     Int      @default(0)
  is_active    Boolean  @default(true)
  created_at   DateTime @default(now())

  // Relations
  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  deals        CrmDeal[]

  @@index([organization_id])
  @@index([organization_id, is_active])
  @@map("crm_lost_reasons")
}
```

### 2.6 CrmDeal

```prisma
enum CrmDealType {
  new_business
  renewal
  upsell
  expansion
  other
}

enum CrmDealPriority {
  low
  medium
  high
  urgent
}

model CrmDeal {
  id                  String           @id @default(cuid())
  organization_id     String           @db.VarChar(36)
  pipeline_id         String           @db.VarChar(36)
  stage_id            String           @db.VarChar(36)
  name                String           @db.VarChar(255)
  amount              Decimal?         @db.Decimal(15, 2)
  currency            String           @db.VarChar(3)   @default("USD")
  probability         Decimal?         @db.Decimal(5, 2)   // 0.00–100.00; overrides stage default
  weighted_amount     Decimal?         @db.Decimal(15, 2)  // stored, recomputed on save: amount * probability/100
  expected_close_date DateTime?
  actual_close_date   DateTime?
  won_at              DateTime?
  lost_at             DateTime?
  lost_reason_id      String?          @db.VarChar(36)
  win_reason          String?          @db.VarChar(500)
  deal_type           CrmDealType      @default(new_business)
  priority            CrmDealPriority  @default(medium)
  owner_id            String?          @db.VarChar(36)
  team_id             String?          @db.VarChar(36)
  contact_id          String?          @db.VarChar(36)
  account_id          String?          @db.VarChar(36)
  source              String?          @db.VarChar(100)
  stage_changed_at    DateTime?
  last_activity_at    DateTime?
  rotting             Boolean          @default(false)
  description         String?          @db.Text
  custom_fields       Json?            @db.JsonB
  deleted_at          DateTime?
  created_at          DateTime         @default(now())
  updated_at          DateTime         @updatedAt

  // Relations
  organization        Organization     @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  pipeline            CrmPipeline      @relation(fields: [pipeline_id], references: [id])
  stage               CrmStage         @relation(fields: [stage_id], references: [id])
  lost_reason         CrmLostReason?   @relation(fields: [lost_reason_id], references: [id])
  owner               User?            @relation("DealOwner", fields: [owner_id], references: [id])
  contact             CrmContact?      @relation(fields: [contact_id], references: [id])
  account             CrmAccount?      @relation(fields: [account_id], references: [id])
  products            CrmDealProduct[]
  quotes              CrmQuote[]
  notes               CrmNote[]
  email_logs          CrmEmailLog[]
  files               CrmFile[]
  activities          CrmActivity[]

  @@index([organization_id])
  @@index([organization_id, pipeline_id])
  @@index([organization_id, stage_id])
  @@index([organization_id, owner_id])
  @@index([organization_id, contact_id])
  @@index([organization_id, account_id])
  @@index([organization_id, expected_close_date])
  @@index([organization_id, rotting])
  @@index([organization_id, won_at])
  @@index([organization_id, lost_at])
  @@index([deleted_at])
  @@map("crm_deals")
}
```

### 2.7 CrmProduct

```prisma
model CrmProduct {
  id              String   @id @default(cuid())
  organization_id String   @db.VarChar(36)
  name            String   @db.VarChar(255)
  code            String?  @db.VarChar(100)
  description     String?  @db.Text
  unit_price      Decimal  @db.Decimal(15, 4)
  currency        String   @db.VarChar(3)  @default("USD")
  tax_rate        Decimal  @db.Decimal(5, 4)   @default(0)   // e.g. 0.1800 = 18%
  unit            String?  @db.VarChar(50)                   // e.g. "hour", "license", "seat"
  category        String?  @db.VarChar(100)
  is_active       Boolean  @default(true)
  deleted_at      DateTime?
  created_at      DateTime @default(now())

  // Relations
  organization    Organization     @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  deal_lines      CrmDealProduct[]
  quote_lines     CrmQuoteLine[]

  @@index([organization_id])
  @@index([organization_id, is_active])
  @@index([organization_id, category])
  @@index([organization_id, code])
  @@map("crm_products")
}
```

### 2.8 CrmDealProduct

```prisma
enum CrmDiscountType {
  percent
  amount
}

model CrmDealProduct {
  id             String           @id @default(cuid())
  deal_id        String           @db.VarChar(36)
  product_id     String?          @db.VarChar(36)   // nullable — can be ad-hoc line item
  name           String           @db.VarChar(255)
  description    String?          @db.Text
  quantity       Decimal          @db.Decimal(10, 3)
  unit_price     Decimal          @db.Decimal(15, 4)
  discount_type  CrmDiscountType? @default(percent)
  discount_value Decimal          @db.Decimal(10, 4) @default(0)
  tax_rate       Decimal          @db.Decimal(5, 4)  @default(0)
  line_total     Decimal          @db.Decimal(15, 4)  // (qty * unit_price - discount) * (1 + tax_rate)
  currency       String           @db.VarChar(3)  @default("USD")
  position       Int              @default(0)
  created_at     DateTime         @default(now())
  updated_at     DateTime         @updatedAt

  // Relations
  deal           CrmDeal          @relation(fields: [deal_id], references: [id], onDelete: Cascade)
  product        CrmProduct?      @relation(fields: [product_id], references: [id])

  @@index([deal_id])
  @@index([product_id])
  @@map("crm_deal_products")
}
```

### 2.9 CrmQuote

```prisma
enum CrmQuoteStatus {
  draft
  sent
  accepted
  rejected
  expired
}

model CrmQuote {
  id                  String          @id @default(cuid())
  organization_id     String          @db.VarChar(36)
  deal_id             String          @db.VarChar(36)
  contact_id          String?         @db.VarChar(36)
  number              String          @db.VarChar(50)      // e.g. "QT-2026-0042"; unique per org
  title               String          @db.VarChar(255)
  status              CrmQuoteStatus  @default(draft)
  valid_until         DateTime?
  subtotal            Decimal         @db.Decimal(15, 2)
  discount_total      Decimal         @db.Decimal(15, 2)   @default(0)
  tax_total           Decimal         @db.Decimal(15, 2)   @default(0)
  grand_total         Decimal         @db.Decimal(15, 2)
  currency            String          @db.VarChar(3)       @default("USD")
  notes               String?         @db.Text
  terms               String?         @db.Text
  sent_at             DateTime?
  accepted_at         DateTime?
  rejected_at         DateTime?
  pdf_url             String?         @db.VarChar(500)
  tracking_pixel_id   String?         @db.VarChar(64)     // UUID used in 1x1 pixel URL
  first_opened_at     DateTime?
  open_count          Int             @default(0)
  created_by          String          @db.VarChar(36)
  created_at          DateTime        @default(now())
  updated_at          DateTime        @updatedAt

  // Relations
  organization        Organization    @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  deal                CrmDeal         @relation(fields: [deal_id], references: [id])
  contact             CrmContact?     @relation(fields: [contact_id], references: [id])
  creator             User            @relation(fields: [created_by], references: [id])
  lines               CrmQuoteLine[]

  @@unique([organization_id, number])
  @@index([organization_id])
  @@index([organization_id, deal_id])
  @@index([organization_id, status])
  @@index([tracking_pixel_id])
  @@map("crm_quotes")
}
```

### 2.10 CrmQuoteLine

```prisma
model CrmQuoteLine {
  id             String           @id @default(cuid())
  quote_id       String           @db.VarChar(36)
  product_id     String?          @db.VarChar(36)
  name           String           @db.VarChar(255)
  description    String?          @db.Text
  quantity       Decimal          @db.Decimal(10, 3)
  unit_price     Decimal          @db.Decimal(15, 4)
  discount_type  CrmDiscountType? @default(percent)
  discount_value Decimal          @db.Decimal(10, 4) @default(0)
  tax_rate       Decimal          @db.Decimal(5, 4)  @default(0)
  line_total     Decimal          @db.Decimal(15, 4)
  position       Int              @default(0)
  created_at     DateTime         @default(now())

  // Relations
  quote          CrmQuote         @relation(fields: [quote_id], references: [id], onDelete: Cascade)
  product        CrmProduct?      @relation(fields: [product_id], references: [id])

  @@index([quote_id])
  @@map("crm_quote_lines")
}
```

### 2.11 CrmActivity (Upgraded)

```prisma
enum CrmActivityType {
  call
  email
  meeting
  task
  note
  deadline
}

enum CrmActivityStatus {
  pending
  completed
  cancelled
}

model CrmActivity {
  id                    String             @id @default(cuid())
  organization_id       String             @db.VarChar(36)
  type                  CrmActivityType
  status                CrmActivityStatus  @default(pending)
  title                 String             @db.VarChar(500)
  description           String?            @db.Text
  entity_type           String             @db.VarChar(50)   // "contact" | "deal" | "account"
  entity_id             String             @db.VarChar(36)
  due_at                DateTime?
  completed_at          DateTime?
  owner_id              String?            @db.VarChar(36)
  // v2 additions:
  outcome               String?            @db.VarChar(100)  // e.g. "left_voicemail", "reached", "no_answer"
  next_action           String?            @db.VarChar(500)
  call_duration_seconds Int?
  call_recording_url    String?            @db.VarChar(500)
  meeting_link          String?            @db.VarChar(500)
  location              String?            @db.VarChar(255)
  all_day               Boolean            @default(false)
  recurrence_rule       String?            @db.VarChar(255)  // RFC 5545 RRULE string
  parent_activity_id    String?            @db.VarChar(36)
  created_by            String             @db.VarChar(36)
  created_at            DateTime           @default(now())
  updated_at            DateTime           @updatedAt

  // Relations
  organization          Organization       @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  owner                 User?              @relation("ActivityOwner", fields: [owner_id], references: [id])
  parent_activity       CrmActivity?       @relation("ActivityRecurrence", fields: [parent_activity_id], references: [id])
  child_activities      CrmActivity[]      @relation("ActivityRecurrence")
  deal                  CrmDeal?           // resolved at query time via entity_type/entity_id

  @@index([organization_id])
  @@index([organization_id, entity_type, entity_id])
  @@index([organization_id, owner_id])
  @@index([organization_id, due_at])
  @@index([organization_id, status])
  @@index([parent_activity_id])
  @@map("crm_activities")
}
```

### 2.12 CrmNote

```prisma
enum CrmEntityType {
  contact
  deal
  account
  lead
}

model CrmNote {
  id           String        @id @default(cuid())
  organization_id String     @db.VarChar(36)
  entity_type  CrmEntityType
  entity_id    String        @db.VarChar(36)
  content      String        @db.Text
  is_pinned    Boolean       @default(false)
  created_by   String        @db.VarChar(36)
  updated_by   String?       @db.VarChar(36)
  deleted_at   DateTime?
  created_at   DateTime      @default(now())
  updated_at   DateTime      @updatedAt

  // Relations
  organization Organization  @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator      User          @relation("NoteCreator", fields: [created_by], references: [id])
  updater      User?         @relation("NoteUpdater", fields: [updated_by], references: [id])

  @@index([organization_id])
  @@index([organization_id, entity_type, entity_id])
  @@index([organization_id, is_pinned])
  @@index([deleted_at])
  @@map("crm_notes")
}
```

### 2.13 CrmEmailIntegration

```prisma
enum CrmEmailProvider {
  gmail
  outlook
  smtp
}

model CrmEmailIntegration {
  id                  String            @id @default(cuid())
  organization_id     String            @db.VarChar(36)
  user_id             String            @db.VarChar(36)
  provider            CrmEmailProvider
  email_address       String            @db.VarChar(255)
  access_token_enc    String?           @db.Text         // AES-256-GCM encrypted
  refresh_token_enc   String?           @db.Text         // AES-256-GCM encrypted
  expires_at          DateTime?
  sync_enabled        Boolean           @default(true)
  last_synced_at      DateTime?
  sync_from_date      DateTime
  created_at          DateTime          @default(now())
  updated_at          DateTime          @updatedAt

  // Relations
  organization        Organization      @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  user                User              @relation(fields: [user_id], references: [id])

  @@unique([organization_id, user_id, email_address])
  @@index([organization_id])
  @@index([user_id])
  @@map("crm_email_integrations")
}
```

### 2.14 CrmEmailLog

```prisma
enum CrmEmailDirection {
  inbound
  outbound
}

model CrmEmailLog {
  id              String             @id @default(cuid())
  organization_id String             @db.VarChar(36)
  entity_type     CrmEntityType
  entity_id       String             @db.VarChar(36)
  direction       CrmEmailDirection
  message_id      String             @db.VarChar(500)    // RFC 2822 Message-ID header
  thread_id       String?            @db.VarChar(500)
  subject         String?            @db.VarChar(500)
  from_email      String             @db.VarChar(255)
  to_emails       String[]
  cc_emails       String[]           @default([])
  bcc_emails      String[]           @default([])
  html_body       String?            @db.Text
  text_body       String?            @db.Text
  sent_at         DateTime
  opened_at       DateTime?
  open_count      Int                @default(0)
  clicked_at      DateTime?
  click_count     Int                @default(0)
  bounced         Boolean            @default(false)
  bounce_reason   String?            @db.VarChar(500)
  integration_id  String?            @db.VarChar(36)
  raw_headers     Json?              @db.JsonB
  created_at      DateTime           @default(now())

  // Relations
  organization    Organization       @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  integration     CrmEmailIntegration? @relation(fields: [integration_id], references: [id])

  @@unique([organization_id, message_id])
  @@index([organization_id])
  @@index([organization_id, entity_type, entity_id])
  @@index([organization_id, thread_id])
  @@index([organization_id, direction])
  @@index([sent_at])
  @@map("crm_email_logs")
}
```

### 2.15 CrmSequence

```prisma
enum CrmSequenceTriggerType {
  manual
  lead_created
  lead_score
  deal_stage
}

enum CrmSequenceStatus {
  draft
  active
  paused
  archived
}

model CrmSequence {
  id               String                  @id @default(cuid())
  organization_id  String                  @db.VarChar(36)
  name             String                  @db.VarChar(255)
  description      String?                 @db.Text
  goal             String?                 @db.VarChar(500)
  trigger_type     CrmSequenceTriggerType  @default(manual)
  trigger_config   Json?                   @db.JsonB    // { score_threshold: 50 } | { stage_id: "..." }
  status           CrmSequenceStatus       @default(draft)
  step_count       Int                     @default(0)
  enrolled_count   Int                     @default(0)
  completed_count  Int                     @default(0)
  exited_count     Int                     @default(0)
  created_by       String                  @db.VarChar(36)
  created_at       DateTime                @default(now())
  updated_at       DateTime                @updatedAt

  // Relations
  organization     Organization            @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator          User                    @relation(fields: [created_by], references: [id])
  steps            CrmSequenceStep[]
  enrollments      CrmSequenceEnrollment[]

  @@index([organization_id])
  @@index([organization_id, status])
  @@index([organization_id, trigger_type])
  @@map("crm_sequences")
}
```

### 2.16 CrmSequenceStep

```prisma
enum CrmSequenceStepType {
  email
  sms
  call
  task
  wait
}

model CrmSequenceStep {
  id              String               @id @default(cuid())
  sequence_id     String               @db.VarChar(36)
  position        Int
  type            CrmSequenceStepType
  wait_days       Int                  @default(0)
  wait_hours      Int                  @default(0)
  wait_until_time String?              @db.VarChar(5)  // "09:00" — send only after this local time
  subject         String?              @db.VarChar(500)
  body            String?              @db.Text
  template_id     String?              @db.VarChar(36)
  task_title      String?              @db.VarChar(255)
  task_type       CrmActivityType?
  created_at      DateTime             @default(now())
  updated_at      DateTime             @updatedAt

  // Relations
  sequence        CrmSequence          @relation(fields: [sequence_id], references: [id], onDelete: Cascade)

  @@index([sequence_id])
  @@index([sequence_id, position])
  @@map("crm_sequence_steps")
}
```

### 2.17 CrmSequenceEnrollment

```prisma
enum CrmEnrollmentStatus {
  active
  paused
  completed
  exited
  bounced
}

model CrmSequenceEnrollment {
  id                    String               @id @default(cuid())
  sequence_id           String               @db.VarChar(36)
  contact_id            String               @db.VarChar(36)
  deal_id               String?              @db.VarChar(36)
  status                CrmEnrollmentStatus  @default(active)
  current_step_position Int                  @default(0)
  next_step_at          DateTime?
  enrolled_by           String               @db.VarChar(36)
  enrolled_at           DateTime             @default(now())
  completed_at          DateTime?
  exited_at             DateTime?
  exit_reason           String?              @db.VarChar(255)   // e.g. "manual_exit", "replied", "unsubscribed"
  created_at            DateTime             @default(now())
  updated_at            DateTime             @updatedAt

  // Relations
  sequence              CrmSequence          @relation(fields: [sequence_id], references: [id])
  contact               CrmContact           @relation(fields: [contact_id], references: [id])
  deal                  CrmDeal?             @relation(fields: [deal_id], references: [id])
  enrolled_by_user      User                 @relation("EnrollmentEnroller", fields: [enrolled_by], references: [id])

  @@unique([sequence_id, contact_id])             // one active enrollment per contact per sequence
  @@index([sequence_id])
  @@index([contact_id])
  @@index([sequence_id, status])
  @@index([next_step_at])                         // for BullMQ scheduler polling
  @@map("crm_sequence_enrollments")
}
```

### 2.18 CrmLeadScoreRule

```prisma
enum CrmLeadScoreFieldType {
  demographic
  behavioral
}

enum CrmLeadScoreOperator {
  eq
  neq
  contains
  gt
  lt
  in
  not_empty
}

model CrmLeadScoreRule {
  id              String                @id @default(cuid())
  organization_id String                @db.VarChar(36)
  name            String                @db.VarChar(255)
  field_type      CrmLeadScoreFieldType
  field_path      String                @db.VarChar(255)   // e.g. "contact.job_title", "activity.type"
  operator        CrmLeadScoreOperator
  value           String                @db.VarChar(500)   // JSON-serialized comparison value
  score_change    Int                                       // positive (add) or negative (decay)
  is_active       Boolean               @default(true)
  created_at      DateTime              @default(now())

  // Relations
  organization    Organization          @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@index([organization_id])
  @@index([organization_id, is_active])
  @@map("crm_lead_score_rules")
}
```

### 2.19 CrmTerritory

```prisma
enum CrmTerritoryRuleType {
  geography
  industry
  company_size
  custom
}

model CrmTerritory {
  id              String               @id @default(cuid())
  organization_id String               @db.VarChar(36)
  name            String               @db.VarChar(255)
  description     String?              @db.Text
  rule_type       CrmTerritoryRuleType
  rules           Json                 @db.JsonB     // [{ field: "country", op: "in", values: ["US","CA"] }]
  owner_ids       String[]                           // user IDs assigned to this territory
  created_at      DateTime             @default(now())
  updated_at      DateTime             @updatedAt

  // Relations
  organization    Organization         @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@index([organization_id])
  @@map("crm_territories")
}
```

### 2.20 CrmFile

```prisma
model CrmFile {
  id              String        @id @default(cuid())
  organization_id String        @db.VarChar(36)
  entity_type     CrmEntityType
  entity_id       String        @db.VarChar(36)
  file_name       String        @db.VarChar(255)
  file_size       BigInt
  mime_type       String        @db.VarChar(127)
  storage_path    String        @db.VarChar(1000)   // MinIO object key
  uploaded_by     String        @db.VarChar(36)
  deleted_at      DateTime?
  created_at      DateTime      @default(now())

  // Relations
  organization    Organization  @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  uploader        User          @relation(fields: [uploaded_by], references: [id])

  @@index([organization_id])
  @@index([organization_id, entity_type, entity_id])
  @@index([deleted_at])
  @@map("crm_files")
}
```

### 2.21 CrmWebForm

```prisma
model CrmWebForm {
  id                  String       @id @default(cuid())
  organization_id     String       @db.VarChar(36)
  name                String       @db.VarChar(255)
  pipeline_id         String?      @db.VarChar(36)
  stage_id            String?      @db.VarChar(36)
  owner_id            String?      @db.VarChar(36)
  fields              Json         @db.JsonB   // [{ key, label, type, required, options }]
  custom_css          String?      @db.Text
  success_message     String?      @db.Text
  redirect_url        String?      @db.VarChar(500)
  embed_key           String       @db.VarChar(64)   // used in public embed URL
  submissions_count   Int          @default(0)
  is_active           Boolean      @default(true)
  deleted_at          DateTime?
  created_at          DateTime     @default(now())

  // Relations
  organization        Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  pipeline            CrmPipeline? @relation(fields: [pipeline_id], references: [id])
  stage               CrmStage?    @relation(fields: [stage_id], references: [id])
  owner               User?        @relation(fields: [owner_id], references: [id])
  submissions         CrmWebFormSubmission[]

  @@unique([embed_key])
  @@index([organization_id])
  @@index([organization_id, is_active])
  @@map("crm_web_forms")
}
```

### 2.22 CrmWebFormSubmission

```prisma
model CrmWebFormSubmission {
  id           String     @id @default(cuid())
  form_id      String     @db.VarChar(36)
  data         Json       @db.JsonB           // raw field key→value map
  contact_id   String?    @db.VarChar(36)     // matched/created contact
  lead_id      String?    @db.VarChar(36)     // matched/created deal
  ip_address   String?    @db.VarChar(45)     // supports IPv6
  user_agent   String?    @db.Text
  utm_source   String?    @db.VarChar(255)
  utm_medium   String?    @db.VarChar(255)
  utm_campaign String?    @db.VarChar(255)
  utm_term     String?    @db.VarChar(255)
  utm_content  String?    @db.VarChar(255)
  referrer     String?    @db.VarChar(1000)
  created_at   DateTime   @default(now())

  // Relations
  form         CrmWebForm @relation(fields: [form_id], references: [id], onDelete: Cascade)
  contact      CrmContact? @relation(fields: [contact_id], references: [id])

  @@index([form_id])
  @@index([form_id, created_at])
  @@index([contact_id])
  @@map("crm_web_form_submissions")
}
```

---

## 3. File Structure

All paths are relative to the Turborepo root `C:\xampp\htdocs\Claude\zenflow\`.

### 3.1 Prisma

```
packages/db/prisma/schema.prisma                       ← add all new models
packages/db/prisma/migrations/
  20260527_crm_v2_pipelines_stages/migration.sql
  20260527_crm_v2_accounts_contacts/migration.sql
  20260527_crm_v2_deals_products/migration.sql
  20260527_crm_v2_quotes/migration.sql
  20260527_crm_v2_activities_notes/migration.sql
  20260527_crm_v2_email_integration/migration.sql
  20260527_crm_v2_sequences/migration.sql
  20260527_crm_v2_lead_scoring/migration.sql
  20260527_crm_v2_webforms/migration.sql
  20260527_crm_v2_territories_files/migration.sql
```

### 3.2 tRPC Routers

```
packages/api/src/routers/crm/
  pipelines.router.ts
  stages.router.ts
  deals.router.ts
  contacts.router.ts
  accounts.router.ts
  activities.router.ts
  notes.router.ts
  emails.router.ts
  sequences.router.ts
  quotes.router.ts
  products.router.ts
  webforms.router.ts
  reports.router.ts
  lead-scoring.router.ts
  territories.router.ts
  files.router.ts
packages/api/src/routers/crm/index.ts                  ← merge-router export
packages/api/src/root.ts                               ← add crm router
```

### 3.3 Background Jobs

```
apps/worker/src/jobs/crm/
  sequence-step.job.ts         ← processes one sequence step per enrollment
  email-sync.job.ts            ← polls IMAP / calls Gmail/Outlook API
  deal-rotting.job.ts          ← marks deals as rotting
  lead-score-recalc.job.ts     ← recalculates scores after events
  quote-pdf.job.ts             ← generates PDF via Puppeteer
  webform-submit.job.ts        ← processes form submission → create contact/deal
apps/worker/src/queues/crm.queues.ts
```

### 3.4 Next.js App Pages

```
apps/web/src/app/(dashboard)/crm/
  page.tsx                                             ← CRM home / overview dashboard
  layout.tsx                                           ← CRM shell with sidebar nav
  contacts/
    page.tsx                                           ← contacts list (table + filters)
    [contactId]/
      page.tsx                                         ← contact detail view
      edit/page.tsx
  accounts/
    page.tsx
    [accountId]/
      page.tsx
  deals/
    page.tsx                                           ← deals list (all pipelines)
    [pipelineId]/
      page.tsx                                         ← pipeline kanban board
      list/page.tsx                                    ← pipeline list view
    [dealId]/
      page.tsx                                         ← deal detail view
  activities/
    page.tsx                                           ← activity calendar/list
  sequences/
    page.tsx
    new/page.tsx
    [sequenceId]/
      page.tsx
      edit/page.tsx
  quotes/
    page.tsx
    [quoteId]/
      page.tsx
      edit/page.tsx
  products/
    page.tsx
  webforms/
    page.tsx
    new/page.tsx
    [formId]/
      page.tsx
      edit/page.tsx
  reports/
    page.tsx                                           ← reports hub
    pipeline/page.tsx
    win-loss/page.tsx
    forecast/page.tsx
    activities/page.tsx
    leaderboard/page.tsx
  settings/
    pipelines/page.tsx
    lost-reasons/page.tsx
    lead-scoring/page.tsx
    territories/page.tsx
    email-integration/page.tsx
```

### 3.5 Public (unauthenticated) Pages

```
apps/web/src/app/(public)/
  forms/[embedKey]/page.tsx                           ← public web form embed
  quotes/[trackingPixelId]/pixel.png/route.ts         ← 1x1 tracking pixel route handler
  quotes/[quoteId]/view/page.tsx                      ← public quote viewer
```

### 3.6 Components

```
apps/web/src/components/crm/
  pipeline/
    KanbanBoard.tsx
    KanbanColumn.tsx
    DealCard.tsx
    DealMoveModal.tsx
    PipelineSettings.tsx
  deal/
    DealForm.tsx
    DealDetail.tsx
    DealTimeline.tsx
    DealProductsTable.tsx
    WonLostModal.tsx
  contact/
    ContactForm.tsx
    ContactDetail.tsx
    ContactTimeline.tsx
    LeadScoreBadge.tsx
    LifecycleStagePicker.tsx
  account/
    AccountForm.tsx
    AccountDetail.tsx
    AccountHierarchyTree.tsx
  activity/
    ActivityForm.tsx
    ActivityCalendar.tsx
    ActivityList.tsx
  note/
    NoteEditor.tsx
    NoteList.tsx
  email/
    EmailComposer.tsx
    EmailThread.tsx
    EmailSyncStatus.tsx
  sequence/
    SequenceBuilder.tsx
    SequenceStepEditor.tsx
    EnrollmentList.tsx
  quote/
    QuoteBuilder.tsx
    QuoteLineEditor.tsx
    QuotePreview.tsx
    QuotePDFViewer.tsx
  product/
    ProductForm.tsx
    ProductPicker.tsx
  webform/
    WebFormBuilder.tsx
    WebFormPreview.tsx
    WebFormEmbed.tsx
    SubmissionList.tsx
  reports/
    PipelineFunnelChart.tsx
    WinLossChart.tsx
    ForecastChart.tsx
    ActivityHeatmap.tsx
    LeaderboardTable.tsx
  shared/
    EntityTimeline.tsx
    FileUploadZone.tsx
    TagInput.tsx
    CustomFieldsRenderer.tsx
    QuickAddButton.tsx
```

### 3.7 Utilities & Helpers

```
packages/api/src/lib/crm/
  lead-scoring.ts               ← score calculation engine
  deal-rotting.ts               ← rotting detection logic
  email-sync/
    gmail.adapter.ts
    outlook.adapter.ts
    imap.adapter.ts
  quote-pdf/
    template.tsx                ← React component for PDF layout
    generator.ts                ← Puppeteer orchestration
  sequence-engine.ts            ← step execution logic
  forecast.ts                   ← win rate / forecast calc
  territory-matcher.ts

apps/web/src/lib/crm/
  kanban-utils.ts
  timeline-utils.ts
  currency-format.ts
```

---

## 4. tRPC Procedures

> All CRM routers are protected procedures (`protectedProcedure`) requiring authentication.  
> `orgId` is always inferred from `ctx.session.user.organizationId`.

### 4.1 crm.pipelines

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({})` | Returns all non-deleted pipelines for org, ordered by `position` |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Returns pipeline + stages |
| `create` | mutation | `z.object({ name: z.string().min(1).max(255), description: z.string().optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), currency: z.string().length(3).default("USD"), winProbabilityEnabled: z.boolean().default(true), rottingEnabled: z.boolean().default(false), rottingDays: z.number().int().min(1).max(365).default(14) })` | Creates pipeline and auto-creates 5 default stages |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: PipelineUpdateSchema })` | Updates pipeline settings |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete. Refuses if pipeline has open deals |
| `reorder` | mutation | `z.object({ orderedIds: z.array(z.string().cuid()) })` | Updates `position` for all pipelines |
| `setDefault` | mutation | `z.object({ id: z.string().cuid() })` | Clears `is_default` on all others, sets on target |

### 4.2 crm.stages

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ pipelineId: z.string().cuid() })` | Stages for pipeline ordered by position |
| `create` | mutation | `z.object({ pipelineId: z.string(), name: z.string().min(1).max(255), color: z.string(), probability: z.number().min(0).max(100), stageType: z.enum(["active","won","lost"]).default("active"), rottable: z.boolean().default(true) })` | Appends stage to pipeline |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: StageUpdateSchema })` | Updates stage; recalculates `weighted_amount` on deals in stage |
| `delete` | mutation | `z.object({ id: z.string().cuid(), moveTo: z.string().cuid().optional() })` | Deletes stage, optionally migrates deals |
| `reorder` | mutation | `z.object({ pipelineId: z.string().cuid(), orderedIds: z.array(z.string().cuid()) })` | Batch-updates `position` |

### 4.3 crm.accounts

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ cursor: z.string().optional(), limit: z.number().int().min(1).max(100).default(25), filters: AccountFilterSchema, sort: AccountSortSchema })` | Paginated account list |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Account + contacts + deals + recent activities |
| `create` | mutation | `AccountCreateSchema` | Creates account; triggers territory matching |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: AccountUpdateSchema })` | Updates, recalcs territory |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete |
| `bulkDelete` | mutation | `z.object({ ids: z.array(z.string().cuid()) })` | Soft-delete multiple |
| `merge` | mutation | `z.object({ primaryId: z.string().cuid(), duplicateId: z.string().cuid() })` | Merges duplicate into primary: moves contacts/deals, soft-deletes duplicate |
| `import` | mutation | `z.object({ rows: z.array(AccountImportRowSchema), dedupeField: z.enum(["email","domain","name"]) })` | Bulk import with deduplication |

### 4.4 crm.contacts

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ cursor: z.string().optional(), limit: z.number().int().min(1).max(100).default(25), filters: ContactFilterSchema, sort: ContactSortSchema })` | Paginated, filterable contact list |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Contact + account + deals + timeline |
| `create` | mutation | `ContactCreateSchema` | Creates contact; triggers lead score initialization |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: ContactUpdateSchema })` | Updates contact; triggers score re-eval if relevant fields change |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete |
| `bulkUpdate` | mutation | `z.object({ ids: z.array(z.string().cuid()), data: ContactBulkUpdateSchema })` | Batch update owner/stage/tags |
| `import` | mutation | `z.object({ rows: z.array(ContactImportRowSchema), dedupeField: z.enum(["email"]) })` | CSV import |
| `getTimeline` | query | `z.object({ contactId: z.string().cuid(), cursor: z.string().optional(), limit: z.number().default(20) })` | Unified timeline: notes, emails, activities, deals sorted by date |
| `unsubscribe` | mutation | `z.object({ contactId: z.string().cuid() })` | Sets `unsubscribed=true`, exits all active sequences |

### 4.5 crm.deals

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ pipelineId: z.string().cuid().optional(), filters: DealFilterSchema, sort: DealSortSchema, cursor: z.string().optional(), limit: z.number().default(25) })` | Paginated deal list |
| `getKanbanData` | query | `z.object({ pipelineId: z.string().cuid() })` | All deals in pipeline grouped by stage_id for kanban |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Deal + stage + products + quotes + timeline |
| `create` | mutation | `DealCreateSchema` | Creates deal; records `stage_changed_at` |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: DealUpdateSchema })` | Updates deal; recomputes `weighted_amount` |
| `moveStage` | mutation | `z.object({ dealId: z.string().cuid(), stageId: z.string().cuid(), pipelineId: z.string().cuid() })` | Moves deal; updates `stage_changed_at`; checks if stage is won/lost |
| `markWon` | mutation | `z.object({ dealId: z.string().cuid(), wonAt: z.date().optional(), winReason: z.string().max(500).optional() })` | Sets `won_at`, moves to won stage, lifecycle stage → customer |
| `markLost` | mutation | `z.object({ dealId: z.string().cuid(), lostReasonId: z.string().cuid().optional(), notes: z.string().optional() })` | Sets `lost_at`, moves to lost stage |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete |
| `bulkMove` | mutation | `z.object({ dealIds: z.array(z.string().cuid()), stageId: z.string().cuid() })` | Move multiple deals to stage |
| `reorder` | mutation | `z.object({ stageId: z.string().cuid(), orderedIds: z.array(z.string().cuid()) })` | Drag-drop reorder within stage |
| `getTimeline` | query | `z.object({ dealId: z.string().cuid(), cursor: z.string().optional() })` | Timeline for deal |

### 4.6 crm.activities

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ entityType: CrmEntityTypeEnum.optional(), entityId: z.string().optional(), ownerId: z.string().optional(), status: CrmActivityStatusEnum.optional(), dateFrom: z.date().optional(), dateTo: z.date().optional(), cursor: z.string().optional() })` | Filterable activity list |
| `create` | mutation | `ActivityCreateSchema` | Creates activity; updates `last_activity_at` on entity |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: ActivityUpdateSchema })` | Updates |
| `complete` | mutation | `z.object({ id: z.string().cuid(), outcome: z.string().max(100).optional(), nextAction: z.string().max(500).optional() })` | Marks complete; optionally creates follow-up |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Hard delete |
| `getCalendarData` | query | `z.object({ startDate: z.date(), endDate: z.date(), ownerId: z.string().optional() })` | Activities in date range for calendar view |

### 4.7 crm.notes

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ entityType: CrmEntityTypeEnum, entityId: z.string().cuid() })` | All notes for entity, pinned first |
| `create` | mutation | `z.object({ entityType: CrmEntityTypeEnum, entityId: z.string().cuid(), content: z.string().min(1), isPinned: z.boolean().default(false) })` | Create note |
| `update` | mutation | `z.object({ id: z.string().cuid(), content: z.string().min(1), isPinned: z.boolean().optional() })` | Edit note |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete |
| `pin` | mutation | `z.object({ id: z.string().cuid(), isPinned: z.boolean() })` | Toggle pin |

### 4.8 crm.emails

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `getIntegrations` | query | `z.object({})` | List email integrations for current user |
| `connectGmail` | mutation | `z.object({ code: z.string() })` | Exchange OAuth code for tokens; store encrypted; kick off initial sync |
| `connectOutlook` | mutation | `z.object({ code: z.string() })` | Same for Outlook |
| `disconnect` | mutation | `z.object({ integrationId: z.string().cuid() })` | Removes integration; cancels sync jobs |
| `getThread` | query | `z.object({ entityType: CrmEntityTypeEnum, entityId: z.string().cuid(), threadId: z.string() })` | All emails in thread |
| `send` | mutation | `z.object({ integrationId: z.string().cuid(), entityType: CrmEntityTypeEnum, entityId: z.string().cuid(), toEmails: z.array(z.string().email()), subject: z.string().max(500), htmlBody: z.string(), ccEmails: z.array(z.string().email()).default([]), threadId: z.string().optional() })` | Send email via Gmail/Outlook API; log to CrmEmailLog |
| `syncNow` | mutation | `z.object({ integrationId: z.string().cuid() })` | Manually trigger sync job |
| `getList` | query | `z.object({ entityType: CrmEntityTypeEnum, entityId: z.string().cuid(), cursor: z.string().optional() })` | Paginated email log for entity |

### 4.9 crm.sequences

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ status: CrmSequenceStatusEnum.optional() })` | All sequences for org |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Sequence + steps + enrollment stats |
| `create` | mutation | `SequenceCreateSchema` | Creates sequence in draft |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: SequenceUpdateSchema })` | Update name/trigger/goal |
| `updateSteps` | mutation | `z.object({ sequenceId: z.string().cuid(), steps: z.array(SequenceStepSchema) })` | Full replace of steps array (position-ordered) |
| `activate` | mutation | `z.object({ id: z.string().cuid() })` | Status → active; validates at least 1 step exists |
| `pause` | mutation | `z.object({ id: z.string().cuid() })` | Status → paused; pauses all active enrollments |
| `enroll` | mutation | `z.object({ sequenceId: z.string().cuid(), contactIds: z.array(z.string().cuid()), dealId: z.string().cuid().optional() })` | Enrolls contacts; validates not already enrolled; creates BullMQ job for step 1 |
| `exit` | mutation | `z.object({ enrollmentId: z.string().cuid(), reason: z.string().max(255) })` | Exits enrollment, cancels pending jobs |
| `getEnrollments` | query | `z.object({ sequenceId: z.string().cuid(), status: CrmEnrollmentStatusEnum.optional(), cursor: z.string().optional() })` | Paginated enrollment list |

### 4.10 crm.quotes

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ dealId: z.string().cuid().optional(), status: CrmQuoteStatusEnum.optional(), cursor: z.string().optional() })` | Paginated quote list |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Quote + lines + deal |
| `create` | mutation | `z.object({ dealId: z.string().cuid(), title: z.string().min(1).max(255), contactId: z.string().cuid().optional(), validUntil: z.date().optional(), notes: z.string().optional(), terms: z.string().optional() })` | Creates draft quote; auto-generates `number` sequence |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: QuoteUpdateSchema })` | Updates meta |
| `updateLines` | mutation | `z.object({ quoteId: z.string().cuid(), lines: z.array(QuoteLineSchema) })` | Full replace lines; recalculates subtotal/tax/total |
| `send` | mutation | `z.object({ quoteId: z.string().cuid(), toEmail: z.string().email(), message: z.string().optional() })` | Dispatches PDF generation job, sends email with PDF attachment, sets status → sent |
| `markAccepted` | mutation | `z.object({ quoteId: z.string().cuid() })` | Status → accepted; updates deal probability |
| `markRejected` | mutation | `z.object({ quoteId: z.string().cuid() })` | Status → rejected |
| `generatePdf` | mutation | `z.object({ quoteId: z.string().cuid() })` | Queues PDF job; returns job ID |
| `trackOpen` | publicProcedure | `z.object({ pixelId: z.string().length(64) })` | Called by pixel route; increments open_count; sets first_opened_at |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Hard delete if draft, soft delete otherwise |

### 4.11 crm.products

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ isActive: z.boolean().optional(), category: z.string().optional(), cursor: z.string().optional() })` | Product catalog for org |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Product detail |
| `create` | mutation | `ProductCreateSchema` | Create product |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: ProductUpdateSchema })` | Update |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete |
| `bulkImport` | mutation | `z.object({ rows: z.array(ProductImportRowSchema) })` | CSV import |

### 4.12 crm.webforms

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({})` | All web forms for org |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Form + submission count |
| `getByEmbedKey` | publicProcedure | `z.object({ embedKey: z.string().length(64) })` | Public; returns form schema for render |
| `create` | mutation | `WebFormCreateSchema` | Creates form; generates unique `embed_key` |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: WebFormUpdateSchema })` | Update |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete |
| `submit` | publicProcedure | `z.object({ embedKey: z.string(), data: z.record(z.unknown()), utmParams: UTMSchema.optional(), referrer: z.string().optional() })` | Public; validates required fields; queues webform-submit job |
| `getSubmissions` | query | `z.object({ formId: z.string().cuid(), cursor: z.string().optional(), limit: z.number().default(25) })` | Paginated submissions |

### 4.13 crm.reports

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `getPipelineSummary` | query | `z.object({ pipelineId: z.string().cuid().optional(), dateFrom: z.date(), dateTo: z.date() })` | Total deals, total value, avg deal size, conversion rate per stage |
| `getWinLossAnalysis` | query | `z.object({ dateFrom: z.date(), dateTo: z.date(), groupBy: z.enum(["owner","source","deal_type","lost_reason"]) })` | Win/loss counts and amounts grouped by selected dimension |
| `getForecast` | query | `z.object({ pipelineId: z.string().cuid(), period: z.enum(["this_month","next_month","this_quarter"]) })` | Weighted pipeline forecast = SUM(amount * probability/100) for open deals closing in period |
| `getActivityReport` | query | `z.object({ ownerId: z.string().optional(), dateFrom: z.date(), dateTo: z.date() })` | Activity counts by type and outcome |
| `getLeaderboard` | query | `z.object({ metric: z.enum(["deals_won","revenue","activities","avg_deal_size"]), dateFrom: z.date(), dateTo: z.date() })` | Top reps by selected metric |
| `getVelocityReport` | query | `z.object({ pipelineId: z.string().cuid(), dateFrom: z.date(), dateTo: z.date() })` | Avg time-in-stage, total cycle time for closed deals |

---

## 5. Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/crm` | `CrmDashboardPage` | Overview: deal forecast widget, recent activities, open tasks, pipeline funnel mini-chart |
| `/crm/contacts` | `ContactsListPage` | Table with infinite scroll, column sorting, filter sidebar (lifecycle, owner, tags, score range), bulk actions, quick-create |
| `/crm/contacts/[contactId]` | `ContactDetailPage` | Contact header with score badge, tabs: Overview, Timeline, Deals, Emails, Notes, Files, Sequences |
| `/crm/accounts` | `AccountsListPage` | Accounts table, filters by industry/size/owner, search by name/domain |
| `/crm/accounts/[accountId]` | `AccountDetailPage` | Account header, tabs: Contacts, Deals, Timeline, Files, Notes |
| `/crm/deals` | `DealsListPage` | All deals across pipelines; table view with filters |
| `/crm/deals/[pipelineId]` | `PipelineKanbanPage` | Kanban board for pipeline; drag-drop between stages; rotting badge on stale deals |
| `/crm/deals/[pipelineId]/list` | `PipelineListPage` | List/table view of pipeline deals |
| `/crm/deals/[dealId]` | `DealDetailPage` | Deal header, stage progress bar, tabs: Overview, Products, Quotes, Timeline, Emails, Notes, Files |
| `/crm/activities` | `ActivitiesPage` | Calendar view (monthly/weekly/day) + list toggle; filter by owner/type/status |
| `/crm/sequences` | `SequencesListPage` | Sequence cards with enrolled/completed stats |
| `/crm/sequences/new` | `NewSequencePage` | Sequence name/trigger config wizard |
| `/crm/sequences/[sequenceId]` | `SequenceDetailPage` | Step builder drag-drop interface + enrollment table + stats |
| `/crm/sequences/[sequenceId]/edit` | `EditSequencePage` | Edit steps |
| `/crm/quotes` | `QuotesListPage` | All quotes with status filter |
| `/crm/quotes/[quoteId]` | `QuoteDetailPage` | Quote preview + status history |
| `/crm/quotes/[quoteId]/edit` | `QuoteEditorPage` | Line item editor with product picker + real-time total calc |
| `/crm/products` | `ProductCatalogPage` | Product table with CRUD actions |
| `/crm/webforms` | `WebFormsListPage` | Forms with embed snippet + submission count |
| `/crm/webforms/new` | `NewWebFormPage` | Drag-drop field builder |
| `/crm/webforms/[formId]` | `WebFormDetailPage` | Form details + submissions table + embed code |
| `/crm/reports` | `ReportsHubPage` | Links to sub-reports + key metric cards |
| `/crm/reports/pipeline` | `PipelineReportPage` | Funnel + time-in-stage bar chart |
| `/crm/reports/win-loss` | `WinLossReportPage` | Win/loss pie + grouped bar by dimension |
| `/crm/reports/forecast` | `ForecastReportPage` | Weighted forecast by month + confidence bands |
| `/crm/reports/activities` | `ActivitiesReportPage` | Activity volume by type over time |
| `/crm/reports/leaderboard` | `LeaderboardPage` | Rep performance table |
| `/crm/settings/pipelines` | `PipelineSettingsPage` | Create/edit/reorder pipelines + stages |
| `/crm/settings/lost-reasons` | `LostReasonsSettingsPage` | CRUD for lost reason options |
| `/crm/settings/lead-scoring` | `LeadScoringSettingsPage` | Rule builder for demographic + behavioral rules |
| `/crm/settings/territories` | `TerritoriesSettingsPage` | Territory rule builder |
| `/crm/settings/email-integration` | `EmailIntegrationPage` | Connect Gmail/Outlook, sync status |
| `/forms/[embedKey]` | `PublicWebFormPage` | Unauthenticated public form (no app shell) |
| `/quotes/[quoteId]/view` | `PublicQuoteViewPage` | Unauthenticated quote viewer with accept/reject buttons |

---

## 6. Business Logic

### 6.1 Lead Scoring Calculation

**Location:** `packages/api/src/lib/crm/lead-scoring.ts`

The lead score is a running integer on `CrmContact.lead_score`. It is recalculated whenever a relevant event occurs (contact field update, new activity, deal stage change).

**Algorithm:**

```typescript
// Pseudocode — full implementation in lead-scoring.ts
async function recalculateLeadScore(contactId: string): Promise<number> {
  const rules = await db.crmLeadScoreRule.findMany({
    where: { organization_id: orgId, is_active: true }
  });

  let score = 0;

  for (const rule of rules) {
    const fieldValue = resolveFieldPath(contact, rule.field_path);
    // field_path examples:
    //   "job_title"          → contact.job_title
    //   "account.size"       → contact.account.size
    //   "last_activity_at"   → contact.last_activity_at
    //   "deal.stage_type"    → any deal for contact with stage_type

    if (evaluateOperator(rule.operator, fieldValue, rule.value)) {
      score += rule.score_change; // can be negative
    }
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  await db.crmContact.update({
    where: { id: contactId },
    data: { lead_score: score }
  });

  return score;
}
```

**Triggers:**
- `CrmContact.update` (any field change)
- New `CrmActivity` for contact
- `CrmDeal` stage change where deal is linked to contact
- Email open/click event

### 6.2 Deal Rotting Detection

**Location:** `apps/worker/src/jobs/crm/deal-rotting.job.ts`  
**Queue:** `crm:rotting-check` — runs via BullMQ every hour via cron `0 * * * *`

```
For each organization with rotting_enabled=true:
  For each pipeline where rotting_enabled=true:
    rottingThreshold = pipeline.rotting_days (days)
    For each open deal in pipeline (stage.stage_type = 'active'):
      lastActivity = MAX(deal.last_activity_at, deal.stage_changed_at)
      if lastActivity < NOW() - rottingThreshold days:
        SET deal.rotting = true
      else:
        SET deal.rotting = false (clear if previously rotting)
    Notify owners of newly-rotted deals (in-app notification)
```

### 6.3 Email Sync (Gmail / Outlook OAuth)

**Location:** `apps/worker/src/jobs/crm/email-sync.job.ts`

Two modes based on provider:

**Gmail (full Gmail API with push notifications):**
1. On `connectGmail`: register Gmail push notification webhook via `users.watch()` pointing to `/api/webhooks/gmail`
2. Incoming webhook POST → verify `X-Goog-Channel-Token` header → decode pubsub message → fetch changed messages via `users.messages.list(q: "after:<lastHistoryId>")` → parse → match sender/recipient against contacts → upsert `CrmEmailLog`
3. BullMQ job `email-sync` runs daily as fallback to reconcile any missed webhooks

**Outlook (Microsoft Graph webhook):**
1. On `connectOutlook`: create subscription at `/v1.0/subscriptions` for `mail.*` events, pointing to `/api/webhooks/outlook`
2. Incoming notification → validate `validationToken` challenge → fetch mail details → upsert `CrmEmailLog`

**SMTP (fallback — IMAP polling):**
1. BullMQ repeatable job polls every 15 minutes via `imapflow` library
2. Fetches UNSEEN messages from INBOX and Sent folders
3. Parses `Message-ID` header for deduplication (unique index on `message_id`)
4. Matches `from_email` / `to_emails` against org contacts via exact email match

**Contact matching logic:**
```
Given an email message:
  Collect all addresses (from + to + cc)
  For each address: look up CrmContact by email within org
  If found: associate email log with that contact
  If not found and direction=inbound: optionally auto-create contact (org setting)
```

### 6.4 Sequence Execution (BullMQ)

**Location:** `apps/worker/src/jobs/crm/sequence-step.job.ts`

```
Job data: { enrollmentId: string, stepPosition: number }

1. Load enrollment + sequence + current step
2. If enrollment.status != 'active': abort
3. If contact.unsubscribed: exit enrollment with reason='unsubscribed'
4. Execute step by type:
   - email: build personalized email from step.body (Handlebars merge tags),
             send via contact's assigned integration or org default SMTP,
             log to CrmEmailLog
   - task:  create CrmActivity of type=task for deal/contact owner
   - call:  create CrmActivity of type=call (reminder for rep)
   - wait:  no-op; next scheduling handles delay
   - sms:   dispatch to SMS gateway (Twilio)
5. Advance enrollment:
   - current_step_position += 1
   - If no next step: status = 'completed', completed_at = NOW()
   - Else: calculate next_step_at:
       nextStep.wait_days * 86400 + nextStep.wait_hours * 3600 seconds from now
       If wait_until_time set: push forward to that local time on the resulting day
   - Schedule BullMQ delayed job with delay = (next_step_at - NOW()) ms
```

### 6.5 Quote PDF Generation

**Location:** `apps/worker/src/jobs/crm/quote-pdf.job.ts`

```
1. Job data: { quoteId: string }
2. Load quote + lines + deal + org branding (logo, address)
3. Render React component `packages/api/src/lib/crm/quote-pdf/template.tsx` to HTML string
   using `@react-pdf/renderer` (server-side)
4. Use Puppeteer (headless Chrome) to:
   a. Open blank page
   b. setContent(htmlString)
   c. page.pdf({ format: 'A4', printBackground: true })
5. Upload resulting Buffer to MinIO:
   bucket: "crm-quotes"
   path: "quotes/{orgId}/{quoteId}/quote_{number}.pdf"
6. Store MinIO public URL in CrmQuote.pdf_url
7. On completion: if triggered by send action, proceed to email dispatch
```

Quote HTML template includes: org logo, quote number/date, contact details, line items table, subtotal/discount/tax/total rows, terms footer, and a `<img src="/api/pixel/{trackingPixelId}" width="1" height="1">` open-tracking pixel.

### 6.6 Win Rate Forecasting Algorithm

**Location:** `packages/api/src/lib/crm/forecast.ts`

```
Input: pipelineId, period (month/quarter)

1. Load all open deals in pipeline where expected_close_date falls in period
2. For each deal:
   weighted_value = deal.amount * (deal.probability ?? stage.probability) / 100
3. Sum all weighted_values = weighted_forecast
4. Sum all deal.amount = best_case_forecast
5. Historical win_rate = (won deals in last 6 months) / (total closed deals)
6. Commit forecast = weighted_forecast * historical_win_rate
7. Return: { bestCase, weighted, commit, dealCount, avgDealSize, closingDeals[] }
```

---

## 7. External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-pdf/renderer` | `^3.4.4` | Quote PDF rendering |
| `puppeteer-core` | `^22.10.0` | PDF HTML→PDF via headless Chrome |
| `@chromium/browser-snapshots` | `latest` | Chromium binary for Puppeteer |
| `imapflow` | `^1.0.162` | IMAP connection for SMTP email sync |
| `nodemailer` | `^6.9.14` | SMTP email sending |
| `googleapis` | `^140.0.0` | Gmail API client |
| `@microsoft/microsoft-graph-client` | `^3.0.7` | Outlook/Graph API client |
| `handlebars` | `^4.7.8` | Email template merge tags |
| `rrule` | `^2.8.1` | RFC 5545 recurrence rule parsing |
| `libphonenumber-js` | `^1.11.8` | Phone number validation/formatting |
| `csv-parse` | `^5.5.6` | CSV import parsing |
| `papaparse` | `^5.4.1` | Client-side CSV parsing |
| `@dnd-kit/core` | `^6.1.0` | Kanban drag-and-drop |
| `@dnd-kit/sortable` | `^8.0.0` | Sortable stage columns |
| `recharts` | `^2.12.7` | CRM report charts |
| `date-fns` | `^3.6.0` | Date arithmetic for rotting/forecasting |
| `crypto-js` | `^4.2.0` | OAuth token encryption (AES-256-GCM) |
| `currency.js` | `^2.0.4` | Precise currency arithmetic |
| `sharp` | `^0.33.4` | Image processing for tracking pixel |
| `@tanstack/react-table` | `^8.17.3` | Table with virtual scroll |
| `react-hook-form` | `^7.51.5` | Form management |
| `@hookform/resolvers` | `^3.6.0` | Zod resolver for RHF |
| `zod` | `^3.23.8` | Schema validation |
| `bullmq` | `^5.12.0` | Job queue (already in project) |
| `ioredis` | `^5.3.2` | Redis client for BullMQ (already in project) |
| `minio` | `^8.0.1` | MinIO client (already in project) |
| `@fullcalendar/react` | `^6.1.14` | Activity calendar view |
| `@fullcalendar/daygrid` | `^6.1.14` | Calendar month/week view |
| `@fullcalendar/timegrid` | `^6.1.14` | Calendar time grid |
| `@fullcalendar/interaction` | `^6.1.14` | Calendar drag interactions |

---

*End of Document 1: CRM v2 Implementation Specification*
