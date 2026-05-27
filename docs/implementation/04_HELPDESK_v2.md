# ZenFlow — Help Desk Module v2 Implementation

**Document:** 04_HELPDESK_v2.md  
**Version:** 2.0.0  
**Date:** 2026-05-27  
**Author:** Mohit Yadav  
**Stack:** Next.js 15 App Router · TypeScript 5 · tRPC v11 · Prisma v6 · PostgreSQL 16 · Shadcn/UI · BullMQ · Redis · MinIO · Turborepo

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Database Schema — Complete Prisma Models](#2-database-schema--complete-prisma-models)
3. [File Structure](#3-file-structure)
4. [tRPC Routers & Procedures](#4-trpc-routers--procedures)
5. [Pages & Routes](#5-pages--routes)
6. [Business Logic Deep Dive](#6-business-logic-deep-dive)
7. [BullMQ Workers & Cron Jobs](#7-bullmq-workers--cron-jobs)
8. [npm Packages](#8-npm-packages)

---

## 1. Overview & Architecture

Help Desk v2 transforms ZenFlow's basic ticket tracker into a full customer support platform matching Freshdesk/Zendesk capabilities:

- **Omni-channel Inboxes** — Email-to-ticket, web portal, API, WhatsApp, social media
- **SLA Engine** — Business-hours-aware timers, escalation rules, breach alerts
- **Intelligent Routing** — Rule-based assignment, round-robin, load balancing
- **Knowledge Base** — Public/private articles with version history, CSAT deflection tracking
- **Automation Engine** — Event-triggered actions (auto-assign, auto-close, tag, escalate)
- **CSAT** — Survey dispatch, rating collection, reporting
- **Reporting** — Volume, first response time, resolution time, agent performance, CSAT scores

### System Architecture

```
Inbound Email (IMAP/Webhook)
         ↓
  emailInboxQueue (BullMQ)
         ↓
  EmailProcessor Worker
  ├── Deduplicate (email_message_id)
  ├── Parse HTML → plain text
  ├── Create/Reply to HdTicket
  ├── Attach files → MinIO
  └── Run Routing Rules → Assign agent/team

HTTP Request (API/Portal)
         ↓
  tRPC hd.tickets.create
  ├── Auto-increment ticket_number
  ├── Apply SLA policy (slaEngine.assignPolicy)
  ├── Run Routing Rules
  └── Enqueue SLA timer job (slaTimerQueue)

SLA Timer Job (BullMQ Delayed)
  ├── First response: warn at 75%, breach at 100%
  ├── Resolution: warn, breach, escalate
  └── Update sla_status field

Automation Engine
  ├── Trigger events emitted via EventEmitter
  ├── Evaluate conditions in order
  └── Execute actions (assign, tag, email, close)
```

---

## 2. Database Schema — Complete Prisma Models

> All models prefix with `Hd` to avoid conflicts. The existing `Ticket`, `TicketReply`, `TicketCategory`, `SlaPolicy`, `KnowledgeBaseArticle` models must be replaced.

### 2.1 Enums (Help Desk–Specific)

```prisma
enum HdTicketChannel {
  email
  web
  chat
  whatsapp
  phone
  social
  portal
  api
}

enum HdTicketStatus {
  open
  in_progress
  pending
  resolved
  closed
}

enum HdTicketPriority {
  low
  medium
  high
  urgent
}

enum HdTicketType {
  question
  incident
  problem
  task
  feature_request
}

enum HdSlaStatus {
  ok
  warning
  breached_first
  breached_resolution
}

enum HdReplyType {
  reply
  note
  auto_reply
  system
}

enum HdSentVia {
  email
  ui
  api
}

enum HdAutoAssign {
  none
  round_robin
  load_balanced
}

enum HdTeamMemberRole {
  member
  lead
}

enum HdArticleStatus {
  draft
  published
  archived
}

enum HdArticleVisibility {
  public
  agents_only
  org_only
}

enum HdEmailProvider {
  gmail
  outlook
  other
}

enum HdSatisfactionScale {
  five_star
  ten_point
  emoji
}

enum HdTriggerEvent {
  ticket_created
  reply_received
  status_changed
  assigned
  idle_n_hours
  sla_breached
  resolved
}
```

---

### 2.2 HdTicket (Full Upgrade)

```prisma
model HdTicket {
  id                      String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id         String            @db.Uuid
  ticket_number           String            @db.VarChar(20)
  subject                 String            @db.VarChar(500)
  description             String?           @db.Text
  description_html        String?           @db.Text

  // --- Classification ---
  channel                 HdTicketChannel   @default(web)
  priority                HdTicketPriority  @default(medium)
  type                    HdTicketType      @default(question)
  status                  HdTicketStatus    @default(open)
  category_id             String?           @db.Uuid
  sub_category_id         String?           @db.Uuid
  product_id              String?           @db.Uuid
  version                 String?           @db.VarChar(50)
  os_browser              String?           @db.VarChar(255)
  tags                    String[]
  custom_fields           Json?             @db.JsonB

  // --- Assignment ---
  assignee_id             String?           @db.Uuid
  team_id                 String?           @db.Uuid
  creator_id              String?           @db.Uuid

  // --- Contact / Company ---
  contact_id              String?           @db.Uuid
  company_id              String?           @db.Uuid
  requester_name          String?           @db.VarChar(200)
  requester_email         String?           @db.VarChar(255)
  cc_emails               String[]

  // --- SLA ---
  sla_policy_id           String?           @db.Uuid
  first_response_due_at   DateTime?
  resolution_due_at       DateTime?
  first_responded_at      DateTime?
  sla_status              HdSlaStatus       @default(ok)

  // --- Timestamps ---
  resolved_at             DateTime?
  closed_at               DateTime?
  reopened_at             DateTime?
  reopen_count            Int               @default(0)

  // --- CSAT ---
  satisfaction_rating     Int?
  satisfaction_comment    String?           @db.Text
  satisfaction_sent_at    DateTime?

  // --- Merge / Parent ---
  merged_into_id          String?           @db.Uuid
  parent_ticket_id        String?           @db.Uuid

  // --- Misc ---
  spam                    Boolean           @default(false)
  time_tracked_minutes    Int               @default(0)
  source_email_message_id String?           @db.VarChar(500)

  created_at              DateTime          @default(now())
  updated_at              DateTime          @updatedAt
  deleted_at              DateTime?

  // --- Relations ---
  organization   Organization      @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  category       HdCategory?       @relation("TicketCategory", fields: [category_id], references: [id])
  sub_category   HdCategory?       @relation("TicketSubCategory", fields: [sub_category_id], references: [id])
  sla_policy     HdSlaPolicy?      @relation(fields: [sla_policy_id], references: [id])
  team           HdTeam?           @relation(fields: [team_id], references: [id])
  merged_into    HdTicket?         @relation("TicketMerge", fields: [merged_into_id], references: [id])
  merged_tickets HdTicket[]        @relation("TicketMerge")
  parent_ticket  HdTicket?         @relation("TicketChild", fields: [parent_ticket_id], references: [id])
  child_tickets  HdTicket[]        @relation("TicketChild")
  replies        HdTicketReply[]
  time_logs      HdTimeLog[]
  email_inbox    HdEmailInbox?     @relation(fields: [/* link via reply routing */])

  @@unique([organization_id, ticket_number])
  @@index([organization_id, status])
  @@index([organization_id, priority])
  @@index([assignee_id])
  @@index([team_id])
  @@index([sla_status])
  @@index([created_at])
  @@index([requester_email])
  @@map("hd_tickets")
}
```

---

### 2.3 HdTicketReply

```prisma
model HdTicketReply {
  id              String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ticket_id       String      @db.Uuid
  body            String      @db.Text
  body_html       String?     @db.Text
  reply_type      HdReplyType @default(reply)
  is_public       Boolean     @default(true)
  from_email      String?     @db.VarChar(255)
  from_name       String?     @db.VarChar(200)
  to_emails       String[]
  cc_emails       String[]
  bcc_emails      String[]
  attachments     Json?
  // attachments shape: Array<{ name: string; url: string; size: number; mime_type: string }>
  sent_via        HdSentVia   @default(ui)
  email_message_id String?    @db.VarChar(500)
  created_by      String?     @db.Uuid   // null for customer replies via email
  created_at      DateTime    @default(now())

  ticket HdTicket @relation(fields: [ticket_id], references: [id], onDelete: Cascade)

  @@index([ticket_id])
  @@index([created_at])
  @@map("hd_ticket_replies")
}
```

---

### 2.4 HdSlaPolicy

```prisma
model HdSlaPolicy {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id      String    @db.Uuid
  name                 String    @db.VarChar(200)
  description          String?   @db.Text
  is_default           Boolean   @default(false)
  business_hours_id    String?   @db.Uuid
  conditions           Json?
  // conditions shape: Array<{ field: string; operator: string; value: any }>
  first_response_hours Json
  // shape: { low: 8, medium: 4, high: 2, urgent: 1 }
  resolution_hours     Json
  // shape: { low: 72, medium: 24, high: 8, urgent: 4 }
  escalation_rules     Json?
  // shape: Array<{ at_percent: number; action: "notify"|"reassign"; notify_ids: string[]; reassign_to?: string }>
  is_active            Boolean   @default(true)
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt

  organization   Organization  @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  business_hours HdBusinessHours? @relation(fields: [business_hours_id], references: [id])
  tickets        HdTicket[]

  @@index([organization_id])
  @@map("hd_sla_policies")
}
```

---

### 2.5 HdBusinessHours

```prisma
model HdBusinessHours {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id     String   @db.Uuid
  name                String   @db.VarChar(100)
  timezone            String   @db.VarChar(100)
  hours               Json
  // shape: {
  //   monday:    { open: boolean; start: "09:00"; end: "18:00" };
  //   tuesday:   { open: boolean; start: "09:00"; end: "18:00" };
  //   ... all 7 days
  // }
  holiday_calendar_id String?  @db.VarChar(36)
  is_active           Boolean  @default(true)
  created_at          DateTime @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  sla_policies HdSlaPolicy[]
  teams        HdTeam[]

  @@index([organization_id])
  @@map("hd_business_hours")
}
```

---

### 2.6 HdCategory

```prisma
model HdCategory {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String    @db.Uuid
  name            String    @db.VarChar(100)
  description     String?   @db.Text
  color           String?   @db.VarChar(7)
  icon            String?   @db.VarChar(50)
  parent_id       String?   @db.Uuid
  position        Int       @default(0)
  is_active       Boolean   @default(true)
  created_at      DateTime  @default(now())

  organization     Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  parent           HdCategory?  @relation("CategoryHierarchy", fields: [parent_id], references: [id])
  children         HdCategory[] @relation("CategoryHierarchy")
  tickets_primary  HdTicket[]   @relation("TicketCategory")
  tickets_sub      HdTicket[]   @relation("TicketSubCategory")
  articles         HdArticle[]

  @@index([organization_id])
  @@map("hd_categories")
}
```

---

### 2.7 HdTeam & HdTeamMember

```prisma
model HdTeam {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id   String        @db.Uuid
  name              String        @db.VarChar(100)
  description       String?       @db.Text
  email             String?       @db.VarChar(255)
  auto_assign       HdAutoAssign  @default(none)
  business_hours_id String?       @db.Uuid
  is_active         Boolean       @default(true)
  created_at        DateTime      @default(now())

  organization   Organization   @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  business_hours HdBusinessHours? @relation(fields: [business_hours_id], references: [id])
  members        HdTeamMember[]
  tickets        HdTicket[]
  email_inboxes  HdEmailInbox[]

  @@index([organization_id])
  @@map("hd_teams")
}

model HdTeamMember {
  id           String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  team_id      String           @db.Uuid
  user_id      String           @db.Uuid
  role         HdTeamMemberRole @default(member)
  is_available Boolean          @default(true)
  joined_at    DateTime         @default(now())

  team HdTeam @relation(fields: [team_id], references: [id], onDelete: Cascade)

  @@unique([team_id, user_id])
  @@index([team_id])
  @@map("hd_team_members")
}
```

---

### 2.8 HdCannedResponse

```prisma
model HdCannedResponse {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String    @db.Uuid
  name            String    @db.VarChar(200)
  shortcut        String    @db.VarChar(50)
  content         String    @db.Text
  content_html    String?   @db.Text
  category        String?   @db.VarChar(100)
  created_by      String    @db.Uuid
  is_shared       Boolean   @default(true)
  usage_count     Int       @default(0)
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@unique([organization_id, shortcut])
  @@index([organization_id])
  @@map("hd_canned_responses")
}
```

---

### 2.9 HdRoutingRule

```prisma
model HdRoutingRule {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String    @db.Uuid
  name            String    @db.VarChar(200)
  priority        Int       @default(0)
  conditions      Json
  // conditions shape: Array<{
  //   field: "channel"|"priority"|"subject"|"email_domain"|"category_id";
  //   operator: "is"|"is_not"|"contains"|"matches";
  //   value: any;
  // }>
  actions         Json
  // actions shape: Array<{
  //   action: "assign_team"|"assign_agent"|"set_priority"|"set_category"|"add_tag"|"set_sla";
  //   value: any;
  // }>
  is_active       Boolean   @default(true)
  match_count     Int       @default(0)
  created_at      DateTime  @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@index([organization_id, priority])
  @@map("hd_routing_rules")
}
```

---

### 2.10 HdTimeLog

```prisma
model HdTimeLog {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ticket_id   String    @db.Uuid
  agent_id    String    @db.Uuid
  minutes     Int
  is_billable Boolean   @default(false)
  note        String?   @db.VarChar(500)
  logged_at   DateTime  @default(now())
  created_at  DateTime  @default(now())

  ticket HdTicket @relation(fields: [ticket_id], references: [id], onDelete: Cascade)

  @@index([ticket_id])
  @@map("hd_time_logs")
}
```

---

### 2.11 Knowledge Base Models

```prisma
model HdArticle {
  id                  String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id     String              @db.Uuid
  title               String              @db.VarChar(500)
  slug                String              @db.VarChar(500)
  body                String              @db.Text
  body_html           String?             @db.Text
  category_id         String?             @db.Uuid
  author_id           String              @db.Uuid
  status              HdArticleStatus     @default(draft)
  visibility          HdArticleVisibility @default(public)
  tags                String[]
  meta_description    String?             @db.VarChar(300)
  seo_keywords        String?             @db.VarChar(500)
  views_count         Int                 @default(0)
  helpful_count       Int                 @default(0)
  not_helpful_count   Int                 @default(0)
  tickets_avoided     Int                 @default(0)
  featured_image_url  String?             @db.VarChar(500)
  published_at        DateTime?
  created_at          DateTime            @default(now())
  updated_at          DateTime            @updatedAt

  organization Organization        @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  category     HdCategory?         @relation(fields: [category_id], references: [id])
  versions     HdArticleVersion[]
  feedback     HdArticleFeedback[]

  @@unique([organization_id, slug])
  @@index([organization_id, status, category_id])
  @@index([organization_id, visibility])
  @@map("hd_articles")
}

model HdArticleVersion {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  article_id     String   @db.Uuid
  version_number Int
  title          String   @db.VarChar(500)
  body           String   @db.Text
  body_html      String?  @db.Text
  changed_by     String   @db.Uuid
  change_note    String?  @db.VarChar(255)
  created_at     DateTime @default(now())

  article HdArticle @relation(fields: [article_id], references: [id], onDelete: Cascade)

  @@index([article_id])
  @@map("hd_article_versions")
}

model HdArticleFeedback {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  article_id String    @db.Uuid
  ticket_id  String?   @db.Uuid
  is_helpful Boolean
  comment    String?   @db.Text
  ip_address String?   @db.VarChar(45)
  created_at DateTime  @default(now())

  article HdArticle @relation(fields: [article_id], references: [id], onDelete: Cascade)

  @@index([article_id])
  @@map("hd_article_feedback")
}
```

---

### 2.12 HdEmailInbox

```prisma
model HdEmailInbox {
  id                  String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id     String          @db.Uuid
  name                String          @db.VarChar(100)
  email_address       String          @db.VarChar(255) @unique
  provider            HdEmailProvider @default(other)
  access_token_enc    String?         @db.Text
  refresh_token_enc   String?         @db.Text
  expires_at          DateTime?
  team_id             String?         @db.Uuid
  default_priority    HdTicketPriority @default(medium)
  is_active           Boolean         @default(true)
  last_synced_at      DateTime?
  created_at          DateTime        @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  team         HdTeam?      @relation(fields: [team_id], references: [id])

  @@index([organization_id])
  @@map("hd_email_inboxes")
}
```

---

### 2.13 HdSatisfactionSurvey

```prisma
model HdSatisfactionSurvey {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id   String              @db.Uuid
  enabled           Boolean             @default(true)
  send_after_hours  Int                 @default(24)
  question_text     String              @db.VarChar(500)
  scale_type        HdSatisfactionScale @default(five_star)
  follow_up_question String?            @db.VarChar(500)
  created_at        DateTime            @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@unique([organization_id])
  @@map("hd_satisfaction_surveys")
}
```

---

### 2.14 HdAutomationRule

```prisma
model HdAutomationRule {
  id              String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String          @db.Uuid
  name            String          @db.VarChar(200)
  trigger_event   HdTriggerEvent
  trigger_config  Json?
  // trigger_config for idle_n_hours: { idle_hours: 48 }
  conditions      Json?
  // Same format as HdRoutingRule.conditions
  actions         Json?
  // Same format as HdRoutingRule.actions + "send_email"|"close_ticket"|"change_status"
  is_active       Boolean         @default(true)
  run_count       Int             @default(0)
  last_run_at     DateTime?
  created_at      DateTime        @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@index([organization_id, trigger_event])
  @@map("hd_automation_rules")
}
```

---

### 2.15 HdRoundRobinState (Agent Assignment Tracking)

```prisma
model HdRoundRobinState {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  team_id     String   @db.Uuid @unique
  last_agent_id String? @db.Uuid
  updated_at  DateTime @updatedAt

  @@map("hd_round_robin_state")
}
```

---

## 3. File Structure

```
apps/web/src/
├── app/
│   └── (dashboard)/
│       └── helpdesk/
│           ├── layout.tsx                          # Help Desk shell: sidebar with views, inbox selector
│           ├── page.tsx                            # Agent dashboard: My Open, Unassigned, Overdue, SLA breach
│           ├── tickets/
│           │   ├── page.tsx                        # Ticket list view (all tickets, filtered)
│           │   ├── new/
│           │   │   └── page.tsx                    # Create ticket manually
│           │   └── [ticketId]/
│           │       └── page.tsx                    # Ticket detail — 2-pane layout
│           ├── views/
│           │   ├── mine/
│           │   │   └── page.tsx                    # My tickets
│           │   ├── unassigned/
│           │   │   └── page.tsx                    # Unassigned queue
│           │   ├── overdue/
│           │   │   └── page.tsx                    # Overdue / SLA breached
│           │   ├── all-open/
│           │   │   └── page.tsx                    # All open tickets
│           │   └── team/
│           │       └── [teamId]/
│           │           └── page.tsx                # Team-specific view
│           ├── kb/
│           │   ├── page.tsx                        # Knowledge base home
│           │   ├── new/
│           │   │   └── page.tsx                    # Create article
│           │   ├── [slug]/
│           │   │   ├── page.tsx                    # Article viewer
│           │   │   └── edit/
│           │   │       └── page.tsx                # Article editor
│           │   └── categories/
│           │       └── page.tsx                    # Category management
│           ├── reports/
│           │   ├── page.tsx                        # Reports dashboard
│           │   ├── volume/
│           │   │   └── page.tsx                    # Ticket volume by channel, category, date
│           │   ├── sla/
│           │   │   └── page.tsx                    # SLA compliance report
│           │   ├── agents/
│           │   │   └── page.tsx                    # Agent performance: tickets resolved, avg FRT
│           │   └── csat/
│           │       └── page.tsx                    # CSAT trend, per agent, per category
│           └── settings/
│               ├── page.tsx                        # Help Desk settings overview
│               ├── teams/
│               │   ├── page.tsx                    # Team list
│               │   └── [teamId]/
│               │       └── page.tsx                # Team detail + members
│               ├── sla/
│               │   ├── page.tsx                    # SLA policy list
│               │   └── [policyId]/
│               │       └── page.tsx                # SLA policy editor
│               ├── business-hours/
│               │   └── page.tsx                    # Business hours config
│               ├── routing/
│               │   └── page.tsx                    # Routing rules
│               ├── automation/
│               │   └── page.tsx                    # Automation rules
│               ├── canned-responses/
│               │   └── page.tsx                    # Canned response library
│               ├── email-inboxes/
│               │   └── page.tsx                    # Email inbox connections
│               ├── categories/
│               │   └── page.tsx                    # Category management
│               └── satisfaction/
│                   └── page.tsx                    # CSAT survey config
│
│   └── portal/
│       └── [orgSlug]/
│           ├── page.tsx                            # Customer portal home (KB search)
│           ├── submit/
│           │   └── page.tsx                        # Submit a ticket
│           ├── tickets/
│           │   ├── page.tsx                        # My tickets (customer)
│           │   └── [ticketId]/
│           │       └── page.tsx                    # Ticket thread (customer view)
│           └── kb/
│               ├── page.tsx                        # KB articles list
│               └── [slug]/
│                   └── page.tsx                    # KB article (public)
│
├── components/
│   └── helpdesk/
│       ├── tickets/
│       │   ├── ticket-list-table.tsx               # DataTable with virtual scroll for large lists
│       │   ├── ticket-detail-pane.tsx              # Right pane: properties, SLA timer, assignment
│       │   ├── ticket-thread.tsx                   # Reply chain with internal notes
│       │   ├── ticket-reply-editor.tsx             # Rich text editor with canned response picker
│       │   ├── ticket-sla-badge.tsx                # Countdown timer + color coding
│       │   ├── ticket-status-badge.tsx
│       │   ├── ticket-priority-badge.tsx
│       │   ├── ticket-merge-dialog.tsx             # Search + merge tickets
│       │   ├── ticket-split-dialog.tsx             # Split thread into new ticket
│       │   ├── ticket-time-log-dialog.tsx
│       │   ├── ticket-create-form.tsx
│       │   ├── ticket-filters-panel.tsx            # Filter sidebar: status, priority, team, tag
│       │   └── ticket-bulk-actions-bar.tsx         # Bulk assign, close, tag
│       ├── sla/
│       │   ├── sla-policy-form.tsx                 # SLA policy editor with per-priority hours
│       │   ├── sla-escalation-builder.tsx
│       │   └── sla-timer-widget.tsx                # Live countdown
│       ├── routing/
│       │   ├── routing-rule-form.tsx               # Condition + action builder
│       │   └── routing-test-dialog.tsx             # Test rule against sample ticket
│       ├── automation/
│       │   └── automation-rule-form.tsx            # Trigger + condition + action builder
│       ├── kb/
│       │   ├── article-editor.tsx                  # TipTap rich text editor
│       │   ├── article-card.tsx
│       │   ├── article-feedback-widget.tsx         # Helpful / Not Helpful buttons
│       │   ├── kb-search-bar.tsx                   # Algolia-style instant search
│       │   └── kb-category-tree.tsx
│       ├── teams/
│       │   ├── team-form.tsx
│       │   ├── team-member-list.tsx
│       │   └── availability-toggle.tsx
│       ├── reports/
│       │   ├── volume-chart.tsx
│       │   ├── sla-compliance-chart.tsx
│       │   ├── agent-performance-table.tsx
│       │   └── csat-trend-chart.tsx
│       └── canned-responses/
│           ├── canned-response-picker.tsx          # Triggered by "/" in reply editor
│           └── canned-response-form.tsx
│
├── server/
│   └── routers/
│       └── helpdesk/
│           ├── index.ts                            # Merge all HD sub-routers
│           ├── tickets.router.ts
│           ├── sla.router.ts
│           ├── routing.router.ts
│           ├── canned-responses.router.ts
│           ├── kb.router.ts
│           ├── teams.router.ts
│           └── reports.router.ts
│
└── lib/
    └── helpdesk/
        ├── sla-engine.ts                           # SLA time calculation, business hours
        ├── routing-engine.ts                       # Rule evaluation + assignment
        ├── automation-engine.ts                    # Event-driven automation executor
        ├── round-robin.ts                          # Round-robin state machine
        ├── ticket-number.ts                        # Auto-increment TKT-XXXXX generator
        ├── email-parser.ts                         # Email → ticket field extraction
        └── search-deflection.ts                    # KB search hit tracking

apps/worker/src/
└── workers/
    └── helpdesk/
        ├── email-inbox.worker.ts                   # Polls IMAP / handles webhook, creates tickets
        ├── sla-timer.worker.ts                     # Delayed jobs for SLA breach checks
        ├── csat-survey.worker.ts                   # Delayed: sends CSAT email N hours after resolve
        ├── auto-close.worker.ts                    # Daily cron: close resolved tickets idle 7 days
        ├── idle-ticket.worker.ts                   # Triggers idle_n_hours automation event
        └── automation-executor.worker.ts           # Processes automation action jobs
```

---

## 4. tRPC Routers & Procedures

### 4.1 hd.tickets

```typescript
export const ticketsRouter = router({
  // List tickets with full filter support
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(25),
      status: z.nativeEnum(HdTicketStatus).optional(),
      priority: z.nativeEnum(HdTicketPriority).optional(),
      assignee_id: z.string().optional(),
      team_id: z.string().optional(),
      category_id: z.string().optional(),
      channel: z.nativeEnum(HdTicketChannel).optional(),
      sla_status: z.nativeEnum(HdSlaStatus).optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      from_date: z.string().optional(),
      to_date: z.string().optional(),
      view: z.enum(["mine", "unassigned", "all_open", "overdue", "team"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Build dynamic Prisma where clause from input
      // Add virtual SLA countdown field on client
    }),

  // Get full ticket detail with relations
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Include: replies, sla_policy, team, assignee, time_logs, category
    }),

  // Create ticket
  create: protectedProcedure
    .input(HdTicketCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Generate ticket_number (TKT-XXXXX) — see ticket-number.ts
      // 2. Apply routing rules → set assignee/team
      // 3. Apply SLA policy → compute first_response_due_at, resolution_due_at
      // 4. Enqueue SLA timer jobs
      // 5. Run automation rules for ticket_created event
    }),

  // Update ticket properties
  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(HdTicketUpdateSchema))
    .mutation(async ({ ctx, input }) => {
      // Track status changes via system reply
      // Re-evaluate SLA if priority changes
      // Run automation rules for status_changed / assigned events
    }),

  // Assign agent
  assign: protectedProcedure
    .input(z.object({ id: z.string(), assignee_id: z.string().nullable(), team_id: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      // Update assignee, add system reply "Assigned to X by Y"
      // Trigger automation: assigned event
    }),

  // Reply to ticket
  reply: protectedProcedure
    .input(z.object({
      ticket_id: z.string(),
      body: z.string(),
      body_html: z.string().optional(),
      reply_type: z.nativeEnum(HdReplyType).default("reply"),
      is_public: z.boolean().default(true),
      to_emails: z.array(z.string()).optional(),
      cc_emails: z.array(z.string()).optional(),
      attachments: z.array(HdAttachmentSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Create HdTicketReply
      // 2. If is_public && first_responded_at is null → set first_responded_at
      // 3. If status is pending → revert to in_progress
      // 4. Enqueue email send (if not via email channel already)
      // 5. Trigger automation: reply_received
    }),

  // Add internal note
  addNote: protectedProcedure
    .input(z.object({ ticket_id: z.string(), body: z.string(), body_html: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { /* reply_type: note, is_public: false */ }),

  // Close ticket
  close: protectedProcedure
    .input(z.object({ id: z.string(), resolution_note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Update status → closed, set closed_at
      // 2. Cancel pending SLA timer jobs
      // 3. Enqueue CSAT survey (delayed by send_after_hours)
    }),

  // Reopen ticket
  reopen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Increment reopen_count, set reopened_at, status → open
      // Recompute SLA timers from now
    }),

  // Resolve ticket
  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // status → resolved, set resolved_at
      // Enqueue CSAT survey job
    }),

  // Merge tickets
  merge: protectedProcedure
    .input(z.object({ source_id: z.string(), target_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Move all replies from source to target
      // Set source.merged_into_id = target.id
      // Close source ticket with system note
    }),

  // Split reply into new ticket
  split: protectedProcedure
    .input(z.object({ reply_id: z.string(), subject: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Create new ticket from reply content
      // Add cross-reference notes in both tickets
    }),

  // Bulk actions
  bulkAssign: protectedProcedure
    .input(z.object({ ids: z.array(z.string()), assignee_id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  bulkClose: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  bulkTag: protectedProcedure
    .input(z.object({ ids: z.array(z.string()), tags: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  bulkSetPriority: protectedProcedure
    .input(z.object({ ids: z.array(z.string()), priority: z.nativeEnum(HdTicketPriority) }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // Time tracking
  logTime: protectedProcedure
    .input(z.object({ ticket_id: z.string(), minutes: z.number(), is_billable: z.boolean().default(false), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Create HdTimeLog + increment ticket.time_tracked_minutes
    }),

  // CSAT rating (submitted by customer via survey link)
  submitCsat: publicProcedure
    .input(z.object({ token: z.string(), rating: z.number().min(1).max(10), comment: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { /* verify token, update ticket.satisfaction_rating */ }),
});
```

---

### 4.2 hd.sla

```typescript
export const slaRouter = router({
  listPolicies: protectedProcedure.query(async ({ ctx }) => { /* ... */ }),

  createPolicy: protectedProcedure
    .input(HdSlaPolicySchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  updatePolicy: protectedProcedure
    .input(z.object({ id: z.string() }).merge(HdSlaPolicySchema))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Unset all other is_default, set this one
    }),

  // Compute SLA due dates for a ticket
  computeDueDates: protectedProcedure
    .input(z.object({ ticket_id: z.string(), policy_id: z.string() }))
    .query(async ({ ctx, input }) => { /* returns first_response_due_at, resolution_due_at */ }),

  // Get SLA compliance stats for report
  complianceReport: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), team_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // % tickets meeting FRT, % meeting resolution, by priority/team
    }),

  // Business hours CRUD
  listBusinessHours: protectedProcedure.query(async ({ ctx }) => { /* ... */ }),
  createBusinessHours: protectedProcedure.input(HdBusinessHoursSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
  updateBusinessHours: protectedProcedure.input(z.object({ id: z.string() }).merge(HdBusinessHoursSchema)).mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

---

### 4.3 hd.routing

```typescript
export const routingRouter = router({
  listRules: protectedProcedure.query(async ({ ctx }) => { /* ordered by priority ASC */ }),

  createRule: protectedProcedure
    .input(HdRoutingRuleSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  updateRule: protectedProcedure
    .input(z.object({ id: z.string() }).merge(HdRoutingRuleSchema))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  reorderRules: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      // Bulk update priority field based on array order
    }),

  // Test routing rule against a sample ticket (dry-run)
  testRule: protectedProcedure
    .input(z.object({
      rule_id: z.string().optional(),
      conditions: z.array(HdConditionSchema).optional(),
      sample_ticket: HdTicketSampleSchema,
    }))
    .query(async ({ ctx, input }) => {
      // Returns which rules match and what actions would fire
    }),
});
```

---

### 4.4 hd.cannedResponses

```typescript
export const cannedResponsesRouter = router({
  list: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  // Fast shortcut search (triggered by "/" in editor)
  searchByShortcut: protectedProcedure
    .input(z.object({ q: z.string() }))
    .query(async ({ ctx, input }) => {
      // WHERE shortcut ILIKE :q + ORDER BY usage_count DESC
    }),

  create: protectedProcedure.input(HdCannedResponseSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
  update: protectedProcedure.input(z.object({ id: z.string() }).merge(HdCannedResponseSchema)).mutation(async ({ ctx, input }) => { /* ... */ }),
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),

  incrementUsage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* usage_count++ */ }),
});
```

---

### 4.5 hd.kb

```typescript
export const kbRouter = router({
  // List articles (supports public portal too)
  list: protectedProcedure
    .input(z.object({
      status: z.nativeEnum(HdArticleStatus).optional(),
      category_id: z.string().optional(),
      visibility: z.nativeEnum(HdArticleVisibility).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => { /* full-text search via pg_trgm or separate */ }),

  // Public article (portal, no auth)
  getPublic: publicProcedure
    .input(z.object({ org_slug: z.string(), slug: z.string() }))
    .query(async ({ ctx, input }) => {
      // Increment views_count
    }),

  create: protectedProcedure.input(HdArticleSchema).mutation(async ({ ctx, input }) => {
    // Save with version_number=1, create HdArticleVersion
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(HdArticleSchema))
    .mutation(async ({ ctx, input }) => {
      // Create new HdArticleVersion before updating
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // status → published, set published_at
    }),

  archive: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* status → archived */ }),

  versions: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => { /* list all versions */ }),

  revertToVersion: protectedProcedure
    .input(z.object({ article_id: z.string(), version_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch old version content, update article, create new version
    }),

  // Customer feedback (public)
  submitFeedback: publicProcedure
    .input(z.object({ article_id: z.string(), is_helpful: z.boolean(), comment: z.string().optional(), ticket_id: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Create HdArticleFeedback, update helpful_count / not_helpful_count
    }),

  // Category management
  listCategories: protectedProcedure.query(async ({ ctx }) => { /* nested tree */ }),
  createCategory: protectedProcedure.input(HdCategorySchema).mutation(async ({ ctx, input }) => { /* ... */ }),
  updateCategory: protectedProcedure.input(z.object({ id: z.string() }).merge(HdCategorySchema)).mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

---

### 4.6 hd.teams

```typescript
export const teamsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => { /* with member count */ }),

  create: protectedProcedure.input(HdTeamSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
  update: protectedProcedure.input(z.object({ id: z.string() }).merge(HdTeamSchema)).mutation(async ({ ctx, input }) => { /* ... */ }),

  addMember: protectedProcedure
    .input(z.object({ team_id: z.string(), user_id: z.string(), role: z.nativeEnum(HdTeamMemberRole).default("member") }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  removeMember: protectedProcedure
    .input(z.object({ team_id: z.string(), user_id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  setAvailability: protectedProcedure
    .input(z.object({ team_id: z.string(), user_id: z.string(), is_available: z.boolean() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

---

### 4.7 hd.reports

```typescript
export const reportsRouter = router({
  // Ticket volume by channel / category / agent
  volume: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), group_by: z.enum(["channel", "category", "agent", "status", "day"]) }))
    .query(async ({ ctx, input }) => {
      // Raw SQL aggregate grouped by date/channel/agent
    }),

  // Average first response time
  avgFirstResponseTime: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), team_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // AVG(EXTRACT(EPOCH FROM (first_responded_at - created_at))) / 3600
    }),

  // Average resolution time
  avgResolutionTime: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => { /* similar to above */ }),

  // SLA compliance %
  slaCompliance: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), team_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // COUNT where sla_status=ok / total * 100, grouped by priority
    }),

  // Agent performance table
  agentPerformance: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      // Per agent: assigned_count, resolved_count, avg_resolution_hours, avg_csat
    }),

  // CSAT report
  csat: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string(), agent_id: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Survey response rate, avg score, trend over time
    }),
});
```

---

## 5. Pages & Routes

| Route | Page Component | Description |
|---|---|---|
| `/helpdesk` | HD Dashboard | My tickets count, SLA alerts, team queue |
| `/helpdesk/tickets` | Ticket List | Sortable table with filter sidebar |
| `/helpdesk/tickets/new` | Create Ticket | Manual ticket creation form |
| `/helpdesk/tickets/[id]` | Ticket Detail | 2-pane: conversation + properties |
| `/helpdesk/views/mine` | My Tickets | Filter: assignee = me |
| `/helpdesk/views/unassigned` | Unassigned | Filter: assignee = null |
| `/helpdesk/views/overdue` | Overdue | Filter: sla_status in [breached_first, breached_resolution] |
| `/helpdesk/views/all-open` | All Open | Filter: status = open or in_progress |
| `/helpdesk/views/team/[teamId]` | Team View | Filter: team_id = X |
| `/helpdesk/kb` | KB Home | Search bar + category grid |
| `/helpdesk/kb/new` | Create Article | TipTap editor + metadata |
| `/helpdesk/kb/[slug]` | Article Viewer | Read + edit link for agents |
| `/helpdesk/kb/[slug]/edit` | Article Editor | Full edit with version comparison |
| `/helpdesk/kb/categories` | KB Categories | Tree manager |
| `/helpdesk/reports` | Reports Hub | Overview widgets |
| `/helpdesk/reports/volume` | Volume Report | Bar chart by day/channel |
| `/helpdesk/reports/sla` | SLA Report | Compliance gauge + priority breakdown |
| `/helpdesk/reports/agents` | Agent Performance | Leaderboard table |
| `/helpdesk/reports/csat` | CSAT Report | Score trend + per-agent |
| `/helpdesk/settings` | HD Settings | Configuration hub |
| `/helpdesk/settings/teams` | Team Management | Create/edit teams |
| `/helpdesk/settings/teams/[teamId]` | Team Detail | Members, auto-assign setting |
| `/helpdesk/settings/sla` | SLA Policies | List + default marker |
| `/helpdesk/settings/sla/[policyId]` | SLA Editor | Per-priority hours + escalation |
| `/helpdesk/settings/business-hours` | Business Hours | Days/times per timezone |
| `/helpdesk/settings/routing` | Routing Rules | Drag-to-reorder rule list |
| `/helpdesk/settings/automation` | Automation | Event-triggered rule builder |
| `/helpdesk/settings/canned-responses` | Canned Responses | Library + category filter |
| `/helpdesk/settings/email-inboxes` | Email Inboxes | Connect Gmail/Outlook |
| `/helpdesk/settings/categories` | Categories | Two-level category tree |
| `/helpdesk/settings/satisfaction` | CSAT Config | Enable/disable, timing, question text |
| `/portal/[orgSlug]` | Customer Portal | KB search + create ticket |
| `/portal/[orgSlug]/submit` | Submit Ticket | Minimal form for customers |
| `/portal/[orgSlug]/tickets` | My Tickets | Customer ticket list (email-authenticated) |
| `/portal/[orgSlug]/tickets/[id]` | Ticket Thread | Customer view, reply, status |
| `/portal/[orgSlug]/kb/[slug]` | KB Article (Public) | SEO-friendly, feedback widget |

---

## 6. Business Logic Deep Dive

### 6.1 SLA Timer Calculation (Business Hours Aware)

```typescript
// lib/helpdesk/sla-engine.ts

export async function computeSlaDueDates(
  ticket: { created_at: Date; priority: HdTicketPriority },
  policy: HdSlaPolicy,
  businessHours: HdBusinessHours | null
): Promise<{ firstResponseDue: Date; resolutionDue: Date }> {
  const firstResponseHours = (policy.first_response_hours as Record<string, number>)[ticket.priority];
  const resolutionHours = (policy.resolution_hours as Record<string, number>)[ticket.priority];

  if (!businessHours) {
    // 24x7 calendar hours
    return {
      firstResponseDue: addHours(ticket.created_at, firstResponseHours),
      resolutionDue: addHours(ticket.created_at, resolutionHours),
    };
  }

  return {
    firstResponseDue: addBusinessHours(ticket.created_at, firstResponseHours, businessHours),
    resolutionDue: addBusinessHours(ticket.created_at, resolutionHours, businessHours),
  };
}

function addBusinessHours(startDate: Date, hoursToAdd: number, bh: HdBusinessHours): Date {
  const tz = bh.timezone;
  let cursor = toZonedTime(startDate, tz);
  let remainingMinutes = hoursToAdd * 60;
  const hours = bh.hours as BusinessHoursConfig;

  while (remainingMinutes > 0) {
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][cursor.getDay()];
    const dayConfig = hours[dayName];

    if (!dayConfig.open) {
      // Skip to next day start
      cursor = startOfNextDay(cursor, tz);
      continue;
    }

    const dayStart = parseTimeInZone(dayConfig.start, cursor, tz);
    const dayEnd = parseTimeInZone(dayConfig.end, cursor, tz);

    if (cursor < dayStart) cursor = dayStart;

    if (cursor >= dayEnd) {
      cursor = startOfNextDay(cursor, tz);
      continue;
    }

    const availableMinutesInDay = differenceInMinutes(dayEnd, cursor);

    if (remainingMinutes <= availableMinutesInDay) {
      cursor = addMinutes(cursor, remainingMinutes);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= availableMinutesInDay;
      cursor = startOfNextDay(cursor, tz);
    }
  }

  return fromZonedTime(cursor, tz);
}

// Compute elapsed business hours between two timestamps
export function elapsedBusinessHours(
  from: Date,
  to: Date,
  bh: HdBusinessHours
): number {
  let elapsed = 0;
  let cursor = toZonedTime(from, bh.timezone);
  const end = toZonedTime(to, bh.timezone);
  const hours = bh.hours as BusinessHoursConfig;

  while (cursor < end) {
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][cursor.getDay()];
    const dayConfig = hours[dayName];

    if (!dayConfig.open) {
      cursor = startOfNextDay(cursor, bh.timezone);
      continue;
    }

    const dayStart = parseTimeInZone(dayConfig.start, cursor, bh.timezone);
    const dayEnd = parseTimeInZone(dayConfig.end, cursor, bh.timezone);
    const effectiveStart = cursor < dayStart ? dayStart : cursor;
    const effectiveEnd = end < dayEnd ? end : dayEnd;

    if (effectiveStart < effectiveEnd) {
      elapsed += differenceInMinutes(effectiveEnd, effectiveStart);
    }

    cursor = startOfNextDay(cursor, bh.timezone);
  }

  return elapsed / 60;
}

// SLA breach check (called by timer worker)
export async function checkSlaBreach(
  ticketId: string,
  type: "first_response" | "resolution",
  prisma: PrismaClient
): Promise<void> {
  const ticket = await prisma.hdTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ["closed", "resolved"].includes(ticket.status)) return;

  const now = new Date();
  if (type === "first_response") {
    if (!ticket.first_responded_at && ticket.first_response_due_at && now > ticket.first_response_due_at) {
      await prisma.hdTicket.update({ where: { id: ticketId }, data: { sla_status: "breached_first" } });
      await triggerEscalation(ticket, "first_response", prisma);
    }
  } else if (type === "resolution") {
    if (!ticket.resolved_at && ticket.resolution_due_at && now > ticket.resolution_due_at) {
      await prisma.hdTicket.update({ where: { id: ticketId }, data: { sla_status: "breached_resolution" } });
      await triggerEscalation(ticket, "resolution", prisma);
    }
  }
}
```

---

### 6.2 Round-Robin Assignment Algorithm

```typescript
// lib/helpdesk/round-robin.ts

export async function assignRoundRobin(
  teamId: string,
  prisma: PrismaClient
): Promise<string | null> {
  // 1. Get available team members sorted by user_id (stable order)
  const members = await prisma.hdTeamMember.findMany({
    where: { team_id: teamId, is_available: true },
    orderBy: { user_id: "asc" },
  });

  if (members.length === 0) return null;

  // 2. Get current round-robin pointer
  const state = await prisma.hdRoundRobinState.upsert({
    where: { team_id: teamId },
    create: { team_id: teamId, last_agent_id: null },
    update: {},
  });

  // 3. Find next agent in cycle
  const lastIdx = state.last_agent_id
    ? members.findIndex(m => m.user_id === state.last_agent_id)
    : -1;
  const nextIdx = (lastIdx + 1) % members.length;
  const nextAgent = members[nextIdx]!;

  // 4. Update pointer
  await prisma.hdRoundRobinState.update({
    where: { team_id: teamId },
    data: { last_agent_id: nextAgent.user_id },
  });

  return nextAgent.user_id;
}

export async function assignLoadBalanced(
  teamId: string,
  prisma: PrismaClient
): Promise<string | null> {
  // Assign to available agent with fewest open tickets
  const members = await prisma.hdTeamMember.findMany({
    where: { team_id: teamId, is_available: true },
    select: { user_id: true },
  });

  if (members.length === 0) return null;

  const userIds = members.map(m => m.user_id);

  // Count open tickets per agent
  const counts = await prisma.hdTicket.groupBy({
    by: ["assignee_id"],
    where: { assignee_id: { in: userIds }, status: { in: ["open", "in_progress", "pending"] } },
    _count: { id: true },
  });

  const countMap = new Map(counts.map(c => [c.assignee_id!, c._count.id]));

  // Find agent with minimum open tickets
  let minCount = Infinity;
  let selectedAgent: string | null = null;

  for (const { user_id } of members) {
    const count = countMap.get(user_id) ?? 0;
    if (count < minCount) {
      minCount = count;
      selectedAgent = user_id;
    }
  }

  return selectedAgent;
}
```

---

### 6.3 Email-to-Ticket Processing (BullMQ Worker)

```typescript
// apps/worker/src/workers/helpdesk/email-inbox.worker.ts

import { Worker, Queue } from "bullmq";
import Imap from "node-imap";
import { simpleParser } from "mailparser";

export const emailInboxQueue = new Queue("hd:email-inbox", { connection });

new Worker("hd:email-inbox", async (job) => {
  const { emailId, raw, inboxId } = job.data;

  const inbox = await prisma.hdEmailInbox.findUnique({
    where: { id: inboxId },
    include: { team: true, organization: true },
  });
  if (!inbox) throw new Error("Inbox not found");

  const parsed = await simpleParser(raw);
  const messageId = parsed.messageId ?? "";
  const subject = parsed.subject ?? "(No subject)";
  const from = parsed.from?.value[0];
  const bodyText = parsed.text ?? "";
  const bodyHtml = parsed.html || undefined;

  // 1. Check for deduplication
  const existingReply = await prisma.hdTicketReply.findFirst({
    where: { email_message_id: messageId },
  });
  if (existingReply) return; // Already processed

  // 2. Check if this is a reply to existing ticket (In-Reply-To header)
  const inReplyTo = parsed.inReplyTo;
  const existingTicketReply = inReplyTo
    ? await prisma.hdTicketReply.findFirst({ where: { email_message_id: inReplyTo } })
    : null;

  if (existingTicketReply) {
    // Append reply to existing ticket
    await prisma.hdTicketReply.create({
      data: {
        ticket_id: (await prisma.hdTicket.findFirst({ where: { replies: { some: { id: existingTicketReply.id } } } }))!.id,
        body: bodyText,
        body_html: bodyHtml,
        reply_type: "reply",
        is_public: true,
        from_email: from?.address,
        from_name: from?.name,
        email_message_id: messageId,
        sent_via: "email",
        created_by: null,
        attachments: await processAttachments(parsed.attachments),
      },
    });
    return;
  }

  // 3. Create new ticket
  const orgId = inbox.organization_id;
  const ticketNumber = await generateTicketNumber(orgId, prisma);

  const ticket = await prisma.hdTicket.create({
    data: {
      organization_id: orgId,
      ticket_number: ticketNumber,
      subject,
      description: bodyText,
      description_html: bodyHtml,
      channel: "email",
      priority: inbox.default_priority,
      status: "open",
      requester_email: from?.address,
      requester_name: from?.name,
      team_id: inbox.team_id,
      source_email_message_id: messageId,
      created_at: parsed.date ?? new Date(),
    },
  });

  // 4. Apply routing rules
  await applyRoutingRules(ticket, prisma);

  // 5. Apply SLA
  const freshTicket = await prisma.hdTicket.findUnique({ where: { id: ticket.id } });
  await applySlaPolicy(freshTicket!, prisma);

  // 6. Create initial reply (the email body itself)
  await prisma.hdTicketReply.create({
    data: {
      ticket_id: ticket.id,
      body: bodyText,
      body_html: bodyHtml,
      reply_type: "reply",
      is_public: true,
      from_email: from?.address,
      from_name: from?.name,
      email_message_id: messageId,
      sent_via: "email",
      created_by: null,
      attachments: await processAttachments(parsed.attachments),
    },
  });

  // 7. Trigger automation
  await runAutomation("ticket_created", ticket.id, prisma);

}, { connection, concurrency: 10 });

async function generateTicketNumber(orgId: string, prisma: PrismaClient): Promise<string> {
  // Use a PostgreSQL sequence per org to ensure uniqueness
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval(get_ticket_sequence(${orgId}::uuid))
  `;
  const n = Number(result[0]!.nextval);
  return `TKT-${String(n).padStart(5, "0")}`;
}
```

---

### 6.4 Ticket Routing Rule Evaluation

```typescript
// lib/helpdesk/routing-engine.ts

export async function applyRoutingRules(
  ticket: HdTicket,
  prisma: PrismaClient
): Promise<void> {
  const rules = await prisma.hdRoutingRule.findMany({
    where: { organization_id: ticket.organization_id, is_active: true },
    orderBy: { priority: "asc" }, // lower number = higher priority
  });

  for (const rule of rules) {
    const conditions = rule.conditions as RoutingCondition[];
    const actions = rule.actions as RoutingAction[];

    if (evaluateConditions(conditions, ticket)) {
      await executeActions(actions, ticket.id, prisma);
      await prisma.hdRoutingRule.update({
        where: { id: rule.id },
        data: { match_count: { increment: 1 } },
      });
      break; // First match wins (configurable behavior)
    }
  }
}

function evaluateConditions(conditions: RoutingCondition[], ticket: HdTicket): boolean {
  return conditions.every(cond => {
    const ticketValue = getTicketField(ticket, cond.field);
    switch (cond.operator) {
      case "is":        return ticketValue === cond.value;
      case "is_not":    return ticketValue !== cond.value;
      case "contains":  return String(ticketValue).toLowerCase().includes(String(cond.value).toLowerCase());
      case "matches":   return new RegExp(cond.value, "i").test(String(ticketValue));
      default:          return false;
    }
  });
}

async function executeActions(
  actions: RoutingAction[],
  ticketId: string,
  prisma: PrismaClient
): Promise<void> {
  const updates: Partial<HdTicket> = {};

  for (const action of actions) {
    switch (action.action) {
      case "assign_team":   updates.team_id = action.value; break;
      case "assign_agent":  updates.assignee_id = action.value; break;
      case "set_priority":  updates.priority = action.value; break;
      case "set_category":  updates.category_id = action.value; break;
      case "set_sla":       updates.sla_policy_id = action.value; break;
      case "add_tag":
        await prisma.hdTicket.update({ where: { id: ticketId }, data: { tags: { push: action.value } } });
        break;
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.hdTicket.update({ where: { id: ticketId }, data: updates });
  }

  // If team assigned with auto_assign, resolve individual agent
  if (updates.team_id) {
    const team = await prisma.hdTeam.findUnique({ where: { id: updates.team_id } });
    if (team?.auto_assign === "round_robin") {
      const agentId = await assignRoundRobin(updates.team_id, prisma);
      if (agentId) {
        await prisma.hdTicket.update({ where: { id: ticketId }, data: { assignee_id: agentId } });
      }
    } else if (team?.auto_assign === "load_balanced") {
      const agentId = await assignLoadBalanced(updates.team_id, prisma);
      if (agentId) {
        await prisma.hdTicket.update({ where: { id: ticketId }, data: { assignee_id: agentId } });
      }
    }
  }
}
```

---

### 6.5 CSAT Survey Scheduling

```typescript
// apps/worker/src/workers/helpdesk/csat-survey.worker.ts
// Triggered when ticket is resolved/closed

export const csatSurveyQueue = new Queue("hd:csat-survey", { connection });

// Enqueue with delay when ticket resolves
export async function enqueueCsatSurvey(ticket: HdTicket, prisma: PrismaClient): Promise<void> {
  const survey = await prisma.hdSatisfactionSurvey.findUnique({
    where: { organization_id: ticket.organization_id },
  });
  if (!survey?.enabled || !ticket.requester_email) return;
  if (ticket.satisfaction_sent_at) return; // Already sent

  const delayMs = survey.send_after_hours * 60 * 60 * 1000;
  await csatSurveyQueue.add("send-csat", { ticketId: ticket.id }, { delay: delayMs });
}

new Worker("hd:csat-survey", async (job) => {
  const { ticketId } = job.data;
  const ticket = await prisma.hdTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.status !== "resolved") return; // Don't send if reopened

  const survey = await prisma.hdSatisfactionSurvey.findUnique({ where: { organization_id: ticket.organization_id } });

  const token = generateCsatToken(ticket.id);
  const surveyUrl = `${process.env.APP_URL}/api/csat/${token}`;

  await sendEmail({
    to: ticket.requester_email!,
    subject: `How was your support experience? [${ticket.ticket_number}]`,
    html: buildCsatEmailHtml(survey!, ticket, surveyUrl),
  });

  await prisma.hdTicket.update({
    where: { id: ticketId },
    data: { satisfaction_sent_at: new Date() },
  });
}, { connection });
```

---

### 6.6 Auto-Close Cron (7 Days After Resolution)

```typescript
// apps/worker/src/workers/helpdesk/auto-close.worker.ts
// Runs: "0 2 * * *" (daily at 2 AM)

new Worker("hd:auto-close", async (job) => {
  const { orgId } = job.data;
  const sevenDaysAgo = subDays(new Date(), 7);

  await prisma.hdTicket.updateMany({
    where: {
      organization_id: orgId,
      status: "resolved",
      resolved_at: { lte: sevenDaysAgo },
    },
    data: {
      status: "closed",
      closed_at: new Date(),
    },
  });
}, { connection });
```

---

### 6.7 Automation Engine

```typescript
// lib/helpdesk/automation-engine.ts

export async function runAutomation(
  event: HdTriggerEvent,
  ticketId: string,
  prisma: PrismaClient,
  extraContext?: Record<string, unknown>
): Promise<void> {
  const ticket = await prisma.hdTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  const rules = await prisma.hdAutomationRule.findMany({
    where: { organization_id: ticket.organization_id, trigger_event: event, is_active: true },
  });

  for (const rule of rules) {
    const conditions = (rule.conditions as RoutingCondition[]) ?? [];
    if (conditions.length > 0 && !evaluateConditions(conditions, ticket)) continue;

    const actions = (rule.actions as AutomationAction[]) ?? [];
    for (const action of actions) {
      await executeAutomationAction(action, ticket, prisma);
    }

    await prisma.hdAutomationRule.update({
      where: { id: rule.id },
      data: { run_count: { increment: 1 }, last_run_at: new Date() },
    });
  }
}

async function executeAutomationAction(
  action: AutomationAction,
  ticket: HdTicket,
  prisma: PrismaClient
): Promise<void> {
  switch (action.action) {
    case "close_ticket":
      await prisma.hdTicket.update({ where: { id: ticket.id }, data: { status: "closed", closed_at: new Date() } });
      break;
    case "change_status":
      await prisma.hdTicket.update({ where: { id: ticket.id }, data: { status: action.value } });
      break;
    case "assign_team":
      await prisma.hdTicket.update({ where: { id: ticket.id }, data: { team_id: action.value } });
      break;
    case "assign_agent":
      await prisma.hdTicket.update({ where: { id: ticket.id }, data: { assignee_id: action.value } });
      break;
    case "add_tag":
      await prisma.hdTicket.update({ where: { id: ticket.id }, data: { tags: { push: action.value } } });
      break;
    case "send_email":
      await sendEmail({ to: action.value.to, subject: action.value.subject, html: action.value.body });
      break;
    case "notify_agent":
      await createNotification(action.value.agent_id, "ticket_update", { ticket_id: ticket.id }, prisma);
      break;
    default:
      break;
  }
}
```

---

### 6.8 Auto-Increment Ticket Number (PostgreSQL Sequence Per Org)

```typescript
// lib/helpdesk/ticket-number.ts

// One-time migration: create sequence function
// CREATE OR REPLACE FUNCTION get_ticket_sequence(org_id UUID) RETURNS REGCLASS AS $$
// DECLARE
//   seq_name TEXT := 'ticket_seq_' || replace(org_id::text, '-', '_');
// BEGIN
//   IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = seq_name) THEN
//     EXECUTE 'CREATE SEQUENCE ' || seq_name || ' START 1';
//   END IF;
//   RETURN seq_name::REGCLASS;
// END;
// $$ LANGUAGE plpgsql;

export async function generateTicketNumber(orgId: string, prisma: PrismaClient): Promise<string> {
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval(get_ticket_sequence(${orgId}::uuid)) as nextval
  `;
  const n = Number(result[0]!.nextval);
  return `TKT-${String(n).padStart(5, "0")}`;
}
```

---

## 7. BullMQ Workers & Cron Jobs

### Queue Registry

```typescript
// apps/worker/src/queues.ts
import { Queue } from "bullmq";
import { connection } from "./lib/redis";

export const emailInboxQueue     = new Queue("hd:email-inbox",      { connection });
export const slaTimerQueue       = new Queue("hd:sla-timer",        { connection });
export const csatSurveyQueue     = new Queue("hd:csat-survey",      { connection });
export const autoCloseQueue      = new Queue("hd:auto-close",       { connection });
export const idleTicketQueue     = new Queue("hd:idle-ticket",      { connection });
export const automationQueue     = new Queue("hd:automation",       { connection });
```

---

### SLA Timer Worker (Delayed Jobs)

```typescript
// apps/worker/src/workers/helpdesk/sla-timer.worker.ts

// When ticket is created or SLA policy applied:
// 1. Enqueue job with delay = ms until first_response_due_at (for FRT check)
// 2. Enqueue job with delay = ms until resolution_due_at (for resolution check)
// 3. Enqueue warning jobs at 75% of each threshold

async function enqueueSlaTimers(ticket: HdTicket): Promise<void> {
  const now = Date.now();

  if (ticket.first_response_due_at) {
    const frDelay = ticket.first_response_due_at.getTime() - now;
    const frWarnDelay = frDelay * 0.75;
    if (frDelay > 0) {
      await slaTimerQueue.add("check-first-response", { ticketId: ticket.id }, { delay: frDelay, jobId: `fr-${ticket.id}` });
      await slaTimerQueue.add("warn-first-response", { ticketId: ticket.id }, { delay: frWarnDelay, jobId: `fr-warn-${ticket.id}` });
    }
  }

  if (ticket.resolution_due_at) {
    const resDelay = ticket.resolution_due_at.getTime() - now;
    if (resDelay > 0) {
      await slaTimerQueue.add("check-resolution", { ticketId: ticket.id }, { delay: resDelay, jobId: `res-${ticket.id}` });
      await slaTimerQueue.add("warn-resolution", { ticketId: ticket.id }, { delay: resDelay * 0.75, jobId: `res-warn-${ticket.id}` });
    }
  }
}

new Worker("hd:sla-timer", async (job) => {
  const { ticketId } = job.data;
  if (job.name === "check-first-response") await checkSlaBreach(ticketId, "first_response", prisma);
  if (job.name === "check-resolution")     await checkSlaBreach(ticketId, "resolution", prisma);
  if (job.name === "warn-first-response" || job.name === "warn-resolution") {
    const ticket = await prisma.hdTicket.findUnique({ where: { id: ticketId } });
    if (ticket && !["closed", "resolved"].includes(ticket.status)) {
      await notifyAssigneeSlaNearing(ticket, job.name.includes("first") ? "first_response" : "resolution", prisma);
    }
  }
}, { connection });
```

---

### Idle Ticket Worker

```typescript
// apps/worker/src/workers/helpdesk/idle-ticket.worker.ts
// Cron: "0 * * * *" (hourly)
// For each org, find automation rules with trigger_event = idle_n_hours
// Find tickets matching the idle threshold, fire automation

new Worker("hd:idle-ticket", async (job) => {
  const { orgId } = job.data;
  const rules = await prisma.hdAutomationRule.findMany({
    where: { organization_id: orgId, trigger_event: "idle_n_hours", is_active: true },
  });

  for (const rule of rules) {
    const idleHours = (rule.trigger_config as { idle_hours: number })?.idle_hours ?? 48;
    const idleThreshold = subHours(new Date(), idleHours);

    const idleTickets = await prisma.hdTicket.findMany({
      where: {
        organization_id: orgId,
        status: { in: ["open", "in_progress"] },
        updated_at: { lte: idleThreshold },
      },
    });

    for (const ticket of idleTickets) {
      await automationQueue.add("run-automation", { ticketId: ticket.id, ruleId: rule.id });
    }
  }
}, { connection });
```

---

## 8. npm Packages

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `bullmq` | ^5.x | Email processing, SLA timers, CSAT, auto-close queues |
| `ioredis` | ^5.x | Redis client for BullMQ |
| `node-imap` | ^0.9.x | IMAP polling for email inboxes |
| `mailparser` | ^3.x | Parse raw email (subject, body, attachments, headers) |
| `nodemailer` | ^6.x | Send reply emails + CSAT surveys |
| `@tiptap/react` | ^2.x | Rich text editor for ticket replies and KB articles |
| `@tiptap/extension-*` | ^2.x | TipTap extensions: mention, table, image, code |
| `@tanstack/react-table` | ^8.x | Ticket list with virtual scrolling |
| `@tanstack/react-virtual` | ^3.x | Virtual scroll for large ticket lists |
| `react-big-calendar` | ^1.x | Team availability calendar |
| `date-fns-tz` | ^3.x | Business hours timezone arithmetic |
| `date-fns` | ^3.x | Date comparison utilities |
| `minio` | ^8.x | Attachment storage |
| `@aws-sdk/client-s3` | ^3.x | Presigned URL for attachment downloads |
| `recharts` | ^2.x | Reports: volume charts, CSAT trend, SLA gauge |
| `zod` | ^3.x | Input validation |
| `react-hook-form` | ^7.x | Ticket, canned response, SLA policy forms |
| `cmdk` | ^1.x | Command palette for canned response search (/) |
| `sonner` | ^1.x | Toast notifications for ticket actions |
| `@hello-pangea/dnd` | ^1.x | Drag-to-reorder routing rules |
| `jose` | ^5.x | JWT tokens for CSAT survey links |
| `pg` | ^8.x | Raw SQL for ticket number sequences |

### Dev Dependencies

| Package | Purpose |
|---|---|
| `vitest` | Unit tests for SLA engine, routing evaluator |
| `@faker-js/faker` | Test ticket data generation |
| `msw` | Mock API handlers for email processing tests |
| `prisma` | Schema migrations |

---

## Appendix A — Ticket Number Sequence Migration

Add to a new Prisma migration file (`migrations/xxx_hd_ticket_sequence/migration.sql`):

```sql
-- Create a helper function that returns (or creates) a per-org sequence
CREATE OR REPLACE FUNCTION get_ticket_sequence(org_id UUID)
RETURNS REGCLASS AS $$
DECLARE
  seq_name TEXT := 'ticket_seq_' || replace(org_id::text, '-', '_');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE public.%I START WITH 1 INCREMENT BY 1', seq_name);
  END IF;
  RETURN (quote_ident(seq_name))::REGCLASS;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Appendix B — Full-Text Search for KB Articles

```sql
-- Add tsvector column for full-text search
ALTER TABLE hd_articles ADD COLUMN search_vector tsvector;

-- Function to update tsvector
CREATE OR REPLACE FUNCTION hd_articles_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.meta_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hd_articles_search_trigger
  BEFORE INSERT OR UPDATE ON hd_articles
  FOR EACH ROW EXECUTE FUNCTION hd_articles_search_update();

CREATE INDEX hd_articles_search_idx ON hd_articles USING GIN(search_vector);
```

Usage in tRPC:
```typescript
const articles = await prisma.$queryRaw`
  SELECT *, ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
  FROM hd_articles
  WHERE organization_id = ${orgId}
    AND status = 'published'
    AND search_vector @@ plainto_tsquery('english', ${query})
  ORDER BY rank DESC
  LIMIT 10
`;
```

---

## Appendix C — SLA Status Update Logic

| Condition | `sla_status` value |
|---|---|
| All timers OK | `ok` |
| FRT deadline approaching (75%) | `warning` (only in memory/UI) |
| FRT deadline missed, no first response | `breached_first` |
| Resolution deadline missed, not resolved | `breached_resolution` |
| Ticket resolved/closed | Timer cancelled, final status frozen |
| Ticket reopened | SLA timers recalculated from reopen time |

---

*End of Document 04_HELPDESK_v2.md*  
*Previous: [03_HR_v2.md](./03_HR_v2.md)*
