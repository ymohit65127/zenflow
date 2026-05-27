# ZenFlow Projects v2 — Full Implementation Specification

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
5. [Pages & Views](#pages--views)
6. [Business Logic](#business-logic)
7. [External Dependencies](#external-dependencies)

---

## 1. Overview

Projects v2 upgrades ZenFlow's task management from basic list/board to a full enterprise project management platform. The upgrade introduces:

- **Project templates** for one-click project scaffolding with pre-configured phases, statuses, and task templates
- **Phases and milestones** for waterfall and hybrid planning
- **Gantt view** with critical path calculation and task dependency linking (FS, SS, FF, SF)
- **Sprint management** with velocity tracking, capacity planning, and burndown charts
- **Custom task statuses** per project (like Linear/Jira) mapped to four canonical status types
- **Task subtasks** with unlimited nesting (parent_task_id self-relation) and progress rollup
- **Custom fields** per project (text, number, date, select, multi-select, person, URL, formula)
- **Time logging** with billable hours tracking and invoice linkage
- **Workload view** showing user capacity vs. assigned hours across a date range
- **Risk register** for project risk management
- **Budget tracking** against planned vs. actual cost categories
- **Client portal** with a separate token-authenticated view

All IDs use `cuid()`. Timestamps are `timestamptz`. Array columns use PostgreSQL native arrays.

---

## 2. Database Schema

### 2.1 Project (Upgraded)

```prisma
enum ProjectType {
  software
  marketing
  operations
  research
  other
}

enum ProjectMethodology {
  agile
  waterfall
  hybrid
  kanban
}

enum ProjectVisibility {
  private
  team
  org
  public
}

enum ProjectHealthStatus {
  on_track
  at_risk
  off_track
}

enum ProjectDefaultView {
  list
  board
  gantt
  calendar
  table
}

model Project {
  id                      String               @id @default(cuid())
  organization_id         String               @db.VarChar(36)
  name                    String               @db.VarChar(255)
  description             String?              @db.Text
  status                  String               @db.VarChar(50)     // "active" | "on_hold" | "completed" | "cancelled"
  color                   String?              @db.VarChar(7)
  icon                    String?              @db.VarChar(100)    // Lucide icon name
  // v2 additions:
  template_id             String?              @db.VarChar(36)     // FK to ProjectTemplate used to create
  budget_amount           Decimal?             @db.Decimal(15, 2)
  budget_currency         String               @db.VarChar(3)      @default("USD")
  actual_cost             Decimal              @db.Decimal(15, 2)  @default(0)   // running sum of budget entries
  project_type            ProjectType          @default(other)
  methodology             ProjectMethodology   @default(agile)
  visibility              ProjectVisibility    @default(team)
  client_name             String?              @db.VarChar(255)
  client_email            String?              @db.VarChar(255)
  client_portal_enabled   Boolean              @default(false)
  client_portal_token     String?              @db.VarChar(64)     @unique
  health_status           ProjectHealthStatus  @default(on_track)
  default_view            ProjectDefaultView   @default(list)
  custom_fields           Json?                @db.JsonB            // custom field values at project level
  start_date              DateTime?
  end_date                DateTime?
  archived_at             DateTime?
  deleted_at              DateTime?
  created_by              String               @db.VarChar(36)
  created_at              DateTime             @default(now())
  updated_at              DateTime             @updatedAt

  // Relations
  organization            Organization         @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator                 User                 @relation("ProjectCreator", fields: [created_by], references: [id])
  template                ProjectTemplate?     @relation(fields: [template_id], references: [id])
  members                 ProjectMember[]
  phases                  ProjectPhase[]
  milestones              ProjectMilestone[]
  tasks                   Task[]
  sprints                 Sprint[]
  risks                   ProjectRisk[]
  budget_entries          ProjectBudgetEntry[]
  task_statuses           TaskStatus[]
  task_custom_fields      TaskCustomField[]

  @@index([organization_id])
  @@index([organization_id, status])
  @@index([organization_id, created_by])
  @@index([organization_id, methodology])
  @@index([organization_id, visibility])
  @@index([client_portal_token])
  @@index([deleted_at])
  @@index([archived_at])
  @@map("projects")
}
```

### 2.2 ProjectMember

```prisma
enum ProjectMemberRole {
  owner
  manager
  member
  viewer
  client
}

model ProjectMember {
  id                  String            @id @default(cuid())
  project_id          String            @db.VarChar(36)
  user_id             String            @db.VarChar(36)
  role                ProjectMemberRole @default(member)
  can_view_time_logs  Boolean           @default(true)
  can_view_budget     Boolean           @default(false)
  hourly_rate         Decimal?          @db.Decimal(10, 2)    // member-specific billing rate
  joined_at           DateTime          @default(now())
  invited_by          String?           @db.VarChar(36)

  // Relations
  project             Project           @relation(fields: [project_id], references: [id], onDelete: Cascade)
  user                User              @relation(fields: [user_id], references: [id])
  inviter             User?             @relation("MemberInviter", fields: [invited_by], references: [id])

  @@unique([project_id, user_id])
  @@index([project_id])
  @@index([user_id])
  @@index([project_id, role])
  @@map("project_members")
}
```

### 2.3 ProjectPhase

```prisma
enum PhaseStatus {
  not_started
  in_progress
  completed
}

model ProjectPhase {
  id          String       @id @default(cuid())
  project_id  String       @db.VarChar(36)
  name        String       @db.VarChar(255)
  description String?      @db.Text
  position    Int
  color       String       @db.VarChar(7)    @default("#6B7280")
  start_date  DateTime?    @db.Date
  end_date    DateTime?    @db.Date
  status      PhaseStatus  @default(not_started)
  created_at  DateTime     @default(now())
  updated_at  DateTime     @updatedAt

  // Relations
  project     Project      @relation(fields: [project_id], references: [id], onDelete: Cascade)
  milestones  ProjectMilestone[]
  tasks       Task[]

  @@index([project_id])
  @@index([project_id, position])
  @@index([project_id, status])
  @@map("project_phases")
}
```

### 2.4 ProjectMilestone

```prisma
enum MilestoneStatus {
  pending
  achieved
  missed
}

model ProjectMilestone {
  id             String           @id @default(cuid())
  project_id     String           @db.VarChar(36)
  phase_id       String?          @db.VarChar(36)
  name           String           @db.VarChar(255)
  description    String?          @db.Text
  due_date       DateTime         @db.Date
  status         MilestoneStatus  @default(pending)
  achieved_at    DateTime?
  color          String           @db.VarChar(7)   @default("#F59E0B")
  notify_on_due  Boolean          @default(true)
  created_by     String           @db.VarChar(36)
  created_at     DateTime         @default(now())
  updated_at     DateTime         @updatedAt

  // Relations
  project        Project          @relation(fields: [project_id], references: [id], onDelete: Cascade)
  phase          ProjectPhase?    @relation(fields: [phase_id], references: [id])
  creator        User             @relation(fields: [created_by], references: [id])
  tasks          Task[]

  @@index([project_id])
  @@index([project_id, due_date])
  @@index([project_id, status])
  @@map("project_milestones")
}
```

### 2.5 TaskStatus

```prisma
enum TaskStatusType {
  not_started
  in_progress
  done
  cancelled
}

model TaskStatus {
  id           String         @id @default(cuid())
  project_id   String         @db.VarChar(36)
  name         String         @db.VarChar(100)
  color        String         @db.VarChar(7)
  position     Int
  status_type  TaskStatusType @default(not_started)   // canonical type for analytics
  is_default   Boolean        @default(false)
  created_at   DateTime       @default(now())

  // Relations
  project      Project        @relation(fields: [project_id], references: [id], onDelete: Cascade)
  tasks        Task[]

  @@index([project_id])
  @@index([project_id, position])
  @@index([project_id, is_default])
  @@map("task_statuses")
}
```

### 2.6 Task (Upgraded)

```prisma
enum TaskType {
  task
  story
  bug
  epic
  milestone
}

enum TaskPriority {
  none
  low
  medium
  high
  urgent
}

enum TaskApprovalStatus {
  none
  pending
  approved
  rejected
}

model Task {
  id                String             @id @default(cuid())
  project_id        String             @db.VarChar(36)
  parent_task_id    String?            @db.VarChar(36)     // self-relation for subtasks
  phase_id          String?            @db.VarChar(36)
  milestone_id      String?            @db.VarChar(36)
  sprint_id         String?            @db.VarChar(36)
  status_id         String             @db.VarChar(36)     // FK to TaskStatus
  task_type         TaskType           @default(task)
  priority          TaskPriority       @default(medium)
  title             String             @db.VarChar(500)
  description       String?            @db.Text
  description_html  String?            @db.Text
  position          Int                @default(0)         // ordering within status column
  estimate_points   Int?                                   // story points
  estimate_hours    Decimal?           @db.Decimal(6, 2)
  actual_hours      Decimal            @db.Decimal(6, 2)   @default(0)    // sum of time logs
  start_date        DateTime?          @db.Date
  due_date          DateTime?          @db.Date
  completed_at      DateTime?
  is_blocked        Boolean            @default(false)
  approval_status   TaskApprovalStatus @default(none)
  approved_by       String?            @db.VarChar(36)
  approved_at       DateTime?
  custom_fields     Json?              @db.JsonB
  deleted_at        DateTime?
  created_by        String             @db.VarChar(36)
  created_at        DateTime           @default(now())
  updated_at        DateTime           @updatedAt

  // Relations
  project           Project            @relation(fields: [project_id], references: [id], onDelete: Cascade)
  parent_task       Task?              @relation("TaskSubtasks", fields: [parent_task_id], references: [id])
  subtasks          Task[]             @relation("TaskSubtasks")
  phase             ProjectPhase?      @relation(fields: [phase_id], references: [id])
  milestone         ProjectMilestone?  @relation(fields: [milestone_id], references: [id])
  sprint            Sprint?            @relation(fields: [sprint_id], references: [id])
  status            TaskStatus         @relation(fields: [status_id], references: [id])
  creator           User               @relation("TaskCreator", fields: [created_by], references: [id])
  approver          User?              @relation("TaskApprover", fields: [approved_by], references: [id])
  assignees         TaskAssignee[]
  comments          TaskComment[]
  attachments       TaskAttachment[]
  checklists        TaskChecklist[]
  dependencies      TaskDependency[]   @relation("TaskDependencies")
  blocking          TaskDependency[]   @relation("BlockingDependencies")
  time_logs         TaskTimeLog[]
  custom_field_values TaskCustomFieldValue[]
  recurrence        TaskRecurrence?

  @@index([project_id])
  @@index([project_id, status_id])
  @@index([project_id, sprint_id])
  @@index([project_id, phase_id])
  @@index([project_id, parent_task_id])
  @@index([project_id, task_type])
  @@index([project_id, priority])
  @@index([project_id, due_date])
  @@index([project_id, completed_at])
  @@index([parent_task_id])
  @@index([sprint_id])
  @@index([deleted_at])
  @@map("tasks")
}
```

### 2.7 TaskDependency

```prisma
enum DependencyType {
  finish_to_start    // task B cannot start until task A finishes (most common)
  start_to_start     // task B cannot start until task A starts
  finish_to_finish   // task B cannot finish until task A finishes
  start_to_finish    // task B cannot finish until task A starts (rare)
}

model TaskDependency {
  id                  String         @id @default(cuid())
  task_id             String         @db.VarChar(36)     // the dependent task (B)
  depends_on_task_id  String         @db.VarChar(36)     // the prerequisite task (A)
  dependency_type     DependencyType @default(finish_to_start)
  lag_days            Int            @default(0)         // delay after condition met (can be negative for lead)
  created_at          DateTime       @default(now())

  // Relations
  task                Task           @relation("TaskDependencies", fields: [task_id], references: [id], onDelete: Cascade)
  depends_on          Task           @relation("BlockingDependencies", fields: [depends_on_task_id], references: [id], onDelete: Cascade)

  @@unique([task_id, depends_on_task_id])
  @@index([task_id])
  @@index([depends_on_task_id])
  @@map("task_dependencies")
}
```

### 2.8 TaskAssignee

```prisma
enum TaskAssigneeRole {
  assignee
  reviewer
  watcher
}

model TaskAssignee {
  id          String           @id @default(cuid())
  task_id     String           @db.VarChar(36)
  user_id     String           @db.VarChar(36)
  role        TaskAssigneeRole @default(assignee)
  assigned_at DateTime         @default(now())

  // Relations
  task        Task             @relation(fields: [task_id], references: [id], onDelete: Cascade)
  user        User             @relation(fields: [user_id], references: [id])

  @@unique([task_id, user_id, role])
  @@index([task_id])
  @@index([user_id])
  @@map("task_assignees")
}
```

### 2.9 TaskComment

```prisma
model TaskComment {
  id                String      @id @default(cuid())
  task_id           String      @db.VarChar(36)
  content           String      @db.Text
  content_html      String?     @db.Text
  is_internal       Boolean     @default(false)    // hidden from client portal
  parent_comment_id String?     @db.VarChar(36)
  edited_at         DateTime?
  created_by        String      @db.VarChar(36)
  deleted_at        DateTime?
  created_at        DateTime    @default(now())

  // Relations
  task              Task        @relation(fields: [task_id], references: [id], onDelete: Cascade)
  creator           User        @relation(fields: [created_by], references: [id])
  parent_comment    TaskComment? @relation("CommentReplies", fields: [parent_comment_id], references: [id])
  replies           TaskComment[] @relation("CommentReplies")

  @@index([task_id])
  @@index([task_id, created_at])
  @@index([parent_comment_id])
  @@index([deleted_at])
  @@map("task_comments")
}
```

### 2.10 TaskAttachment

```prisma
model TaskAttachment {
  id              String   @id @default(cuid())
  task_id         String   @db.VarChar(36)
  file_name       String   @db.VarChar(255)
  file_size       BigInt
  mime_type       String   @db.VarChar(127)
  storage_path    String   @db.VarChar(1000)     // MinIO object key
  thumbnail_path  String?  @db.VarChar(1000)     // MinIO thumbnail key (images only)
  uploaded_by     String   @db.VarChar(36)
  deleted_at      DateTime?
  created_at      DateTime @default(now())

  // Relations
  task            Task     @relation(fields: [task_id], references: [id], onDelete: Cascade)
  uploader        User     @relation(fields: [uploaded_by], references: [id])

  @@index([task_id])
  @@index([deleted_at])
  @@map("task_attachments")
}
```

### 2.11 TaskChecklist & TaskChecklistItem

```prisma
model TaskChecklist {
  id         String              @id @default(cuid())
  task_id    String              @db.VarChar(36)
  title      String              @db.VarChar(255)
  position   Int                 @default(0)
  created_at DateTime            @default(now())

  // Relations
  task       Task                @relation(fields: [task_id], references: [id], onDelete: Cascade)
  items      TaskChecklistItem[]

  @@index([task_id])
  @@map("task_checklists")
}

model TaskChecklistItem {
  id           String        @id @default(cuid())
  checklist_id String        @db.VarChar(36)
  text         String        @db.VarChar(500)
  is_done      Boolean       @default(false)
  done_at      DateTime?
  done_by      String?       @db.VarChar(36)
  position     Int
  created_at   DateTime      @default(now())
  updated_at   DateTime      @updatedAt

  // Relations
  checklist    TaskChecklist @relation(fields: [checklist_id], references: [id], onDelete: Cascade)
  done_by_user User?         @relation(fields: [done_by], references: [id])

  @@index([checklist_id])
  @@map("task_checklist_items")
}
```

### 2.12 TaskCustomField & TaskCustomFieldValue

```prisma
enum CustomFieldType {
  text
  number
  date
  select
  multi_select
  person
  url
  formula
  boolean
}

model TaskCustomField {
  id            String          @id @default(cuid())
  project_id    String          @db.VarChar(36)
  name          String          @db.VarChar(100)
  field_key     String          @db.VarChar(100)   // slug e.g. "client_priority"
  field_type    CustomFieldType
  options       Json?           @db.JsonB          // for select/multi_select: [{ value, label, color }]
  formula       String?         @db.Text           // for formula type: expression string
  is_required   Boolean         @default(false)
  default_value String?         @db.Text
  position      Int
  created_at    DateTime        @default(now())

  // Relations
  project       Project         @relation(fields: [project_id], references: [id], onDelete: Cascade)
  values        TaskCustomFieldValue[]

  @@unique([project_id, field_key])
  @@index([project_id])
  @@index([project_id, position])
  @@map("task_custom_fields")
}

model TaskCustomFieldValue {
  id           String          @id @default(cuid())
  task_id      String          @db.VarChar(36)
  field_id     String          @db.VarChar(36)
  value_text   String?         @db.Text
  value_number Decimal?        @db.Decimal(15, 4)
  value_date   DateTime?       @db.Date
  value_json   Json?           @db.JsonB          // for select/multi_select/person
  created_at   DateTime        @default(now())
  updated_at   DateTime        @updatedAt

  // Relations
  task         Task            @relation(fields: [task_id], references: [id], onDelete: Cascade)
  field        TaskCustomField @relation(fields: [field_id], references: [id], onDelete: Cascade)

  @@unique([task_id, field_id])
  @@index([task_id])
  @@index([field_id])
  @@map("task_custom_field_values")
}
```

### 2.13 TaskTimeLog

```prisma
model TaskTimeLog {
  id               String   @id @default(cuid())
  task_id          String   @db.VarChar(36)
  user_id          String   @db.VarChar(36)
  start_time       DateTime
  end_time         DateTime?
  duration_minutes Int?                     // computed on end_time set: EXTRACT(EPOCH FROM end_time-start_time)/60
  description      String?  @db.VarChar(500)
  is_billable      Boolean  @default(false)
  hourly_rate      Decimal? @db.Decimal(10, 2)
  billed           Boolean  @default(false)
  billed_at        DateTime?
  invoice_id       String?  @db.VarChar(36)
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  // Relations
  task             Task     @relation(fields: [task_id], references: [id], onDelete: Cascade)
  user             User     @relation(fields: [user_id], references: [id])

  @@index([task_id])
  @@index([user_id])
  @@index([task_id, user_id])
  @@index([user_id, start_time])
  @@index([is_billable, billed])
  @@map("task_time_logs")
}
```

### 2.14 TaskRecurrence

```prisma
model TaskRecurrence {
  id              String   @id @default(cuid())
  task_id         String   @db.VarChar(36) @unique   // original/template task
  rrule           String   @db.VarChar(500)           // e.g. "FREQ=WEEKLY;BYDAY=MO;COUNT=52"
  next_due_at     DateTime
  last_created_at DateTime?
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())

  // Relations
  task            Task     @relation(fields: [task_id], references: [id], onDelete: Cascade)

  @@index([next_due_at])
  @@index([is_active])
  @@map("task_recurrences")
}
```

### 2.15 Sprint (Upgraded)

```prisma
enum SprintStatus {
  planning
  active
  completed
  cancelled
}

model Sprint {
  id                  String       @id @default(cuid())
  project_id          String       @db.VarChar(36)
  name                String       @db.VarChar(255)
  goal                String?      @db.Text
  status              SprintStatus @default(planning)
  start_date          DateTime     @db.Date
  end_date            DateTime     @db.Date
  velocity_target     Int?                            // planned story points
  velocity_actual     Int?                            // computed on completion: sum of completed task points
  capacity_hours      Decimal?     @db.Decimal(8, 2) // team hours available in sprint
  completed_points    Int          @default(0)
  retrospective_notes String?      @db.Text
  created_by          String       @db.VarChar(36)
  created_at          DateTime     @default(now())
  updated_at          DateTime     @updatedAt

  // Relations
  project             Project      @relation(fields: [project_id], references: [id], onDelete: Cascade)
  creator             User         @relation(fields: [created_by], references: [id])
  tasks               Task[]

  @@index([project_id])
  @@index([project_id, status])
  @@index([project_id, start_date])
  @@map("sprints")
}
```

### 2.16 ProjectRisk

```prisma
enum RiskCategory {
  technical
  resource
  external
  schedule
  budget
  quality
  other
}

enum RiskProbability {
  low     // numeric weight: 1
  medium  // numeric weight: 2
  high    // numeric weight: 3
}

enum RiskImpact {
  low     // numeric weight: 1
  medium  // numeric weight: 2
  high    // numeric weight: 3
}

enum RiskStatus {
  identified
  monitoring
  mitigated
  accepted
  closed
}

model ProjectRisk {
  id                String          @id @default(cuid())
  project_id        String          @db.VarChar(36)
  title             String          @db.VarChar(255)
  description       String?         @db.Text
  category          RiskCategory    @default(other)
  probability       RiskProbability @default(medium)
  impact            RiskImpact      @default(medium)
  risk_score        Int                               // probability_weight * impact_weight (1–9)
  status            RiskStatus      @default(identified)
  mitigation_plan   String?         @db.Text
  contingency_plan  String?         @db.Text
  owner_id          String?         @db.VarChar(36)
  review_date       DateTime?       @db.Date
  created_by        String          @db.VarChar(36)
  created_at        DateTime        @default(now())
  updated_at        DateTime        @updatedAt

  // Relations
  project           Project         @relation(fields: [project_id], references: [id], onDelete: Cascade)
  owner             User?           @relation("RiskOwner", fields: [owner_id], references: [id])
  creator           User            @relation("RiskCreator", fields: [created_by], references: [id])

  @@index([project_id])
  @@index([project_id, status])
  @@index([project_id, risk_score])
  @@map("project_risks")
}
```

### 2.17 ProjectBudgetEntry

```prisma
enum BudgetCategory {
  labor
  software
  hardware
  travel
  other
}

model ProjectBudgetEntry {
  id               String         @id @default(cuid())
  project_id       String         @db.VarChar(36)
  category         BudgetCategory @default(other)
  description      String         @db.VarChar(255)
  budgeted_amount  Decimal        @db.Decimal(15, 2)
  actual_amount    Decimal        @db.Decimal(15, 2)  @default(0)
  entry_date       DateTime       @db.Date
  created_by       String         @db.VarChar(36)
  created_at       DateTime       @default(now())

  // Relations
  project          Project        @relation(fields: [project_id], references: [id], onDelete: Cascade)
  creator          User           @relation(fields: [created_by], references: [id])

  @@index([project_id])
  @@index([project_id, category])
  @@index([project_id, entry_date])
  @@map("project_budget_entries")
}
```

### 2.18 ProjectTemplate

```prisma
model ProjectTemplate {
  id             String             @id @default(cuid())
  organization_id String            @db.VarChar(36)
  name           String             @db.VarChar(255)
  description    String?            @db.Text
  category       String?            @db.VarChar(100)   // e.g. "Software Development", "Marketing Campaign"
  methodology    ProjectMethodology @default(agile)
  template_data  Json               @db.JsonB
  // template_data structure:
  // {
  //   phases: [{ name, color, position }],
  //   statuses: [{ name, color, statusType, isDefault, position }],
  //   tasks: [{ title, phaseIndex, taskType, priority, estimatePoints }],
  //   customFields: [{ name, fieldKey, fieldType, options }],
  //   milestones: [{ name, dueDaysFromStart, color }]
  // }
  is_public      Boolean            @default(false)    // org-wide vs. creator only
  created_by     String             @db.VarChar(36)
  usage_count    Int                @default(0)
  created_at     DateTime           @default(now())
  updated_at     DateTime           @updatedAt

  // Relations
  organization   Organization       @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator        User               @relation(fields: [created_by], references: [id])
  projects       Project[]

  @@index([organization_id])
  @@index([organization_id, is_public])
  @@index([organization_id, category])
  @@map("project_templates")
}
```

---

## 3. File Structure

All paths relative to Turborepo root `C:\xampp\htdocs\Claude\zenflow\`.

### 3.1 Prisma Migrations

```
packages/db/prisma/migrations/
  20260527_projects_v2_core_upgrades/migration.sql        ← Project + ProjectMember upgrades
  20260527_projects_v2_phases_milestones/migration.sql
  20260527_projects_v2_task_statuses/migration.sql
  20260527_projects_v2_task_upgrade/migration.sql         ← Task + parent_task_id + new fields
  20260527_projects_v2_task_relations/migration.sql       ← Dependency/Assignee/Comment/Attachment
  20260527_projects_v2_checklists/migration.sql
  20260527_projects_v2_custom_fields/migration.sql
  20260527_projects_v2_time_logs/migration.sql
  20260527_projects_v2_sprint_upgrade/migration.sql
  20260527_projects_v2_risks_budget/migration.sql
  20260527_projects_v2_templates/migration.sql
  20260527_projects_v2_recurrence/migration.sql
```

### 3.2 tRPC Routers

```
packages/api/src/routers/projects/
  projects.router.ts
  phases.router.ts
  milestones.router.ts
  tasks.router.ts
  tasks.comments.router.ts
  tasks.attachments.router.ts
  tasks.timelogs.router.ts
  tasks.checklists.router.ts
  tasks.dependencies.router.ts
  tasks.custom-fields.router.ts
  sprints.router.ts
  kanban.router.ts
  gantt.router.ts
  workload.router.ts
  reports.router.ts
  templates.router.ts
  risks.router.ts
  budget.router.ts
  index.ts
packages/api/src/root.ts                                 ← register projects router
```

### 3.3 Background Jobs

```
apps/worker/src/jobs/projects/
  task-recurrence.job.ts       ← Creates new task instances per RRULE
  sprint-auto-close.job.ts     ← Auto-closes past-due active sprints
  milestone-notify.job.ts      ← Sends notifications for due milestones
  budget-alert.job.ts          ← Alerts PM when actual_cost > 80%/100% of budget
  time-log-timer.job.ts        ← Handles server-side timer for running time entries
apps/worker/src/queues/projects.queues.ts
```

### 3.4 Next.js App Pages

```
apps/web/src/app/(dashboard)/projects/
  page.tsx                                            ← Projects home (list of org projects)
  layout.tsx
  new/page.tsx                                        ← Project creation wizard
  templates/page.tsx                                  ← Template gallery
  [projectId]/
    layout.tsx                                        ← Project shell with sidebar nav
    page.tsx                                          ← Project overview (health, progress, stats)
    tasks/
      page.tsx                                        ← Default task view (respects project.default_view)
      list/page.tsx                                   ← List view
      board/page.tsx                                  ← Kanban board
      gantt/page.tsx                                  ← Gantt chart
      calendar/page.tsx                               ← Calendar view
      table/page.tsx                                  ← Spreadsheet-style table view
    sprints/
      page.tsx                                        ← Sprint list + backlog
      [sprintId]/page.tsx                             ← Sprint board
    phases/page.tsx
    milestones/page.tsx
    workload/page.tsx
    timelog/page.tsx                                  ← Project-wide time log view
    budget/page.tsx
    risks/page.tsx
    settings/
      page.tsx                                        ← General settings
      members/page.tsx
      statuses/page.tsx
      custom-fields/page.tsx
      client-portal/page.tsx

apps/web/src/app/(portal)/
  portal/[token]/
    page.tsx                                          ← Client portal home
    tasks/page.tsx                                    ← Client-visible tasks
    milestones/page.tsx
    files/page.tsx

apps/web/src/app/(dashboard)/my-work/
  page.tsx                                            ← Personal task list across all projects
  timelog/page.tsx                                    ← Personal time logs
```

### 3.5 Components

```
apps/web/src/components/projects/
  project/
    ProjectCard.tsx
    ProjectCreateWizard.tsx
    ProjectHeader.tsx
    ProjectHealthBadge.tsx
    ProjectProgress.tsx
  task/
    TaskRow.tsx
    TaskCard.tsx
    TaskDetail.tsx
    TaskForm.tsx
    TaskBulkActions.tsx
    TaskTypeIcon.tsx
    TaskPriorityBadge.tsx
    TaskStatusSelect.tsx
    SubtaskList.tsx
    TaskMoveModal.tsx
    TaskApprovalPanel.tsx
    RecurringTaskBadge.tsx
  views/
    ListView.tsx
    BoardView.tsx
    GanttView.tsx
    CalendarView.tsx
    TableView.tsx
  gantt/
    GanttChart.tsx
    GanttBar.tsx
    GanttDependencyArrow.tsx
    GanttTimeline.tsx
    GanttMilestoneMarker.tsx
    CriticalPathHighlight.tsx
  sprint/
    SprintHeader.tsx
    SprintBoard.tsx
    SprintBacklog.tsx
    SprintPlanningModal.tsx
    BurndownChart.tsx
    VelocityChart.tsx
    SprintRetrospective.tsx
  workload/
    WorkloadGrid.tsx
    UserCapacityBar.tsx
    WorkloadHeatmap.tsx
  timelog/
    TimeLogEntry.tsx
    TimeLogTimer.tsx                                  ← Live timer with start/stop
    TimeLogTable.tsx
    TimeLogExport.tsx
  custom-fields/
    CustomFieldRenderer.tsx
    CustomFieldForm.tsx
    FormulaFieldEvaluator.tsx
  risk/
    RiskMatrix.tsx
    RiskForm.tsx
    RiskList.tsx
  budget/
    BudgetOverview.tsx
    BudgetEntryForm.tsx
    BudgetChart.tsx
  checklist/
    ChecklistPanel.tsx
    ChecklistItem.tsx
  comment/
    CommentThread.tsx
    CommentEditor.tsx
    CommentItem.tsx
  dependency/
    DependencyGraph.tsx
    AddDependencyModal.tsx
  phase/
    PhaseTimeline.tsx
    PhaseForm.tsx
  milestone/
    MilestoneList.tsx
    MilestoneForm.tsx
    MilestoneBanner.tsx
  template/
    TemplateGallery.tsx
    TemplateCard.tsx
    TemplatePreview.tsx
```

### 3.6 Utility / Helper Files

```
packages/api/src/lib/projects/
  gantt/
    critical-path.ts             ← CPM algorithm
    dependency-validator.ts      ← Circular dependency detection
    date-calculator.ts           ← Forward/backward pass
  workload/
    workload-calculator.ts
  reports/
    burndown.ts
    velocity.ts
    timesheet.ts
  progress/
    progress-rollup.ts
  recurrence/
    rrule-processor.ts

apps/web/src/lib/projects/
  gantt-renderer.ts
  board-utils.ts
  sprint-utils.ts
  time-format.ts
```

---

## 4. tRPC Procedures

> All project routers use `protectedProcedure`. `orgId` is inferred from session. Project membership is checked via middleware for all project-scoped routes.

### 4.1 projects (CRUD)

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ status: z.string().optional(), type: ProjectTypeEnum.optional(), cursor: z.string().optional() })` | Paginated list of org projects the user can see (respects visibility) |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Project + members + phases + milestone count + task count summary |
| `create` | mutation | `z.object({ name: z.string().min(1).max(255), description: z.string().optional(), templateId: z.string().cuid().optional(), methodology: ProjectMethodologyEnum.optional(), projectType: ProjectTypeEnum.optional(), startDate: z.date().optional(), endDate: z.date().optional(), color: z.string().optional(), memberIds: z.array(z.string().cuid()).optional() })` | Creates project; if templateId provided, applies template (phases, statuses, task templates); adds creator as owner |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: ProjectUpdateSchema })` | Update project settings |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete; sets deleted_at |
| `archive` | mutation | `z.object({ id: z.string().cuid() })` | Sets archived_at |
| `unarchive` | mutation | `z.object({ id: z.string().cuid() })` | Clears archived_at |
| `updateHealth` | mutation | `z.object({ id: z.string().cuid(), health: ProjectHealthStatusEnum, notes: z.string().optional() })` | Update health status |
| `getStats` | query | `z.object({ id: z.string().cuid() })` | Task counts by status_type, completion %, overdue count, budget utilization |

### 4.2 projects.phases

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ projectId: z.string().cuid() })` | All phases ordered by position |
| `create` | mutation | `z.object({ projectId: z.string().cuid(), name: z.string().min(1).max(255), description: z.string().optional(), color: z.string().optional(), startDate: z.date().optional(), endDate: z.date().optional() })` | Create phase at end of list |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: PhaseUpdateSchema })` | Update phase |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Delete phase; unlinks tasks (phase_id → null) |
| `reorder` | mutation | `z.object({ projectId: z.string().cuid(), orderedIds: z.array(z.string().cuid()) })` | Update positions |

### 4.3 projects.milestones

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ projectId: z.string().cuid() })` | All milestones sorted by due_date |
| `create` | mutation | `z.object({ projectId: z.string().cuid(), phaseId: z.string().cuid().optional(), name: z.string().min(1).max(255), dueDate: z.date(), description: z.string().optional(), color: z.string().optional(), notifyOnDue: z.boolean().default(true) })` | Create milestone |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: MilestoneUpdateSchema })` | Update |
| `achieve` | mutation | `z.object({ id: z.string().cuid() })` | Sets status=achieved, achieved_at=NOW() |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Hard delete; unlinks tasks |

### 4.4 tasks (Full CRUD + Move + Reorder + Bulk)

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ projectId: z.string().cuid(), statusId: z.string().optional(), phaseId: z.string().optional(), sprintId: z.string().optional(), assigneeId: z.string().optional(), priority: TaskPriorityEnum.optional(), taskType: TaskTypeEnum.optional(), parentId: z.string().optional(), cursor: z.string().optional(), limit: z.number().default(50) })` | Filtered task list |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Task + subtasks + assignees + checklist summary + dependency count |
| `create` | mutation | `z.object({ projectId: z.string().cuid(), title: z.string().min(1).max(500), statusId: z.string().cuid(), parentTaskId: z.string().cuid().optional(), phaseId: z.string().cuid().optional(), milestoneId: z.string().cuid().optional(), sprintId: z.string().cuid().optional(), taskType: TaskTypeEnum.default("task"), priority: TaskPriorityEnum.default("medium"), description: z.string().optional(), estimatePoints: z.number().int().optional(), estimateHours: z.number().optional(), startDate: z.date().optional(), dueDate: z.date().optional(), assigneeIds: z.array(z.string().cuid()).optional() })` | Create task; updates sprint task count; triggers progress rollup |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: TaskUpdateSchema })` | Update task; re-triggers rollup |
| `move` | mutation | `z.object({ taskId: z.string().cuid(), statusId: z.string().cuid().optional(), sprintId: z.string().cuid().optional(), phaseId: z.string().cuid().optional(), position: z.number().int().optional() })` | Move task to new status/sprint/phase |
| `reorder` | mutation | `z.object({ statusId: z.string().cuid(), orderedIds: z.array(z.string().cuid()) })` | Drag-drop reorder within status |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete; also soft-deletes subtasks recursively |
| `bulkUpdate` | mutation | `z.object({ ids: z.array(z.string().cuid()), data: z.object({ statusId: z.string().optional(), assigneeId: z.string().optional(), priority: TaskPriorityEnum.optional(), sprintId: z.string().optional() }) })` | Batch update |
| `bulkDelete` | mutation | `z.object({ ids: z.array(z.string().cuid()) })` | Batch soft-delete |
| `convert` | mutation | `z.object({ taskId: z.string().cuid(), newType: TaskTypeEnum })` | Convert task type (e.g., task → bug) |
| `duplicate` | mutation | `z.object({ taskId: z.string().cuid(), includeSubtasks: z.boolean().default(false) })` | Deep copy task |
| `requestApproval` | mutation | `z.object({ taskId: z.string().cuid() })` | Sets approval_status=pending; notifies approvers |
| `approve` | mutation | `z.object({ taskId: z.string().cuid() })` | Sets approval_status=approved, approved_by, approved_at |
| `reject` | mutation | `z.object({ taskId: z.string().cuid(), reason: z.string().optional() })` | Sets approval_status=rejected |

### 4.5 tasks.comments

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ taskId: z.string().cuid() })` | All non-deleted comments, threaded, chronological |
| `create` | mutation | `z.object({ taskId: z.string().cuid(), content: z.string().min(1), contentHtml: z.string().optional(), isInternal: z.boolean().default(false), parentCommentId: z.string().cuid().optional() })` | Post comment; notifies assignees/watchers |
| `update` | mutation | `z.object({ id: z.string().cuid(), content: z.string().min(1), contentHtml: z.string().optional() })` | Edit; sets edited_at |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete |

### 4.6 tasks.attachments

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ taskId: z.string().cuid() })` | All non-deleted attachments |
| `getUploadUrl` | mutation | `z.object({ taskId: z.string().cuid(), fileName: z.string(), mimeType: z.string(), fileSize: z.number() })` | Returns presigned MinIO upload URL + attachment ID |
| `confirmUpload` | mutation | `z.object({ attachmentId: z.string().cuid() })` | Verifies upload to MinIO completed; generates thumbnail if image |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Soft-delete; schedules MinIO object deletion |

### 4.7 tasks.timelogs

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ taskId: z.string().cuid().optional(), userId: z.string().cuid().optional(), projectId: z.string().cuid().optional(), dateFrom: z.date().optional(), dateTo: z.date().optional(), isBillable: z.boolean().optional() })` | Filtered time log list |
| `start` | mutation | `z.object({ taskId: z.string().cuid(), description: z.string().optional() })` | Creates open time log (end_time null); one running timer per user |
| `stop` | mutation | `z.object({ timeLogId: z.string().cuid() })` | Sets end_time=NOW(); computes duration_minutes; updates task.actual_hours |
| `create` | mutation | `z.object({ taskId: z.string().cuid(), startTime: z.date(), endTime: z.date(), description: z.string().optional(), isBillable: z.boolean().default(false), hourlyRate: z.number().optional() })` | Manual log entry |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: TimeLogUpdateSchema })` | Edit |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Delete; adjusts task.actual_hours |
| `getRunning` | query | `z.object({})` | Returns the current user's running timer if any |

### 4.8 tasks.checklists

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ taskId: z.string().cuid() })` | Checklists + items for task |
| `createChecklist` | mutation | `z.object({ taskId: z.string().cuid(), title: z.string().min(1).max(255) })` | Create checklist |
| `deleteChecklist` | mutation | `z.object({ checklistId: z.string().cuid() })` | Delete checklist + items |
| `addItem` | mutation | `z.object({ checklistId: z.string().cuid(), text: z.string().min(1).max(500), position: z.number().optional() })` | Add item |
| `updateItem` | mutation | `z.object({ itemId: z.string().cuid(), text: z.string().optional(), isDone: z.boolean().optional() })` | Toggle done or edit text |
| `deleteItem` | mutation | `z.object({ itemId: z.string().cuid() })` | Delete item |
| `reorderItems` | mutation | `z.object({ checklistId: z.string().cuid(), orderedIds: z.array(z.string().cuid()) })` | Reorder |

### 4.9 tasks.dependencies

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ taskId: z.string().cuid() })` | Dependencies + blocking tasks for task |
| `create` | mutation | `z.object({ taskId: z.string().cuid(), dependsOnTaskId: z.string().cuid(), dependencyType: DependencyTypeEnum.default("finish_to_start"), lagDays: z.number().int().default(0) })` | Create dependency; validates no circular dependency; updates task.is_blocked |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Remove dependency; recalculates is_blocked |

### 4.10 sprints

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ projectId: z.string().cuid(), status: SprintStatusEnum.optional() })` | Sprints ordered by start_date desc |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Sprint + tasks + velocity/capacity stats |
| `create` | mutation | `z.object({ projectId: z.string().cuid(), name: z.string().min(1), goal: z.string().optional(), startDate: z.date(), endDate: z.date(), velocityTarget: z.number().int().optional(), capacityHours: z.number().optional() })` | Create sprint |
| `update` | mutation | `z.object({ id: z.string().cuid(), data: SprintUpdateSchema })` | Update |
| `start` | mutation | `z.object({ id: z.string().cuid() })` | Status → active; validates only one active sprint per project |
| `complete` | mutation | `z.object({ id: z.string().cuid(), moveIncompleteToSprintId: z.string().cuid().optional() })` | Complete sprint; computes velocity_actual; moves incomplete tasks |
| `addTask` | mutation | `z.object({ sprintId: z.string().cuid(), taskId: z.string().cuid() })` | Add task to sprint |
| `removeTask` | mutation | `z.object({ sprintId: z.string().cuid(), taskId: z.string().cuid() })` | Remove task (back to backlog) |

### 4.11 kanban.data

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `getBoardData` | query | `z.object({ projectId: z.string().cuid(), sprintId: z.string().cuid().optional(), phaseId: z.string().cuid().optional(), groupBy: z.enum(["status","assignee","priority","phase"]).default("status") })` | Returns columns + tasks grouped per groupBy strategy; optimized single DB query |

### 4.12 gantt.data

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `getGanttData` | query | `z.object({ projectId: z.string().cuid(), dateFrom: z.date().optional(), dateTo: z.date().optional() })` | Returns all tasks with start_date, due_date, dependencies, critical path flags; includes phases and milestones |

### 4.13 workload.data

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `getWorkloadData` | query | `z.object({ projectId: z.string().cuid().optional(), dateFrom: z.date(), dateTo: z.date(), userIds: z.array(z.string().cuid()).optional() })` | Returns per-user per-day assigned hours + capacity; used to render workload heatmap |

### 4.14 reports

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `getBurndownData` | query | `z.object({ sprintId: z.string().cuid() })` | Daily remaining points/hours for sprint burndown chart |
| `getVelocityData` | query | `z.object({ projectId: z.string().cuid(), lastNSprints: z.number().int().min(1).max(20).default(10) })` | Velocity per sprint + rolling average |
| `getTimesheetData` | query | `z.object({ projectId: z.string().cuid().optional(), userId: z.string().cuid().optional(), dateFrom: z.date(), dateTo: z.date(), groupBy: z.enum(["user","task","date","project"]) })` | Aggregated time logs |
| `getProgressReport` | query | `z.object({ projectId: z.string().cuid() })` | Completion % by phase, milestone status counts, task type breakdown |
| `getBudgetReport` | query | `z.object({ projectId: z.string().cuid() })` | Budgeted vs actual by category, burn rate, projected overage |

### 4.15 templates

| Procedure | Type | Input Schema | Description |
|-----------|------|-------------|-------------|
| `list` | query | `z.object({ category: z.string().optional() })` | Public templates + org templates |
| `getById` | query | `z.object({ id: z.string().cuid() })` | Template + preview of template_data |
| `create` | mutation | `TemplateCreateSchema` | Create template |
| `createFromProject` | mutation | `z.object({ projectId: z.string().cuid(), name: z.string(), description: z.string().optional(), isPublic: z.boolean().default(false) })` | Snapshots project structure into template_data |
| `applyToProject` | mutation | `z.object({ templateId: z.string().cuid(), projectId: z.string().cuid() })` | Applies template to existing project (non-destructive merge) |
| `delete` | mutation | `z.object({ id: z.string().cuid() })` | Delete (only creator or org admin) |

---

## 5. Pages & Views

| Route | Component | Description |
|-------|-----------|-------------|
| `/projects` | `ProjectsListPage` | Grid/list of all accessible projects, filters by status/type, search, new project button |
| `/projects/new` | `ProjectCreatePage` | Multi-step wizard: name → template select → members → dates → create |
| `/projects/templates` | `TemplateGalleryPage` | Browse templates by category; preview modal; "Use template" button |
| `/projects/[projectId]` | `ProjectOverviewPage` | Health status, progress ring, upcoming milestones, recent activity, team members, budget utilization |
| `/projects/[projectId]/tasks` | `TasksDefaultPage` | Renders default view per `project.default_view` setting |
| `/projects/[projectId]/tasks/list` | `TasksListPage` | Multi-level list with collapsible subtasks, inline editing, filter bar |
| `/projects/[projectId]/tasks/board` | `TasksBoardPage` | Kanban with status columns, swim lanes option, quick-add in column, drag-drop |
| `/projects/[projectId]/tasks/gantt` | `TasksGanttPage` | Gantt chart with phase bands, dependency arrows, critical path highlight, drag to resize/move bars |
| `/projects/[projectId]/tasks/calendar` | `TasksCalendarPage` | Monthly calendar with task chips on due dates |
| `/projects/[projectId]/tasks/table` | `TasksTablePage` | Spreadsheet view with all custom fields as columns, inline cell editing, column resize/reorder |
| `/projects/[projectId]/sprints` | `SprintsPage` | Sprint list + backlog; drag tasks between sprints and backlog |
| `/projects/[projectId]/sprints/[sprintId]` | `SprintBoardPage` | Sprint kanban + burndown chart sidebar + velocity badge |
| `/projects/[projectId]/phases` | `PhasesPage` | Phase timeline view with tasks grouped under phases |
| `/projects/[projectId]/milestones` | `MilestonesPage` | Milestone list with status badges + timeline visualization |
| `/projects/[projectId]/workload` | `WorkloadPage` | User × date grid showing assigned hours; capacity bar per user; overloaded users highlighted red |
| `/projects/[projectId]/timelog` | `TimeLogPage` | Time log table for project, grouped by user or date; export to CSV |
| `/projects/[projectId]/budget` | `BudgetPage` | Budget overview card + entries table + category donut chart |
| `/projects/[projectId]/risks` | `RisksPage` | Risk register table + 3×3 risk matrix chart |
| `/projects/[projectId]/settings` | `ProjectSettingsPage` | General project settings form |
| `/projects/[projectId]/settings/members` | `ProjectMembersPage` | Member list with role edit + invite form |
| `/projects/[projectId]/settings/statuses` | `StatusSettingsPage` | Drag-drop reorderable status list; add/edit/delete; status_type mapping |
| `/projects/[projectId]/settings/custom-fields` | `CustomFieldsSettingsPage` | Custom field definitions; reorder; configure options for select types |
| `/projects/[projectId]/settings/client-portal` | `ClientPortalSettingsPage` | Toggle client portal; copy portal URL; configure what client can see |
| `/portal/[token]` | `ClientPortalPage` | Public client view: project progress, milestones, non-internal tasks, files — no login required |
| `/portal/[token]/tasks` | `ClientPortalTasksPage` | Task list filtered to client-visible items |
| `/portal/[token]/milestones` | `ClientPortalMilestonesPage` | Milestone tracker |
| `/portal/[token]/files` | `ClientPortalFilesPage` | Downloadable project files |
| `/my-work` | `MyWorkPage` | Personal task inbox across all projects: due today, overdue, assigned to me, no due date |
| `/my-work/timelog` | `MyTimelogPage` | Personal time log with running timer widget |

---

## 6. Business Logic

### 6.1 Gantt Calculation — Critical Path Method (CPM)

**Location:** `packages/api/src/lib/projects/gantt/critical-path.ts`

The Critical Path Method finds the longest path through the task network. Any task on this path, if delayed, delays the project end date.

```typescript
// Data structures
interface GanttTask {
  id: string;
  start_date: Date | null;
  due_date: Date | null;
  estimate_hours: number;
  dependencies: { depends_on_task_id: string; dependency_type: DependencyType; lag_days: number }[];
}

// Forward Pass — computes Earliest Start (ES) and Earliest Finish (EF)
function forwardPass(tasks: GanttTask[]): Map<string, { es: Date; ef: Date }> {
  // Topological sort tasks by dependencies (Kahn's algorithm)
  // For each task in topological order:
  //   ES = MAX(EF of all predecessors adjusted for dependency type + lag_days)
  //         If no predecessors: ES = project start date
  //   EF = ES + estimate_hours (converted to calendar days, respecting working days)
}

// Backward Pass — computes Latest Start (LS) and Latest Finish (LF)
function backwardPass(tasks: GanttTask[], projectEnd: Date): Map<string, { ls: Date; lf: Date }> {
  // Reverse topological order
  // For each task (reverse):
  //   LF = MIN(LS of all successors adjusted for dependency type)
  //         If no successors: LF = project end date
  //   LS = LF - estimate_hours
}

// Float = LS - ES (slack). Tasks with float=0 are on the critical path.
function markCriticalPath(
  forwardMap: Map<string, { es: Date; ef: Date }>,
  backwardMap: Map<string, { ls: Date; lf: Date }>
): Set<string> {
  const criticalIds = new Set<string>();
  for (const [id, { es }] of forwardMap) {
    const { ls } = backwardMap.get(id)!;
    const floatDays = differenceInCalendarDays(ls, es);
    if (floatDays === 0) criticalIds.add(id);
  }
  return criticalIds;
}
```

The API returns tasks annotated with `{ isCritical: boolean, float: number, es, ef, ls, lf }`. The Gantt component uses `isCritical` to color bars red.

### 6.2 Workload Calculation

**Location:** `packages/api/src/lib/projects/workload/workload-calculator.ts`

```
Input: dateFrom, dateTo, user IDs

For each user in set:
  capacity_hours_per_day = user.workday_hours (default 8)
  For each calendar day in [dateFrom, dateTo]:
    if day is weekend or org holiday: capacity = 0
    else: capacity = capacity_hours_per_day

  assigned_hours_per_day[day] = 0
  For each task assigned to user where:
    start_date <= day <= due_date AND deleted_at IS NULL AND status_type != 'done'
    contribution = task.estimate_hours / working_days_in_range(start_date, due_date)
    assigned_hours_per_day[day] += contribution

  utilization[day] = assigned_hours_per_day[day] / capacity[day]
  if utilization > 1.0: flag as overloaded

Return: { userId, days: [{ date, capacity, assigned, utilization, tasks: [taskId] }] }
```

### 6.3 Sprint Velocity Computation

**Location:** `packages/api/src/lib/projects/reports/velocity.ts`

```
On sprint.complete():
  velocity_actual = SUM(estimate_points) for all tasks in sprint
                    WHERE status.status_type = 'done'
  Sprint.velocity_actual = velocity_actual
  Sprint.completed_points = velocity_actual

getVelocityData(projectId, lastNSprints):
  sprints = last N completed sprints ordered by end_date
  rolling_avg = SUM(velocity_actual for last 3 sprints) / 3
  return sprints.map(s => ({ sprint, velocity_actual, velocity_target, rolling_avg }))
```

### 6.4 Task Dependency Circular Detection

**Location:** `packages/api/src/lib/projects/gantt/dependency-validator.ts`

Uses depth-first search to detect cycles before inserting a new dependency edge.

```typescript
// Called before creating a TaskDependency
function wouldCreateCycle(
  taskId: string,           // the task being made dependent (B)
  dependsOnTaskId: string,  // the prerequisite (A)
  allDependencies: Array<{ task_id: string; depends_on_task_id: string }>
): boolean {
  // Build adjacency list: from each task, which tasks does it depend on?
  const adj = new Map<string, Set<string>>();
  for (const dep of allDependencies) {
    if (!adj.has(dep.task_id)) adj.set(dep.task_id, new Set());
    adj.get(dep.task_id)!.add(dep.depends_on_task_id);
  }
  // Temporarily add the proposed edge
  if (!adj.has(taskId)) adj.set(taskId, new Set());
  adj.get(taskId)!.add(dependsOnTaskId);

  // DFS from taskId — if we reach taskId again, there is a cycle
  const visited = new Set<string>();
  function dfs(current: string): boolean {
    if (current === taskId && visited.size > 0) return true; // cycle found
    if (visited.has(current)) return false;
    visited.add(current);
    for (const neighbor of adj.get(current) ?? []) {
      if (dfs(neighbor)) return true;
    }
    return false;
  }
  return dfs(dependsOnTaskId);
}
```

If `wouldCreateCycle` returns `true`, the tRPC mutation throws a `TRPCError` with code `BAD_REQUEST` and message `"This dependency would create a circular reference"`.

### 6.5 Progress Rollup from Subtasks

**Location:** `packages/api/src/lib/projects/progress/progress-rollup.ts`

Runs after any task status change. Recursively updates parent tasks.

```
rollupProgress(taskId):
  task = get task with all immediate subtasks
  if task.subtasks.length == 0: return  // leaf node

  total = task.subtasks.length
  done = count where subtask.status.status_type == 'done'
  completion_pct = done / total * 100

  // Store on task (uses custom_fields or a dedicated computed column)
  // If ALL subtasks are done AND task is not yet done:
  //   auto-complete parent? (based on org setting: auto_complete_parent_when_subtasks_done)

  // Recurse up the tree
  if task.parent_task_id:
    rollupProgress(task.parent_task_id)
```

### 6.6 Burndown Chart Data Generation

**Location:** `packages/api/src/lib/projects/reports/burndown.ts`

```
getBurndownData(sprintId):
  sprint = get sprint with start_date, end_date, tasks[]

  // Ideal line
  total_points = SUM(tasks.estimate_points)
  sprint_days = working_days(sprint.start_date, sprint.end_date)
  ideal_per_day = total_points / sprint_days
  ideal_line = [{ date: day_i, points: total_points - (i * ideal_per_day) }]

  // Actual line — walk through each day
  For each working day from start_date to MIN(today, end_date):
    remaining = SUM(estimate_points) for tasks where
      completed_at IS NULL OR completed_at::date > current_day
    actual_line.push({ date: current_day, points: remaining })

  // Scope changes line — track added/removed tasks per day
  scope_changes = group task additions by created_at::date

  return { idealLine, actualLine, scopeChanges, total_points, completed_points }
```

### 6.7 Time Log Billing Logic

**Location:** `packages/api/src/lib/projects/reports/timesheet.ts`

Billing flow:

```
1. Time log entries have is_billable flag (default false)
   hourly_rate = task_time_log.hourly_rate
              ?? project_member.hourly_rate
              ?? org.default_hourly_rate

2. getBillableSummary(projectId, dateFrom, dateTo):
   SELECT user_id,
          SUM(duration_minutes)/60 as billable_hours,
          SUM((duration_minutes/60) * hourly_rate) as billable_amount
   WHERE is_billable = true AND billed = false

3. markBilled(timeLogIds, invoiceId):
   UPDATE task_time_logs
   SET billed = true, billed_at = NOW(), invoice_id = invoiceId
   WHERE id IN (timeLogIds)
   Also updates task.actual_hours aggregates
```

### 6.8 Task Recurrence Processor

**Location:** `apps/worker/src/jobs/projects/task-recurrence.job.ts`  
**Schedule:** BullMQ cron every 30 minutes

```
1. Fetch all TaskRecurrence where:
   is_active = true AND next_due_at <= NOW()

2. For each recurrence:
   a. Load original task as template
   b. Parse rrule using rrule library
   c. Create new Task copying: title, description, project_id, status_id (default),
      task_type, priority, estimate_points, estimate_hours, assignees, checklist templates
      due_date = next_due_at
   d. Compute next occurrence from RRULE
   e. Update TaskRecurrence.next_due_at = next occurrence
      Update TaskRecurrence.last_created_at = NOW()
   f. If RRULE has no more occurrences (COUNT exhausted or UNTIL passed):
      Set is_active = false
```

---

## 7. External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | `^6.1.0` | Kanban and list drag-and-drop |
| `@dnd-kit/sortable` | `^8.0.0` | Sortable task lists |
| `@dnd-kit/utilities` | `^3.2.2` | DnD helpers |
| `dhtmlx-gantt` | `^9.0.0` | Gantt chart rendering (or use custom SVG) |
| `react-gantt-chart` | `^1.0.2` | Alternative lightweight Gantt |
| `rrule` | `^2.8.1` | RFC 5545 recurrence rule parsing and expansion |
| `date-fns` | `^3.6.0` | Date arithmetic, working day calculations |
| `date-fns-tz` | `^3.1.3` | Timezone-aware date handling |
| `recharts` | `^2.12.7` | Burndown, velocity, budget charts |
| `@tanstack/react-table` | `^8.17.3` | Spreadsheet table view |
| `@tanstack/react-virtual` | `^3.5.0` | Virtual scrolling for large task lists |
| `tiptap` | `^2.4.0` | Rich text editor for task descriptions and comments |
| `@tiptap/react` | `^2.4.0` | Tiptap React integration |
| `@tiptap/starter-kit` | `^2.4.0` | Tiptap extension bundle |
| `@tiptap/extension-mention` | `^2.4.0` | @mention users in comments |
| `csv-parse` | `^5.5.6` | Time log CSV import |
| `csv-stringify` | `^6.5.0` | Time log CSV export |
| `papaparse` | `^5.4.1` | Client-side CSV parse for import |
| `zod` | `^3.23.8` | Schema validation |
| `react-hook-form` | `^7.51.5` | Form management |
| `@hookform/resolvers` | `^3.6.0` | Zod + RHF integration |
| `immer` | `^10.1.1` | Immutable state updates for board drag-drop |
| `use-immer` | `^0.10.0` | React hook wrapper for immer |
| `dayjs` | `^1.11.11` | Lightweight date util for Gantt timeline header |
| `react-colorful` | `^5.6.1` | Color picker for phase/milestone/status colors |
| `sharp` | `^0.33.4` | Image thumbnail generation for attachments |
| `bullmq` | `^5.12.0` | Background job queues (already in project) |
| `ioredis` | `^5.3.2` | Redis client (already in project) |
| `minio` | `^8.0.1` | File storage client (already in project) |
| `@fullcalendar/react` | `^6.1.14` | Calendar view |
| `@fullcalendar/daygrid` | `^6.1.14` | Month/week calendar grid |
| `@fullcalendar/interaction` | `^6.1.14` | Calendar event drag interactions |

---

*End of Document 2: Projects v2 Implementation Specification*
