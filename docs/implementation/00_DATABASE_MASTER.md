# ZenFlow v2 — Master Database & Implementation Index

> **Generated:** 2026-05-27  
> **Purpose:** Single reference for every new Prisma model, enum, file, and tRPC router across all 12 module upgrades.  
> **Total new models:** ~176  
> **Total new enums:** ~120+  
> **Total new files:** ~650+  
> **Total implementation doc lines:** ~16,000+

---

## Table of Contents

1. [Quick Stats](#quick-stats)
2. [Module-by-Module Table Count](#module-by-module-table-count)
3. [All New Prisma Models — Master List](#all-new-prisma-models--master-list)
4. [All New Enums — Master List](#all-new-enums--master-list)
5. [New npm Packages Required](#new-npm-packages-required)
6. [New Environment Variables Required](#new-environment-variables-required)
7. [BullMQ Workers — Master List](#bullmq-workers--master-list)
8. [Implementation Phase Plan](#implementation-phase-plan)
9. [Document Index](#document-index)

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Implementation spec documents | 12 |
| Total spec lines | ~16,200 |
| New Prisma models (new tables) | ~176 |
| Upgraded Prisma models (columns added) | ~30 |
| New enums | ~120 |
| New tRPC routers / router groups | ~90 |
| New app pages / routes | ~300+ |
| New BullMQ workers | ~35 |
| New npm packages (runtime) | ~60 |
| Estimated new Prisma schema lines | ~8,000 |

---

## Module-by-Module Table Count

| # | Module | Doc | New Models | Upgraded Models | New Enums | New Pages |
|---|--------|-----|-----------|----------------|-----------|-----------|
| 1 | CRM v2 | `01_CRM_v2.md` | 21 | 3 | 18 | 48 |
| 2 | Projects v2 | `02_PROJECTS_v2.md` | 16 | 4 | 14 | 26 |
| 3 | HR v2 | `03_HR_v2.md` | 24 | 3 | 36 | 38 |
| 4 | Help Desk v2 | `04_HELPDESK_v2.md` | 15 | 2 | 20 | 40 |
| 5 | Accounting v2 | `05_ACCOUNTING_v2.md` | 16 | 3 | 15 | 28 |
| 6 | Inventory v2 | `06_INVENTORY_v2.md` | 17 | 3 | 16 | 34 |
| 7 | Forms v2 | `07_FORMS_v2.md` | 8 | 2 | 8 | 18 |
| 8 | Analytics v2 | `08_ANALYTICS_v2.md` | 5 | 1 | 6 | 14 |
| 9 | Workflows v2 | `09_WORKFLOWS_v2.md` | 7 | 2 | 10 | 16 |
| 10 | Documents v2 | `10_DOCUMENTS_v2.md` | 7 | 2 | 7 | 12 |
| 11 | Chat v2 | `11_CHAT_v2.md` | 10 | 2 | 8 | 10 |
| 12 | Platform Features | `12_PLATFORM_FEATURES.md` | 11 | 0 | 12 | 20 |
| **TOTAL** | | | **~157** | **~27** | **~170** | **~304** |

---

## All New Prisma Models — Master List

### 01 — CRM v2 (21 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `CrmPipeline` | `crm_pipelines` | Named pipeline (Sales, Partnerships, etc.) |
| `CrmStage` | `crm_stages` | Stage within a pipeline |
| `CrmAccount` | `crm_accounts` | Company-level entity (B2B account) |
| `CrmContact` | `crm_contacts` | Individual person (upgraded) |
| `CrmDeal` | `crm_deals` | Opportunity (upgraded with rotting, weighted amount) |
| `CrmProduct` | `crm_products` | Product/service catalog |
| `CrmDealProduct` | `crm_deal_products` | Line items on a deal |
| `CrmQuote` | `crm_quotes` | Formal quote linked to deal |
| `CrmQuoteLine` | `crm_quote_lines` | Line items on quote |
| `CrmActivity` | `crm_activities` | Tasks, calls, meetings (upgraded) |
| `CrmNote` | `crm_notes` | Rich-text notes on any entity |
| `CrmEmailIntegration` | `crm_email_integrations` | Gmail/Outlook OAuth connection per user |
| `CrmEmailLog` | `crm_email_logs` | Tracked sent/received emails |
| `CrmSequence` | `crm_sequences` | Multi-step drip sequence |
| `CrmSequenceStep` | `crm_sequence_steps` | One step in a sequence |
| `CrmSequenceEnrollment` | `crm_sequence_enrollments` | Contact enrolled in sequence |
| `CrmLeadScoreRule` | `crm_lead_score_rules` | Condition → score delta rule |
| `CrmTerritory` | `crm_territories` | Geographic/logical sales territory |
| `CrmFile` | `crm_files` | Attachments on any CRM entity |
| `CrmWebForm` | `crm_web_forms` | Embeddable lead capture form |
| `CrmWebFormSubmission` | `crm_web_form_submissions` | Web form fill |

### 02 — Projects v2 (16 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `ProjectPhase` | `project_phases` | Phase within a project |
| `ProjectMilestone` | `project_milestones` | Key checkpoint with date |
| `TaskStatus` | `task_statuses` | Per-project custom statuses |
| `TaskDependency` | `task_dependencies` | FS/FF/SS/SF dependency edges |
| `TaskAssignee` | `task_assignees` | Multi-assignee per task |
| `TaskComment` | `task_comments` | Threaded task comments |
| `TaskAttachment` | `task_attachments` | Files on a task |
| `TaskChecklist` | `task_checklists` | Named checklist on a task |
| `TaskChecklistItem` | `task_checklist_items` | Individual checkbox item |
| `TaskCustomField` | `task_custom_fields` | Per-project custom field definition |
| `TaskCustomFieldValue` | `task_custom_field_values` | Value for a custom field on a task |
| `TaskTimeLog` | `task_time_logs` | Time entry against a task |
| `TaskRecurrence` | `task_recurrences` | RRULE recurrence config |
| `Sprint` | `sprints` | Scrum sprint (upgraded) |
| `ProjectRisk` | `project_risks` | Risk register entry |
| `ProjectBudgetEntry` | `project_budget_entries` | Budget line item |
| `ProjectTemplate` | `project_templates` | Reusable project blueprint |

### 03 — HR v2 (24 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `HrDepartment` | `hr_departments` | Company department |
| `HrDesignation` | `hr_designations` | Job title / grade |
| `HrShift` | `hr_shifts` | Shift definition (timings, tolerance) |
| `HrShiftAssignment` | `hr_shift_assignments` | Employee→shift mapping per date range |
| `HrHolidayCalendar` | `hr_holiday_calendars` | Named calendar per location/country |
| `HrHoliday` | `hr_holidays` | Holiday entry in a calendar |
| `HrLeaveType` | `hr_leave_types` | Leave policy (accrual, carryover, encash) |
| `HrLeaveBalance` | `hr_leave_balances` | Employee leave balance ledger |
| `HrLeaveRequest` | `hr_leave_requests` | Leave application |
| `HrLeaveApproval` | `hr_leave_approvals` | Approval step in leave workflow |
| `HrPayrollPeriod` | `hr_payroll_periods` | Monthly payroll cycle |
| `HrPayrollEntry` | `hr_payroll_entries` | Per-employee payroll computation result |
| `HrSalaryStructure` | `hr_salary_structures` | Template for salary components |
| `HrEmployeeSalary` | `hr_employee_salaries` | Employee→salary structure assignment |
| `HrGoal` | `hr_goals` | OKR goal (individual/team/org) |
| `HrPerformanceReviewCycle` | `hr_performance_review_cycles` | Annual/quarterly review cycle |
| `HrPerformanceReview` | `hr_performance_reviews` | Employee review instance |
| `HrReviewCriteria` | `hr_review_criteria` | Criteria within a cycle |
| `HrReviewCriteriaRating` | `hr_review_criteria_ratings` | Per-criteria rating on a review |
| `HrDocument` | `hr_documents` | Employee document vault |
| `HrJobPosting` | `hr_job_postings` | Open job requisition |
| `HrApplication` | `hr_applications` | Candidate application |
| `HrOnboardingTemplate` | `hr_onboarding_templates` | Template for new hire checklist |
| `HrOnboardingTask` | `hr_onboarding_tasks` | Task within onboarding template |

### 04 — Help Desk v2 (15 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `HdTicketReply` | `hd_ticket_replies` | Message/reply in a ticket thread |
| `HdSlaPolicy` | `hd_sla_policies` | SLA definition (response/resolution times) |
| `HdBusinessHours` | `hd_business_hours` | Per-org/team working hours calendar |
| `HdCategory` | `hd_categories` | Ticket category tree |
| `HdTeam` | `hd_teams` | Support team |
| `HdTeamMember` | `hd_team_members` | Agent→team membership |
| `HdCannedResponse` | `hd_canned_responses` | Saved reply template |
| `HdRoutingRule` | `hd_routing_rules` | Auto-assign rule |
| `HdTimeLog` | `hd_time_logs` | Time spent on a ticket |
| `HdArticleVersion` | `hd_article_versions` | KB article version history |
| `HdArticleFeedback` | `hd_article_feedback` | Thumbs up/down on KB article |
| `HdEmailInbox` | `hd_email_inboxes` | Shared mailbox config |
| `HdSatisfactionSurvey` | `hd_satisfaction_surveys` | CSAT survey config |
| `HdAutomationRule` | `hd_automation_rules` | Trigger → action automation |
| `HdRoundRobinState` | `hd_round_robin_state` | Per-team pointer for round-robin |

### 05 — Accounting v2 (16 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `AccChartOfAccount` | `acc_chart_of_accounts` | Self-referential COA tree |
| `AccJournalEntry` | `acc_journal_entries` | Double-entry journal entry header |
| `AccJournalEntryLine` | `acc_journal_entry_lines` | Debit/credit leg of journal entry |
| `AccInvoice` | `acc_invoices` | Sales invoice (upgraded) |
| `AccInvoiceLine` | `acc_invoice_lines` | Invoice line item |
| `AccBill` | `acc_bills` | Vendor bill (accounts payable) |
| `AccBillLine` | `acc_bill_lines` | Bill line item |
| `AccPayment` | `acc_payments` | Payment record |
| `AccVendor` | `acc_vendors` | Vendor / supplier |
| `AccBankAccount` | `acc_bank_accounts` | Bank account linked to org |
| `AccBankTransaction` | `acc_bank_transactions` | Imported bank statement line |
| `AccReconciliationMatch` | `acc_reconciliation_matches` | Bank txn ↔ payment match |
| `AccExpenseClaim` | `acc_expense_claims` | Employee expense report |
| `AccFixedAsset` | `acc_fixed_assets` | Fixed asset register entry |
| `AccBudget` | `acc_budgets` | Budget header |
| `AccBudgetLine` | `acc_budget_lines` | Per-account budget line |
| `AccCostCenter` | `acc_cost_centers` | Self-referential cost center tree |
| `AccTaxRate` | `acc_tax_rates` | Tax rate definition (GST, VAT, etc.) |

### 06 — Inventory v2 (17 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `InvWarehouse` | `inv_warehouses` | Physical warehouse |
| `InvLocation` | `inv_locations` | Self-referential zone/rack/bin hierarchy |
| `InvProductVariant` | `inv_product_variants` | SKU variant (size/color) |
| `InvProductAttribute` | `inv_product_attributes` | Attribute definition (Size, Color) |
| `InvProductAttributeValue` | `inv_product_attribute_values` | Attribute option value |
| `InvStockLevel` | `inv_stock_levels` | Product×Location current quantity |
| `InvStockMovement` | `inv_stock_movements` | Every in/out movement (audit trail) |
| `InvCostLayer` | `inv_cost_layers` | FIFO cost layers for valuation |
| `InvSerialNumber` | `inv_serial_numbers` | Serialized item tracking |
| `InvLot` | `inv_lots` | Lot/batch with expiry date |
| `InvBOM` | `inv_boms` | Bill of Materials header |
| `InvBOMComponent` | `inv_bom_components` | One component in a BOM |
| `InvProductionOrder` | `inv_production_orders` | Manufacturing work order |
| `InvProductionConsumption` | `inv_production_consumptions` | Raw material consumed on order |
| `InvPhysicalCount` | `inv_physical_counts` | Stock-take session |
| `InvPhysicalCountLine` | `inv_physical_count_lines` | Counted vs expected per SKU |
| `InvBarcode` | `inv_barcodes` | Barcode/QR records for products |

### 07 — Forms v2 (8 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `FormOptionSource` | `form_option_sources` | DB-linked dynamic option source |
| `FormApprovalStep` | `form_approval_steps` | Approval step in form workflow |
| `FormApprovalLog` | `form_approval_logs` | Approval decision audit |
| `FormWebhookQueue` | `form_webhook_queues` | Durable outbound webhook queue |
| `FormApiToken` | `form_api_tokens` | API token for REST access |
| `FormAuditLog` | `form_audit_logs` | Every action on form/submission |
| `FormVersion` | `form_versions` | Published snapshot of form schema |

### 08 — Analytics v2 (5 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `AnalyticsDashboard` | `analytics_dashboards` | Named dashboard |
| `AnalyticsDashboardItem` | `analytics_dashboard_items` | Widget placed on dashboard |
| `AnalyticsScheduledReport` | `analytics_scheduled_reports` | Scheduled PDF/Excel delivery |
| `AnalyticsDataAlert` | `analytics_data_alerts` | Threshold alert on a metric |
| `AnalyticsSavedFilter` | `analytics_saved_filters` | Reusable filter preset |

### 09 — Workflows v2 (7 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `WorkflowRun` | `workflow_runs` | Execution instance of a workflow |
| `WorkflowRunStep` | `workflow_run_steps` | Per-node step within a run |
| `WorkflowTriggerLog` | `workflow_trigger_logs` | Raw trigger events received |
| `WorkflowTemplate` | `workflow_templates` | Pre-built workflow blueprint |
| `WorkflowApprovalRequest` | `workflow_approval_requests` | Pending approval from a run |
| `WorkflowWebhookEndpoint` | `workflow_webhook_endpoints` | Inbound webhook trigger URL |
| `WorkflowIntegration` | `workflow_integrations` | Encrypted credential for 3rd-party |

### 10 — Documents v2 (7 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `DocSpace` | `doc_spaces` | Workspace/team space |
| `DocVersion` | `doc_versions` | Point-in-time snapshot of document |
| `DocComment` | `doc_comments` | Inline or margin comment |
| `DocFavorite` | `doc_favorites` | User-starred document |
| `DocPermission` | `doc_permissions` | Per-user/team ACL entry |
| `DocLink` | `doc_links` | Bi-directional document link |
| `DocCollaborator` | `doc_collaborators` | Active real-time collaborator session |

### 11 — Chat v2 (10 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `ChatMessageAttachment` | `chat_message_attachments` | File attached to a message |
| `ChatReaction` | `chat_reactions` | Emoji reaction on a message |
| `ChatUserStatus` | `chat_user_statuses` | Custom user presence status |
| `ChatBookmark` | `chat_bookmarks` | Bookmarked message |
| `ChatScheduledMessage` | `chat_scheduled_messages` | Message queued for future send |
| `ChatIncomingWebhook` | `chat_incoming_webhooks` | Bot/integration post URL |
| `ChatBotIntegration` | `chat_bot_integrations` | Bot app config |
| `ChatCall` | `chat_calls` | Voice/video call record |

### 12 — Platform Features (11 new models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `CustomFieldDefinition` | `custom_field_definitions` | Dynamic field definition per entity type |
| `CustomFieldValue` | `custom_field_values` | EAV value store |
| `Role` | `roles` | Named permission role |
| `RolePermission` | `role_permissions` | Module×action grant per role |
| `UserRole` | `user_roles` | User→role assignment |
| `AuditLog` | `audit_logs` | Append-only cross-module audit trail |
| `Notification` | `notifications` | User notification record |
| `NotificationPreference` | `notification_preferences` | Per-user per-channel opt-in/out |
| `ApiToken` | `api_tokens` | SHA-256 hashed REST API keys |
| `WebhookSubscription` | `webhook_subscriptions` | Outbound webhook subscription |
| `WebhookDelivery` | `webhook_deliveries` | Per-event delivery attempt log |
| `SsoConfig` | `sso_configs` | SAML/OIDC SSO provider config |
| `MfaConfig` | `mfa_configs` | TOTP/WebAuthn factor per user |
| `Session` | `sessions` | Explicit session management |

---

## All New Enums — Master List

### CRM v2 Enums
```
CrmAccountType         B2B, B2C, PARTNER, VENDOR, RESELLER
CrmContactStatus       ACTIVE, INACTIVE, UNSUBSCRIBED, BOUNCED
CrmDealStatus          OPEN, WON, LOST, ABANDONED
CrmActivityType        CALL, MEETING, EMAIL, TASK, DEADLINE, LUNCH, DEMO
CrmSequenceStepType    EMAIL, WAIT, TASK, SMS, LINKEDIN, WEBHOOK
CrmLeadScoreField      EMAIL_OPENED, LINK_CLICKED, FORM_SUBMITTED, PAGE_VISIT, ...
CrmEmailProvider       GMAIL, OUTLOOK, IMAP_SMTP
CrmQuoteStatus         DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED
```

### Projects v2 Enums
```
ProjectMethodology     SCRUM, KANBAN, WATERFALL, HYBRID, NONE
ProjectHealth          ON_TRACK, AT_RISK, OFF_TRACK
ProjectStatus          DRAFT, PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED
TaskDependencyType     FINISH_TO_START, START_TO_START, FINISH_TO_FINISH, START_TO_FINISH
TaskPriority           CRITICAL, HIGH, MEDIUM, LOW, NONE
TaskStatusType         NOT_STARTED, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED
RiskProbability        VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH
RiskImpact             NEGLIGIBLE, MINOR, MODERATE, MAJOR, CRITICAL
CustomFieldType        TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, CHECKBOX, FORMULA
```

### HR v2 Enums
```
HrEmployeeStatus       PROBATION, ACTIVE, ON_LEAVE, SUSPENDED, RESIGNED, TERMINATED, RETIRED
HrGender               MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
HrBloodGroup           A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG
HrShiftType            FIXED, FLEXIBLE, ROTATIONAL, SPLIT
HrLeaveAccrualType     MONTHLY, QUARTERLY, YEARLY, ON_HIRE
HrLeaveStatus          PENDING, APPROVED, REJECTED, CANCELLED, WITHDRAWN
HrPayrollStatus        DRAFT, PROCESSING, PROCESSED, APPROVED, PAID, CANCELLED
HrGoalStatus           DRAFT, ACTIVE, COMPLETED, CANCELLED
HrPerformanceStatus    DRAFT, IN_PROGRESS, SUBMITTED, REVIEWED, CLOSED
HrJobStatus            DRAFT, PUBLISHED, PAUSED, CLOSED, FILLED
HrApplicationStatus    NEW, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED, WITHDRAWN
HrDocumentType         OFFER_LETTER, CONTRACT, ID_PROOF, EDUCATION, CERTIFICATE, OTHER
HrMaritalStatus        SINGLE, MARRIED, DIVORCED, WIDOWED
```

### Help Desk v2 Enums
```
HdTicketStatus         NEW, OPEN, PENDING, ON_HOLD, RESOLVED, CLOSED
HdTicketPriority       CRITICAL, HIGH, MEDIUM, LOW
HdTicketSource         EMAIL, WEB_FORM, CHAT, PHONE, API, PORTAL
HdSlaStatus            OK, WARNING, BREACHED
HdSatisfactionRating   VERY_SATISFIED, SATISFIED, NEUTRAL, UNSATISFIED, VERY_UNSATISFIED
HdAutomationEvent      TICKET_CREATED, TICKET_UPDATED, REPLY_ADDED, SLA_BREACHED, ...
HdEmailProvider        IMAP_SMTP, GMAIL, OUTLOOK, SENDGRID_INBOUND
```

### Accounting v2 Enums
```
AccAccountType         ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
AccAccountSubType      CURRENT_ASSET, FIXED_ASSET, CURRENT_LIABILITY, LONG_TERM_LIABILITY, ...
AccJournalStatus       DRAFT, POSTED, LOCKED, REVERSED
AccInvoiceStatus       DRAFT, SENT, PARTIAL, PAID, OVERDUE, VOID
AccPaymentMethod       CASH, BANK_TRANSFER, CHEQUE, CARD, UPI, WALLET
AccBankAccountType     CURRENT, SAVINGS, CREDIT, LOAN
AccTaxType             GST, VAT, SALES_TAX, NONE
AccAssetStatus         ACTIVE, FULLY_DEPRECIATED, DISPOSED, REVALUED
```

### Inventory v2 Enums
```
InvMovementType        PURCHASE, SALE, TRANSFER, ADJUSTMENT, RETURN, PRODUCTION_IN, PRODUCTION_OUT
InvLocationType        WAREHOUSE, ZONE, AISLE, RACK, BIN
InvBarcodeType         CODE128, CODE39, EAN13, EAN8, QR, DATAMATRIX
InvUnitOfMeasure       PCS, KG, LTR, MTR, BOX, PALLET, SET, PAIR
InvProductionStatus    DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
```

### Forms v2 Enums
```
FormStatus             DRAFT, PUBLISHED, CLOSED, ARCHIVED
FormApprovalStatus     PENDING, APPROVED, REJECTED, WITHDRAWN
FormWebhookStatus      PENDING, SUCCESS, FAILED, EXHAUSTED
FormFieldType          TEXT, TEXTAREA, EMAIL, PHONE, NUMBER, DATE, TIME, DATETIME,
                       SELECT, MULTISELECT, CHECKBOX, RADIO, FILE, SIGNATURE,
                       RATING, SLIDER, MATRIX, RICHTEXT, HEADING, PARAGRAPH,
                       DIVIDER, IMAGE, EMBED, DB_SELECT
```

### Analytics v2 Enums
```
AnalyticsChartType     BAR, LINE, AREA, PIE, DONUT, SCATTER, FUNNEL, GAUGE, TABLE, NUMBER
AnalyticsAlertOperator GT, LT, GTE, LTE, EQ, NEQ, PERCENT_CHANGE_UP, PERCENT_CHANGE_DOWN
AnalyticsReportFormat  PDF, XLSX, CSV
```

### Workflows v2 Enums
```
WorkflowNodeType       TRIGGER_EVENT, TRIGGER_SCHEDULE, TRIGGER_WEBHOOK, TRIGGER_MANUAL,
                       ACTION_EMAIL, ACTION_CREATE_RECORD, ACTION_UPDATE_RECORD,
                       ACTION_HTTP, ACTION_NOTIFY, ACTION_ASSIGN, ACTION_DELAY,
                       CONDITION, LOOP, APPROVAL, TRANSFORM, LOOKUP, SWITCH
WorkflowRunStatus      QUEUED, RUNNING, WAITING, COMPLETED, FAILED, CANCELLED
WorkflowApprovalStatus PENDING, APPROVED, REJECTED, TIMED_OUT
```

### Documents v2 Enums
```
DocPermissionLevel     VIEW, COMMENT, EDIT, ADMIN
DocCommentStatus       OPEN, RESOLVED
```

### Chat v2 Enums
```
ChatChannelType        PUBLIC, PRIVATE, DIRECT, GROUP
ChatCallStatus         RINGING, ACTIVE, ENDED, MISSED, DECLINED
ChatCallType           AUDIO, VIDEO
```

### Platform Features Enums
```
CustomFieldEntityType  CONTACT, DEAL, TASK, TICKET, EMPLOYEE, INVOICE, PRODUCT
CustomFieldType        TEXT, NUMBER, DATE, DATETIME, BOOLEAN, SELECT, MULTI_SELECT,
                       URL, EMAIL, PHONE, CURRENCY, FORMULA, USER, RELATION
AuditAction            CREATE, UPDATE, DELETE, VIEW, EXPORT, LOGIN, LOGOUT, ...
NotificationChannel    IN_APP, EMAIL, PUSH, SLACK, WEBHOOK
SsoProtocol            SAML, OIDC
MfaType                TOTP, WEBAUTHN, SMS
```

---

## New npm Packages Required

### Runtime Dependencies (add to `apps/web/package.json`)

| Package | Version | Used By |
|---------|---------|---------|
| `@tiptap/core` | `^2.x` | Documents v2 (block editor) |
| `@tiptap/react` | `^2.x` | Documents v2 |
| `@tiptap/starter-kit` | `^2.x` | Documents v2 |
| `@tiptap/extension-*` | `^2.x` | Documents v2 (tasks, mentions, math, etc.) |
| `yjs` | `^13.x` | Documents v2 (real-time CRDT) |
| `y-websocket` | `^1.x` | Documents v2 (WS sync) |
| `@hocuspocus/server` | `^2.x` | Documents v2 (collab server) |
| `socket.io` | `^4.x` | Chat v2 (real-time) |
| `socket.io-client` | `^4.x` | Chat v2 (client) |
| `@socket.io/redis-adapter` | `^8.x` | Chat v2 (horizontal scaling) |
| `speakeasy` | `^2.x` | Platform / MFA TOTP |
| `@simplewebauthn/server` | `^9.x` | Platform / WebAuthn |
| `@simplewebauthn/browser` | `^9.x` | Platform / WebAuthn |
| `passport-saml` | `^3.x` | Platform / SSO SAML |
| `openid-client` | `^5.x` | Platform / SSO OIDC |
| `qrcode` | `^1.x` | Forms v2 (QR generation), Inventory v2 |
| `jimp` | `^0.x` | Inventory v2 (barcode image) |
| `canvas` | `^2.x` | Inventory v2 (barcode rendering) |
| `jsbarcode` | `^3.x` | Inventory v2 |
| `sharp` | `^0.x` | Chat v2 (thumbnail generation) |
| `puppeteer-core` | `^21.x` | CRM v2 / Accounting v2 / HR v2 (PDF) |
| `@sparticuz/chromium` | `^x` | Puppeteer headless Chrome |
| `mustache` | `^4.x` | Forms v2 (label templates) |
| `fuse.js` | `^7.x` | Accounting v2 (fuzzy bank match) |
| `vm2` | `^3.x` | Workflows v2 (JS sandbox) |
| `diff-match-patch` | `^1.x` | Documents v2 (version diff) |
| `rrule` | `^2.x` | Projects v2 (task recurrence) |
| `@googleapis/gmail` | `^x` | CRM v2 (Gmail sync) |
| `@microsoft/microsoft-graph-client` | `^3.x` | CRM v2 (Outlook sync) |
| `imapflow` | `^1.x` | CRM v2 / Help Desk v2 (IMAP) |
| `nodemailer` | `^6.x` | (already installed) |
| `imap` | `^0.x` | Help Desk v2 (email inbox) |
| `mailparser` | `^3.x` | Help Desk v2 (parse inbound) |
| `xlsx` | `^0.x` | Analytics v2 (Excel export) |
| `jspdf` | `^2.x` | Analytics v2 (PDF charts) |
| `node-cron` | `^3.x` | Various workers |
| `@aws-sdk/client-s3` | `^3.x` | (MinIO — already configured) |
| `ioredis` | `^5.x` | (already installed) |

### Dev Dependencies

| Package | Version | Used By |
|---------|---------|---------|
| `@types/speakeasy` | latest | Platform MFA |
| `@types/passport-saml` | latest | Platform SSO |
| `@types/qrcode` | latest | Forms/Inventory |
| `@types/nodemailer` | latest | (may already exist) |
| `@types/mailparser` | latest | Help Desk v2 |

---

## New Environment Variables Required

Add these to `apps/web/.env.local`:

```bash
# ─── CRM v2 — Gmail OAuth ───────────────────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/crm/email/google/callback

# ─── CRM v2 — Microsoft Graph OAuth ────────────────────────────────────────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common

# ─── Help Desk v2 — Inbound Email ───────────────────────────────────────────
HD_IMAP_CHECK_INTERVAL_SECS=60

# ─── Accounting v2 — GST ────────────────────────────────────────────────────
GST_REGISTERED=true
GST_NUMBER=
ORGANIZATION_STATE_CODE=              # 2-digit state code for CGST/SGST vs IGST

# ─── Platform — SSO ─────────────────────────────────────────────────────────
SAML_IDP_METADATA_URL=
OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=

# ─── Platform — MFA ─────────────────────────────────────────────────────────
MFA_ISSUER_NAME=ZenFlow
TOTP_SECRET_ENCRYPTION_KEY=          # 32-byte hex, for encrypting TOTP secrets at rest

# ─── Platform — API Rate Limiting ───────────────────────────────────────────
API_RATE_LIMIT_PER_MINUTE=60

# ─── Workflows — Encryption ─────────────────────────────────────────────────
WORKFLOW_CREDENTIAL_ENCRYPTION_KEY=  # 32-byte hex AES key

# ─── Chat — Socket.io ───────────────────────────────────────────────────────
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
SOCKET_PORT=3001

# ─── Documents — Collaboration ──────────────────────────────────────────────
HOCUSPOCUS_PORT=3002
HOCUSPOCUS_SECRET=                   # JWT secret for Hocuspocus auth

# ─── Email / Workers ────────────────────────────────────────────────────────
WORKER_CONCURRENCY=5                 # BullMQ worker concurrency
```

---

## BullMQ Workers — Master List

All workers live in `apps/workers/src/` as separate entry files.

| Worker File | Queue Name | Trigger | Module |
|------------|-----------|---------|--------|
| `crm-sequence.ts` | `crm:sequence` | Sequence step schedules | CRM v2 |
| `crm-email-sync.ts` | `crm:email-sync` | Every 15 min (cron) | CRM v2 |
| `crm-deal-rotting.ts` | `crm:deal-rotting` | Daily cron | CRM v2 |
| `crm-lead-score.ts` | `crm:lead-score` | On event | CRM v2 |
| `crm-quote-pdf.ts` | `crm:quote-pdf` | On quote send | CRM v2 |
| `task-recurrence.ts` | `projects:recurrence` | Daily cron | Projects v2 |
| `project-burndown.ts` | `projects:burndown` | Daily cron | Projects v2 |
| `leave-accrual.ts` | `hr:leave-accrual` | Monthly cron | HR v2 |
| `payroll-compute.ts` | `hr:payroll` | On period process | HR v2 |
| `payslip-pdf.ts` | `hr:payslip-pdf` | After payroll | HR v2 |
| `attendance-daily.ts` | `hr:attendance-daily` | Daily cron | HR v2 |
| `probation-reminder.ts` | `hr:probation` | Daily cron | HR v2 |
| `hd-email-inbox.ts` | `hd:email-inbox` | Every 60s | Help Desk v2 |
| `hd-sla-timer.ts` | `hd:sla-timer` | Every 5 min | Help Desk v2 |
| `hd-csat-survey.ts` | `hd:csat` | On ticket resolve | Help Desk v2 |
| `hd-auto-close.ts` | `hd:auto-close` | Daily cron | Help Desk v2 |
| `hd-automation.ts` | `hd:automation` | On ticket events | Help Desk v2 |
| `acc-recurring-invoice.ts` | `acc:recurring` | Daily cron | Accounting v2 |
| `acc-depreciation.ts` | `acc:depreciation` | Monthly cron | Accounting v2 |
| `acc-bank-import.ts` | `acc:bank-import` | On CSV upload | Accounting v2 |
| `acc-payment-reminder.ts` | `acc:payment-reminder` | Daily cron | Accounting v2 |
| `inv-reorder-alert.ts` | `inv:reorder` | Daily cron | Inventory v2 |
| `inv-expiry-alert.ts` | `inv:expiry` | Daily cron | Inventory v2 |
| `inv-barcode-pdf.ts` | `inv:barcode-pdf` | On request | Inventory v2 |
| `forms-webhook.ts` | `forms:webhook` | On submission | Forms v2 |
| `forms-approval-notify.ts` | `forms:approval` | On step action | Forms v2 |
| `analytics-scheduled.ts` | `analytics:scheduled` | Cron per config | Analytics v2 |
| `analytics-alert.ts` | `analytics:alert` | Every 15 min | Analytics v2 |
| `workflow-executor.ts` | `workflows:execute` | On trigger | Workflows v2 |
| `workflow-delay.ts` | `workflows:delay` | On delay node | Workflows v2 |
| `workflow-approval.ts` | `workflows:approval` | On approval timeout | Workflows v2 |
| `docs-export.ts` | `docs:export` | On export request | Documents v2 |
| `chat-scheduled.ts` | `chat:scheduled` | On schedule | Chat v2 |
| `chat-retention.ts` | `chat:retention` | Weekly cron | Chat v2 |
| `platform-webhook.ts` | `platform:webhook` | On any entity event | Platform |
| `platform-notification.ts` | `platform:notification` | On notification create | Platform |

---

## Implementation Phase Plan

### Phase 2 — Foundation & High-ROI Modules (Months 1–3)

**Priority 1 (Month 1): Platform Features + Forms v2**
- Platform features first: custom fields, RBAC v2, audit log, notifications v2, API platform
- These unlock capabilities that all other modules depend on
- Forms v2: brings ZenFlow to feature parity with SchoolERP consent forms (conditional logic, approval workflow, webhooks)

**Priority 2 (Month 2): CRM v2**
- Pipeline management, account hierarchy, email sync
- Sequences (drip campaigns), lead scoring
- Quotes with PDF generation

**Priority 3 (Month 3): Projects v2 + HR v2 (partial)**
- Task dependencies, time logging, custom statuses
- Gantt view (critical path), burndown charts
- HR: payroll engine, leave management

### Phase 3 — Core Business Modules (Months 4–6)

**Month 4:** Accounting v2
- Chart of accounts, double-entry journal, invoice auto-JE
- Bank reconciliation, GST reports

**Month 5:** Help Desk v2
- SLA engine, email inbox, routing rules
- CSAT surveys, knowledge base versioning

**Month 6:** Inventory v2
- Multi-warehouse, FIFO costing, serial/lot tracking
- BOM + production orders, physical count

### Phase 4 — Intelligence & Automation (Months 7–9)

**Month 7:** Workflows v2
- 20-node type execution engine
- Internal ZenFlow event bus integration
- Approval nodes, JavaScript sandbox

**Month 8:** Analytics v2
- Multi-source query builder
- Dashboard designer, scheduled reports
- Data alerts

**Month 9:** HR v2 (complete)
- Performance reviews, OKRs
- Recruitment pipeline
- Onboarding checklists

### Phase 5 — Collaboration & Experience (Months 10–12)

**Month 10:** Documents v2
- Tiptap block editor, real-time Yjs collaboration
- Version history, inline comments, PDF export

**Month 11:** Chat v2
- Socket.io real-time, threads, reactions
- Scheduled messages, incoming webhooks, file thumbnails

**Month 12:** Polish & Launch
- Mobile responsive audit
- Performance optimization (Redis caching, query optimization)
- Full test coverage
- Marketing site, onboarding flow

---

## Document Index

| # | Document | Lines | Key Highlights |
|---|----------|-------|----------------|
| 1 | [01_CRM_v2.md](01_CRM_v2.md) | 1,579 | 22 models, email sync, sequences, lead scoring, quote PDF |
| 2 | [02_PROJECTS_v2.md](02_PROJECTS_v2.md) | 1,497 | 18 models, CPM critical path, Gantt, time logging, RRULE |
| 3 | [03_HR_v2.md](03_HR_v2.md) | 1,905 | 24 models, full Indian payroll (PF/ESI/PT/TDS), leave accrual |
| 4 | [04_HELPDESK_v2.md](04_HELPDESK_v2.md) | 1,762 | 15 models, business-hours SLA, email-to-ticket, round-robin |
| 5 | [05_ACCOUNTING_v2.md](05_ACCOUNTING_v2.md) | 1,963 | 18 models, double-entry, bank reconciliation, GST, depreciation |
| 6 | [06_INVENTORY_v2.md](06_INVENTORY_v2.md) | 2,034 | 19 models, FIFO costing, BOM explosion, physical count, ABC |
| 7 | [07_FORMS_v2.md](07_FORMS_v2.md) | 1,128 | 8 models, 24-field types, conditional logic, approval workflow |
| 8 | [08_ANALYTICS_v2.md](08_ANALYTICS_v2.md) | 1,088 | 5 models, 8 data sources, query builder, scheduled reports |
| 9 | [09_WORKFLOWS_v2.md](09_WORKFLOWS_v2.md) | 1,520 | 7 models, 20 node types, JS sandbox, AES-256 credentials |
| 10 | [10_DOCUMENTS_v2.md](10_DOCUMENTS_v2.md) | 1,182 | 7 models, Tiptap, Yjs real-time, version diff, Puppeteer PDF |
| 11 | [11_CHAT_v2.md](11_CHAT_v2.md) | 1,108 | 10 models, Socket.io, Redis pub/sub, threads, file thumbnails |
| 12 | [12_PLATFORM_FEATURES.md](12_PLATFORM_FEATURES.md) | 1,325 | 11 models, RBAC, audit log, SSO (SAML/OIDC), TOTP/WebAuthn |
| **TOTAL** | | **~16,200** | |

---

*This master document is auto-generated from all 12 implementation spec agents. For full Prisma schema blocks, tRPC procedures, business logic code, and file trees — open the individual module documents above.*
