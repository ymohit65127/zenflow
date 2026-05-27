# ZENFLOW — MASTER PRODUCT PLAN v1.0
**"Everything Flows. Nothing is Basic."**

> Authored: 2026-05-27  
> Status: Living Document — add to this every sprint  
> Goal: Beat Zoho, HubSpot, Salesforce, Monday.com, Jira, Notion, Zendesk, QuickBooks, Slack — all in one platform

---

## EXECUTIVE SUMMARY

ZenFlow v1 (current) is a **functional skeleton** — all 13 modules exist, CRUD works, auth works, zero TypeScript errors. But when compared to the SchoolERP Consent Forms module (built with deep domain research), it becomes clear that ZenFlow is at 15–20% depth on every module.

The difference between basic software and world-class software is not the technology stack — it is **domain depth, automation intelligence, and cross-module data flow.**

This document defines the complete upgrade path: every feature, every improvement, every system that must be built to make ZenFlow a platform that no competitor can match.

**Competitive Targets:**
| Module | Current Best | ZenFlow Must Beat |
|--------|-------------|-------------------|
| CRM | Salesforce, HubSpot, Zoho CRM | All three |
| Projects | Jira, Monday.com, Asana, Linear | All four |
| HR | BambooHR, Workday, Darwinbox | All three |
| Help Desk | Zendesk, Freshdesk, Intercom | All three |
| Accounting | QuickBooks, Xero, Zoho Books | All three |
| Inventory | Cin7, TradeGecko, Zoho Inventory | All three |
| Forms | Typeform, JotForm, Zoho Forms | All three |
| Analytics | Metabase, Tableau, Looker | All three |
| Workflows | Zapier, Make (Integromat), n8n | All three |
| Documents | Notion, Confluence, Coda | All three |
| Chat | Slack, MS Teams | Both |

---

## SECTION 1 — THE FIVE LAWS OF ENTERPRISE SOFTWARE

Before any feature is designed, these laws govern every decision:

### Law 1: Everything Talks to Everything
A deal in CRM auto-creates an invoice in Accounting. A leave request in HR blocks task assignment in Projects. An inventory stock alert fires a workflow. No module is an island.

### Law 2: Every Action Has a Paper Trail
Every create, update, delete, approval, login, export — logged with who, what, when, from where. Immutable audit trail. Compliance is not an afterthought.

### Law 3: Users Never Do Repetitive Work
Anything a user does more than once should be automatable. Workflow engine triggers on every system event. Custom email templates. Canned responses. Bulk actions everywhere.

### Law 4: The UI Adapts to the User
Custom fields on every record. Custom views (list, kanban, timeline, calendar, table). Custom dashboards. Saved filters. Keyboard shortcuts. Every power user gets their own workspace.

### Law 5: The Platform Grows Without Code
Custom modules. Custom fields. Custom workflows. Custom forms. Custom reports. An admin should be able to build new functionality without a developer.

---

## SECTION 2 — MODULE 1: CRM (Complete Upgrade)

### 2.1 What's Missing Today
Current ZenFlow CRM: basic contacts, leads, deals, activities list pages. No pipeline. No email integration. No scoring. No automation.

### 2.2 Full Feature Set — CRM v2

#### A) Pipeline & Deal Management
- [ ] **Kanban Pipeline View** — Drag deals between stages. Multiple pipelines (Sales, Renewal, Enterprise, SMB). Custom stages per pipeline. Stage probability % for forecasting.
- [ ] **Deal Rotting** — Deals inactive for N days turn orange → red. Configurable per pipeline. Email alert to owner.
- [ ] **Deal Cloning** — Duplicate a deal with all linked contacts and activities.
- [ ] **Deal Products** — Link product catalog items to a deal. Auto-calculate deal value from line items.
- [ ] **Quotes & Proposals** — Generate PDF quote from deal products. Custom quote template. Send via email. Track quote opens (email tracking pixel).
- [ ] **Win/Loss Reasons** — Required field when marking won/lost. Win/loss analysis report.
- [ ] **Multiple Currencies** — Deal amount in any currency. Auto-convert to org default for reporting.
- [ ] **Sales Forecasting** — Weighted forecast (amount × probability). Period-over-period comparison. Rep-level forecast vs. quota.
- [ ] **Commission Tracking** — Define commission rules per pipeline. Auto-calculate on deal close.

#### B) Contact & Lead Intelligence
- [ ] **Lead Scoring** — Score leads based on profile (job title, company size) + behavior (email opens, form fills, page visits). Threshold alert when score crosses cutoff.
- [ ] **Contact Timeline** — Every email, call, note, meeting, deal, invoice — chronological view on every contact.
- [ ] **Contact Merge** — Detect and merge duplicate contacts. Keep all history.
- [ ] **Company / Account Hierarchy** — Parent company → subsidiaries. Rolled-up deal value at parent level.
- [ ] **Relationship Mapping** — Link contacts to each other (reports to, influences, champion, blocker).
- [ ] **Social Enrichment** — Auto-pull LinkedIn, Twitter profile data from email address.
- [ ] **Contact Import** — CSV/Excel with column mapping wizard. Duplicate detection on import. Import history + rollback.
- [ ] **Data Enrichment API** — Clearbit/Hunter.io integration. Auto-fill missing contact fields.

#### C) Email Integration
- [ ] **Two-Way Email Sync** — Connect Gmail/Outlook to CRM. Emails auto-logged to contact timeline. Reply from inside CRM.
- [ ] **Email Sequences / Cadences** — Multi-step automated outreach (Email day 1 → Wait 2 days → Email day 3 → Task: Call day 5). Per-lead enrollment. Pause/resume.
- [ ] **Email Templates** — Rich HTML templates with `{{contact.name}}` placeholders. Team template library. Personal templates.
- [ ] **Email Tracking** — Open tracking. Link click tracking. Notification when contact opens email.
- [ ] **Meeting Scheduler** — Share booking link. Contact picks a slot from your calendar. Auto-creates meeting activity. Google/Outlook calendar sync.

#### D) Communication Hub
- [ ] **Call Logging** — Log calls with duration, notes, outcome. Integration with Twilio/Exotel for click-to-call. Call recording storage.
- [ ] **WhatsApp Integration** — Send/receive WhatsApp messages on contact timeline. Bulk WhatsApp campaigns.
- [ ] **SMS Integration** — Twilio SMS from contact record.
- [ ] **Web-to-Lead Forms** — Embeddable forms → auto-create leads in CRM. UTM parameter capture (source, medium, campaign, term, content).

#### E) Automation & Intelligence
- [ ] **Lead Assignment Rules** — Auto-assign based on: geography, company size, industry, source, round-robin. Reassign if rep is on leave (HR integration).
- [ ] **Territory Management** — Define territories by geography/industry. Restrict reps to their territory.
- [ ] **SLA on Leads** — First contact within N hours rule. Escalation if breached.
- [ ] **Workflow Triggers** — Deal stage changed, lead score threshold, contact created, deal idle N days, quota reached.
- [ ] **AI Next Best Action** — "This lead has opened 3 emails but not replied — suggest: call now" recommendations.

#### F) Reporting & Analytics
- [ ] Pipeline funnel report (conversion rate per stage)
- [ ] Sales velocity report (average deal age, deal size, close rate, deals per rep)
- [ ] Rep performance leaderboard
- [ ] Revenue by source, industry, geography, product
- [ ] Activity report (calls made, emails sent, meetings held per rep)
- [ ] Quota attainment dashboard
- [ ] Churn risk report

---

## SECTION 3 — MODULE 2: PROJECTS (Complete Upgrade)

### 3.1 Full Feature Set — Projects v2

#### A) Multiple Views — Same Data, Different Perspectives
- [ ] **Board/Kanban View** — Drag-and-drop tasks between status columns. Swimlanes (by assignee, priority, epic). WIP limits per column.
- [ ] **List View** — Sortable columns. Inline editing. Bulk select + bulk actions. Group by any field.
- [ ] **Gantt/Timeline View** — Horizontal bar chart. Task dependencies (arrows). Drag to reschedule. Critical path highlighted. Resource row per person.
- [ ] **Calendar View** — Tasks on calendar by due date. Drag to reschedule. Month/week/day views.
- [ ] **Workload View** — Per-person view of all assigned tasks by day/week. Capacity bar (green/yellow/red). Drag to rebalance.
- [ ] **Table/Spreadsheet View** — All tasks in a flat table like a spreadsheet. Inline edit any cell. Custom columns.
- [ ] **Mind Map View** — Hierarchical task breakdown as a visual mind map.

#### B) Task Depth
- [ ] **Subtasks** — Unlimited nesting depth. Progress rolled up from subtasks.
- [ ] **Task Dependencies** — Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish. Dependency lock (can't start until predecessor done). Cascade date shifts.
- [ ] **Task Checklists** — Multiple checklists per task. Progress bar.
- [ ] **Task Watchers** — Subscribe to a task. Get notifications on all changes.
- [ ] **Time Tracking** — Manual time entry. Built-in stopwatch timer. Per-user time logs per task. Billable/non-billable toggle. Total time on task/project.
- [ ] **Task Custom Fields** — Text, number, date, select, multi-select, person, URL, formula fields on tasks.
- [ ] **Recurring Tasks** — Repeat daily/weekly/monthly/custom. Auto-create next instance on completion.
- [ ] **Task Templates** — Save a task (with subtasks, checklists, custom fields) as a reusable template.
- [ ] **Task Approval Workflow** — Mark task as "needs review." Reviewer approves/rejects with comments.

#### C) Project-Level Features
- [ ] **Project Templates** — Clone an entire project (phases, tasks, milestones) as a template.
- [ ] **Milestones** — Key dates that appear on the Gantt. Color-coded. Progress toward milestone.
- [ ] **Project Budget** — Set budget. Track actual spend from time logs + expenses. Budget burn chart.
- [ ] **Project Risk Register** — Log risks with probability, impact, mitigation plan. Risk matrix visualization.
- [ ] **Project Status Reports** — Auto-generated weekly/monthly PDF report. Customizable sections.
- [ ] **Client Portal** — Share a read-only project view with external clients. They can comment but not edit.
- [ ] **Project Tags** — Tag projects by client, type, technology, etc.

#### D) Agile / Scrum Support
- [ ] **Epic → Story → Task hierarchy**
- [ ] **Story Points** — Estimate in points. Velocity tracking across sprints.
- [ ] **Sprint Planning Board** — Drag tasks from backlog to sprint.
- [ ] **Sprint Burndown Chart** — Daily remaining work vs. ideal line.
- [ ] **Sprint Velocity Chart** — Points completed per sprint. Trend line.
- [ ] **Backlog Grooming** — Prioritized backlog with drag-to-reorder.
- [ ] **Definition of Done** — Configurable per project.

#### E) Portfolio & Resource Management
- [ ] **Portfolio View** — See all projects in one view. Status, % complete, budget, timeline.
- [ ] **Resource Availability** — See every person's capacity across all projects.
- [ ] **Skills Matrix** — Tag team members with skills. Filter by skill when assigning.
- [ ] **Time-off Integration** — HR leave data blocks availability on project workload view.

---

## SECTION 4 — MODULE 3: HR (Complete Upgrade)

### 4.1 Full Feature Set — HR v2

#### A) Employee Management
- [ ] **Employee 360 Profile** — Personal info, emergency contacts, documents, skills, certifications, performance history, asset assignments, access logs — all in one view.
- [ ] **Organization Chart** — Interactive org chart. Click any node. Drag to restructure. Export as PNG/PDF.
- [ ] **Employee Self-Service Portal** — Employees view their own payslips, leave balance, attendance, apply for leave, raise helpdesk tickets, update personal info.
- [ ] **Custom Employee Fields** — Add any field to employee profile: blood group, LinkedIn URL, shirt size for swag — anything.
- [ ] **Document Vault** — Store contracts, offer letters, ID proofs, experience letters. Version controlled. Expiry alerts (passport, visa, certifications).
- [ ] **Employee Lifecycle** — Stages: Candidate → Onboarding → Active → On Leave → Notice Period → Alumni. History of stage transitions.

#### B) Onboarding / Offboarding Workflows
- [ ] **Onboarding Checklist** — Template checklist: IT setup, access provisioning, buddy assignment, training modules. Assigned to HR + new employee + manager + IT.
- [ ] **Offboarding Checklist** — Asset return, access revocation, knowledge transfer, exit interview, final settlement.
- [ ] **Pre-boarding** — Share documents, policies, welcome video with employee before joining date.
- [ ] **Probation Tracking** — Alert manager 2 weeks before probation end. Confirmation/extension/termination workflow.

#### C) Leave & Attendance
- [ ] **Leave Policy Engine** — Define policies with: accrual rules (monthly/yearly), carry-forward limits, encashment rules, negative balance allow/deny, gender-specific leaves (maternity/paternity).
- [ ] **Holiday Calendar** — Multiple calendars (regional). Assign calendar to employee group.
- [ ] **Leave Approval Workflow** — Multi-level approval. Delegate when approver is on leave. Auto-approve if not actioned within N days.
- [ ] **Comp-Off Management** — Work on holiday → earn comp-off. Expiry tracking.
- [ ] **Attendance Regularization** — Employee can submit attendance correction request. Manager approves.
- [ ] **Biometric/Geo-fence Integration** — API hooks for biometric devices. Geo-fence for field staff (GPS punch in/out).
- [ ] **Shift Management** — Multiple shifts. Rotating shifts. Night shift allowance.
- [ ] **Overtime Calculation** — Rules-based. Automatic overtime pay calculation.

#### D) Payroll
- [ ] **Payroll Engine** — CTC breakup: Basic, HRA, Special Allowance, PF, ESI, Professional Tax, TDS.
- [ ] **India-specific compliance** — PF (12%), ESI (3.25%+0.75%), PT per state slabs, TDS (Form 12B/16), Section 80C deductions.
- [ ] **Payslip Generation** — PDF payslip with company logo. Email to employee. Portal download.
- [ ] **Payroll Approval Workflow** — Draft → HR Review → Finance Approval → Processed.
- [ ] **Bank Transfer File** — Generate NEFT/RTGS transfer file for bulk salary disbursement.
- [ ] **Arrear Calculation** — Retrospective pay revision. Auto-calculate arrears.

#### E) Performance Management
- [ ] **Goal Setting (OKRs)** — Company OKRs → Team OKRs → Individual OKRs. Progress tracking. Check-in cadence.
- [ ] **360-Degree Feedback** — Peer reviews, manager reviews, self-assessment, subordinate reviews. Consolidated feedback report.
- [ ] **Performance Review Cycles** — Annual, semi-annual, quarterly. Calibration (bell-curve distribution). Rating scale configurable.
- [ ] **Performance Improvement Plan (PIP)** — Structured PIP with goals, timeline, check-ins. Escalation path.
- [ ] **Skills & Competency Matrix** — Define competencies per role. Gap analysis per employee.

#### F) Recruitment (ATS)
- [ ] **Job Requisition** — Manager raises requisition. HR approval. Budget check.
- [ ] **Job Posting** — Post to LinkedIn, Indeed, Naukri (via integration). Custom careers page embed.
- [ ] **Application Tracking** — Pipeline: Applied → Screened → Phone screen → Interview 1 → Interview 2 → Offer → Hired/Rejected.
- [ ] **Interview Scheduler** — Calendar integration. Panel coordination. Auto-confirmation emails.
- [ ] **Offer Letter Generation** — Template-based. Digital signature (DocuSign/eSign).
- [ ] **Background Verification** — Integration with BGV vendors (AuthBridge, Signzy).

---

## SECTION 5 — MODULE 4: HELP DESK (Complete Upgrade)

### 5.1 Full Feature Set — Help Desk v2

#### A) Multi-Channel Ticket Intake
- [ ] **Email-to-Ticket** — Dedicated support email (support@org.zenflow.app → creates ticket). Thread replies update ticket. Full email HTML rendered in ticket.
- [ ] **Web Chat Widget** — Embeddable JS widget for customer website. Proactive chat triggers ("You've been on this page for 3 minutes — need help?").
- [ ] **WhatsApp Integration** — WhatsApp Business API. Tickets from WhatsApp messages.
- [ ] **Social Media** — Twitter DM → ticket. Facebook Messenger → ticket.
- [ ] **Phone/IVR** — Twilio integration. Call recordings linked to tickets.
- [ ] **Customer Portal** — Branded self-service portal. Submit tickets, track status, access knowledge base.

#### B) SLA Management
- [ ] **SLA Policies** — Define multiple SLA policies by: ticket priority, ticket type, customer tier, product/service.
- [ ] **SLA Metrics** — First Response Time, First Resolution Time, Full Resolution Time.
- [ ] **SLA Escalation** — Automatic escalation at 50%, 75%, 100% of SLA time. Notify agent → supervisor → manager.
- [ ] **Business Hours** — Define working hours per timezone. SLA paused outside business hours. Holiday schedule.
- [ ] **SLA Breach Reporting** — % tickets breached. By agent, by team, by category.

#### C) Ticket Intelligence
- [ ] **AI Auto-Classification** — AI reads subject + body → suggests category, priority, assignee.
- [ ] **AI Auto-Response Suggestions** — Suggest canned response or knowledge base article before agent replies.
- [ ] **Sentiment Analysis** — Detect angry/frustrated customers. Escalate automatically.
- [ ] **Ticket Routing Rules** — Rule engine: if Subject contains "billing" → assign to Finance team. If company = Enterprise tier → assign to Senior Agent.
- [ ] **Round-Robin Assignment** — Distribute evenly among available agents.
- [ ] **Skill-Based Routing** — Route based on agent skills/language.
- [ ] **Chatbot / AI First Line** — Answer common questions before creating ticket. Deflect 40% of tickets.

#### D) Agent Productivity
- [ ] **Canned Responses / Macros** — Pre-written replies with placeholders. Personal + shared. Keyboard shortcut.
- [ ] **Ticket Merging** — Merge duplicate tickets. Keep history of both.
- [ ] **Parent-Child Tickets** — Break complex issues into child tickets. Parent resolved when all children resolved.
- [ ] **Ticket Splitting** — Split one ticket into multiple (different issues in one email).
- [ ] **Internal Notes** — Notes visible to agents only. @mention a colleague. Different styling from customer replies.
- [ ] **Reply Templates with Rich Text** — HTML email composer. Images, attachments, formatted text.
- [ ] **Custom Ticket Fields** — Product affected, affected version, severity, custom metadata.
- [ ] **Bulk Actions** — Select 50 tickets → bulk assign, bulk close, bulk add tag, bulk change priority.

#### E) Knowledge Base
- [ ] **Category Hierarchy** — Unlimited nesting. Drag-to-reorder.
- [ ] **Rich Content** — Full rich text editor. Images, videos, code blocks, callouts.
- [ ] **Article Versioning** — Every save creates a version. Compare diffs. Revert.
- [ ] **Article Feedback** — "Was this helpful?" Yes/No. Free-text feedback.
- [ ] **Article Analytics** — Views, helpful %, search terms that led to it, tickets avoided.
- [ ] **SEO-Friendly URLs** — `/help/billing/how-to-update-payment-method`
- [ ] **Article Templates** — How-to, troubleshooting, FAQ templates.
- [ ] **Draft/Published/Archived** — Workflow for article lifecycle.
- [ ] **Multi-language Articles** — Same article in 10+ languages.

#### F) CSAT & Analytics
- [ ] **CSAT Survey** — Auto-send after ticket closure. 1-5 star or emoji scale. Comment field.
- [ ] **NPS Survey** — Quarterly NPS. Segment by promoter/passive/detractor.
- [ ] **Agent Performance Dashboard** — CSAT per agent, tickets resolved/day, avg response time, SLA compliance %.
- [ ] **Team Dashboard** — Volume trends. First contact resolution rate. Backlog aging.
- [ ] **Customer Health Score** — Number of tickets × severity × CSAT → health indicator.

---

## SECTION 6 — MODULE 5: ACCOUNTING (Complete Upgrade)

### 6.1 Full Feature Set — Accounting v2

#### A) Core Accounting Engine
- [ ] **Double-Entry Bookkeeping** — Every transaction creates balanced journal entries. Debit = Credit enforced.
- [ ] **Full Chart of Accounts** — Assets, Liabilities, Equity, Revenue, Expenses — full GAAP hierarchy. Import standard CoA. Custom accounts.
- [ ] **Journal Entries** — Manual journal entries. Recurring journals. Reversing journals. Opening balance entries.
- [ ] **Bank Reconciliation** — Import bank statement (CSV/OFX/MT940). Auto-match transactions. Unmatch + rematch. Reconciliation report.
- [ ] **Bank Feeds** — Auto-import transactions via Open Banking API (Plaid, Finbox for India).

#### B) Invoicing & Billing
- [ ] **Invoice Templates** — Fully customizable HTML/PDF templates. Logo, colors, fonts, custom fields. Multiple templates per org.
- [ ] **Recurring Invoices** — Daily/weekly/monthly/custom. Auto-send. Auto-retry on payment failure.
- [ ] **Credit Notes** — Issue credit note against invoice. Apply to future invoices.
- [ ] **Proforma Invoices** — Draft invoice for approval before finalizing.
- [ ] **Retainer Invoices** — Pre-pay deposit tracked against future invoices.
- [ ] **Partial Payments** — Accept multiple payments against one invoice.
- [ ] **Advance Payments** — Record advance. Apply to future invoice.
- [ ] **Payment Reminders** — Automated: 3 days before due, on due date, 3/7/14/30 days overdue. Custom schedules.
- [ ] **Online Payment Links** — Stripe / Razorpay / PayU integration. Customer pays directly from invoice email.
- [ ] **E-Invoicing (India)** — GST e-invoice generation. IRN + QR code. Auto-submit to NIC portal.

#### C) Tax Management (India + Global)
- [ ] **GST** — CGST/SGST/IGST/CESS. HSN/SAC codes. GST invoice format. GSTR-1 / GSTR-3B export.
- [ ] **TDS** — TDS deduction at source. Section-wise rates. TDS certificate generation (Form 16A). 26AS reconciliation.
- [ ] **VAT / Sales Tax** — Multi-jurisdiction tax rules. Tax-inclusive/exclusive pricing.
- [ ] **Multi-currency** — 150+ currencies. Live exchange rates. Realized/unrealized forex gain-loss.

#### D) Expenses & Payables
- [ ] **Expense Claims** — Employees submit expense reports from mobile (photo receipt). Policy limits. Multi-level approval. Direct reimbursement to salary/bank.
- [ ] **Receipt OCR** — AI extracts vendor, amount, date from receipt photo.
- [ ] **Bills (Accounts Payable)** — Vendor bills. Match to purchase orders. 3-way matching (PO → GRN → Bill).
- [ ] **Payment Runs** — Select multiple bills. Generate payment. NEFT/RTGS file.
- [ ] **Aged Payables** — Outstanding bills by aging bucket (0–30, 31–60, 61–90, 90+).

#### E) Financial Reports
- [ ] **Profit & Loss** — By period, YTD, vs. budget, vs. last year. Drill-down.
- [ ] **Balance Sheet** — Point-in-time or comparative. Export.
- [ ] **Cash Flow Statement** — Operating/Investing/Financing activities.
- [ ] **Trial Balance** — Unadjusted/Adjusted. Export.
- [ ] **General Ledger** — Full transaction listing by account.
- [ ] **Accounts Receivable Aging** — By customer. Overdue highlight.
- [ ] **Accounts Payable Aging** — By vendor.
- [ ] **Cash Flow Forecast** — Projected cash position 30/60/90 days out.
- [ ] **Budget vs. Actuals** — Set budget per account/month. Variance report.

#### F) Fixed Assets
- [ ] **Asset Register** — Asset type, purchase date, cost, location, custodian.
- [ ] **Depreciation** — Straight-line, declining balance, sum-of-years. Automated monthly depreciation journals.
- [ ] **Asset Disposal** — Record disposal/sale. Gain/loss calculation.
- [ ] **Asset Audit** — QR code labels. Physical verification workflow.

---

## SECTION 7 — MODULE 6: INVENTORY (Complete Upgrade)

### 7.1 Full Feature Set — Inventory v2

#### A) Multi-Warehouse & Location
- [ ] **Multiple Warehouses** — Each with its own stock. Transfer between warehouses.
- [ ] **Zones / Aisles / Racks / Bins** — Granular location tracking inside warehouse.
- [ ] **Barcode / QR Scanning** — Generate and print labels. Scan to receive, pick, ship.
- [ ] **Warehouse Management System (WMS)** — Putaway rules. Pick paths optimization. Receiving bay management.

#### B) Advanced Tracking
- [ ] **Serial Number Tracking** — Each unit has unique serial. Track through entire lifecycle: purchase → sale → warranty.
- [ ] **Lot / Batch Tracking** — Group items by batch. FIFO enforcement.
- [ ] **Expiry Date Tracking** — Alerts before expiry. Expired stock reports.
- [ ] **Product Variants** — Size, color, material, voltage — generate variant matrix automatically.

#### C) Operations
- [ ] **Reorder Rules** — Min stock level → trigger automatic PO draft or alert. Safety stock buffer.
- [ ] **Stock Adjustment** — Positive/negative adjustment with reason codes. Audit trail.
- [ ] **Physical Inventory Count** — Freeze stock. Count sheets. Variance report. Auto-adjust.
- [ ] **Stock Transfer** — Move stock between locations. In-transit tracking.
- [ ] **Return Merchandise Authorization (RMA)** — Customer return → inspection → restock or dispose.
- [ ] **Consignment Inventory** — Track inventory owned by vendor but stored at your location.

#### D) Manufacturing / Assembly
- [ ] **Bill of Materials (BOM)** — Define components for a finished product. Multi-level BOM.
- [ ] **Production Orders** — Assemble finished goods from components. Consume raw material. Post WIP.
- [ ] **Work Centers** — Machines/stations with capacity. Scheduling.
- [ ] **Scrap / Wastage** — Record and cost.

#### E) Valuation & Analytics
- [ ] **FIFO / LIFO / Weighted Average** — Choose method per product or org-wide.
- [ ] **Landed Costs** — Add shipping, insurance, duties to purchase cost.
- [ ] **ABC Analysis** — Classify products A (high value), B (medium), C (low). Optimize stock levels.
- [ ] **Slow-Moving / Dead Stock Report**
- [ ] **Inventory Valuation Report** — Total stock value at cost.
- [ ] **Demand Forecasting** — ML-based: predict demand for next N periods based on historical sales.

---

## SECTION 8 — MODULE 7: FORMS (Complete Upgrade)

*This module must match and exceed the SchoolERP consent forms module in every dimension.*

### 8.1 Full Feature Set — Forms v2

#### A) Builder Enhancements
- [ ] **14+ Field Types**:
  - Text (input, textarea)
  - Number (integer, decimal, currency)
  - Date / Date-Time / Time
  - Dropdown (single/multi select)
  - Radio buttons
  - Checkboxes
  - Button-style option picker
  - File upload (type + size rules)
  - Signature (draw on canvas)
  - Rating (1–5 stars, 1–10 scale, emoji)
  - NPS (0–10 scale with promoter/passive/detractor display)
  - Matrix/Grid (rows × columns of radio/checkbox)
  - Repeater (add unlimited rows of a field group)
  - Address (country, state, city, pin — with autocomplete)
  - Phone (with country code picker + validation)
  - Payment (Stripe/Razorpay — collect payment as part of form)
  - Hidden fields
  - Calculated fields (formula from other field values)
  - Page break (multi-step forms)
  - Section divider (visual grouping with title)
  - Rich text block (read-only instructions/content inside form)
  - Lookup field (link to CRM contact, HR employee, inventory product)

- [ ] **Database-Linked Option Sources** — Same as SchoolERP: define option sources from any DB table (structured SQL query builder or raw SQL). Label template with `{column}` placeholders. Two-column storage (value + label).
- [ ] **Conditional Logic Engine** — Show/hide/require/disable fields based on other field values. Operators: equals, not equals, contains, greater than, less than, in list, is empty, is not empty. AND/OR groups. Nested conditions.
- [ ] **Multi-Step Forms** — Page breaks divide form into steps. Progress bar. Step validation before advancing. Save progress (partial submissions).
- [ ] **Jump Logic** — Skip to different page based on answer. Non-linear form flows.
- [ ] **Pre-fill from URL Parameters** — `?name=John&email=john@co.com` auto-fills fields. Hidden fields capture UTM parameters.
- [ ] **Calculated Fields** — Formula editor: `{price} * {quantity}`. Aggregate over repeater rows. Conditional formulas.

#### B) Access Control & Security
- [ ] **Auth Required Toggle** — Public (no login) vs. Portal (login required).
- [ ] **Role Restriction** — Restrict to: admin only, employees only, students only, specific departments, specific email domains.
- [ ] **Password Protection** — Set a password for the public form URL.
- [ ] **Submission Window** — Open/close at specific datetime. Custom "form is closed" message.
- [ ] **Max Submissions Cap** — Auto-close after N global submissions.
- [ ] **Per-User Submission Limit** — Single submission or unlimited (per authenticated user).
- [ ] **IP Allowlist / Blocklist** — Restrict form submissions by IP range.
- [ ] **reCAPTCHA v3** — Site key + secret + min score per form.
- [ ] **Rate Limiting** — Per IP per hour. Custom per form. Configurable globally.
- [ ] **Honeypot Anti-Spam** — Hidden field that bots fill but humans don't.

#### C) Workflow & Automation
- [ ] **Approval Workflow** — Submissions start as pending. Multi-level approvers. Approve/reject with remarks. Approval email/SMS to submitter.
- [ ] **Email Notifications** — To submitter (confirmation). To admin/team (new submission). Custom HTML template with `{{placeholders}}`. Triggered on submit / approval / rejection.
- [ ] **SMS Notifications** — Twilio / local SMS gateway. DLT template support (India).
- [ ] **Outbound Webhooks** — POST to any URL on submission. HMAC-SHA256 signed payload. Retry queue with exponential backoff (1m / 5m / 30m).
- [ ] **Workflow Trigger** — Submission creates CRM lead, HR leave request, helpdesk ticket, project task — automatically.

#### D) Form Settings
- [ ] **Custom Success Message** — Rich text. Or redirect to URL after submit.
- [ ] **Custom Form URL** — `/forms/my-custom-slug` instead of random hex.
- [ ] **Custom Domain** — `forms.yourcompany.com`
- [ ] **Edit Window** — Allow submitter to edit their own submission only within a time window.
- [ ] **Submission Editing** — Admin can always edit (if can_edit flag is on). Submitter can edit (if allowed + within edit window).
- [ ] **Soft Delete** — Submissions deleted with isTrash flag. Audit trail.
- [ ] **Form Versioning** — Changing a published form creates a new version. Old submissions reference old schema. New submissions use new schema.
- [ ] **Form Duplication** — Clone a form with all settings and fields.
- [ ] **QR Code** — Auto-generated QR for the public form URL. Downloadable PNG.
- [ ] **Embed Code** — iframe embed. JS widget embed. Popup/slider embed mode.
- [ ] **Edit Mode Safety** — Once published, field names locked (same as SchoolERP). Must put in draft to change field names.

#### E) Submissions Report
- [ ] **Filterable Grid** — Date range, search, approval status, submitter type filters.
- [ ] **View/Edit/Delete per row** — Modal with full submission data.
- [ ] **Bulk Actions** — Bulk approve, bulk reject, bulk delete, bulk export.
- [ ] **Export** — Excel, CSV, PDF.
- [ ] **Individual PDF** — Generate PDF of a single submission.
- [ ] **Submission Analytics** — Total submissions, completion rate, avg time to complete, field drop-off analysis (where users abandon the form).

#### F) REST API
- [ ] `GET /api/forms` — List all forms
- [ ] `GET /api/forms/:slug/submissions` — Paginated submissions. Bearer token auth.
- [ ] `GET /api/forms/:slug/submissions/:ref` — Single submission by reference number.
- [ ] `POST /api/forms/:slug/submissions/:ref/approve` — Approve/reject (requires read_approve scope).
- [ ] OpenAPI 3.0 spec. API token management UI.

---

## SECTION 9 — MODULE 8: ANALYTICS (Complete Upgrade)

### 9.1 Full Feature Set — Analytics v2

#### A) Report Builder
- [ ] **Drag-and-Drop Report Builder** — Choose dataset (CRM deals, HR leaves, Accounting invoices, etc.). Drag dimensions and measures onto canvas. Choose chart type. Apply filters. Save and share.
- [ ] **Chart Types** — Line, Bar, Stacked Bar, Area, Stacked Area, Pie, Donut, Scatter, Bubble, Heatmap, Funnel, Gauge, KPI card, Table, Pivot Table, Cohort Matrix, Sankey.
- [ ] **Cross-Module Joins** — Join CRM deals with Accounting invoices. Join HR employees with Project tasks. Any-to-any module data join.
- [ ] **SQL Query Builder** — Power users write raw SQL. Secure (read-only, no DDL/DML). Result displays as chart or table.
- [ ] **Calculated Metrics** — Formula fields in reports: `(won_deals / total_deals) * 100` = Win Rate.
- [ ] **Goal / Target Lines** — Add a target line to any chart. Color above/below target.
- [ ] **Drill-Down** — Click on a bar → see the underlying records.
- [ ] **Comparison Periods** — vs. last month, last quarter, last year, custom period.
- [ ] **Trend Lines** — Linear regression, moving average on time-series charts.
- [ ] **Forecast** — Extrapolate trend 30/60/90 days forward.

#### B) Dashboard Builder
- [ ] **Drag-and-Drop Dashboard** — Arrange widgets in a grid. Resize. Multiple dashboards per user.
- [ ] **Dashboard Templates** — Pre-built dashboards: Sales Pipeline, HR Overview, Finance Summary, Support Queue.
- [ ] **Dashboard Sharing** — Share with specific users, teams, or public link. Embed in external page.
- [ ] **Live Refresh** — Auto-refresh interval. Real-time data for operational dashboards.
- [ ] **Personal vs. Org Dashboards** — Personal: only you see it. Team: your team. Org: everyone.

#### C) Automated Reports
- [ ] **Scheduled Reports** — Run a report daily/weekly/monthly. Email PDF/Excel to specified recipients.
- [ ] **Data Alerts** — "Notify me when overdue invoices > $10,000." Threshold alerts via email/SMS/in-app.
- [ ] **Report Subscriptions** — Users subscribe to reports. Get their own copy on schedule.
- [ ] **Export to Google Sheets** — Live sync report data to a Google Sheet.

#### D) Advanced Analytics
- [ ] **Cohort Analysis** — Group customers by acquisition month. Track retention/churn over time.
- [ ] **Funnel Analysis** — Define multi-step funnel (Lead → Qualified → Demo → Proposal → Won). Conversion % per step.
- [ ] **Retention Analysis** — How many customers/users are still active N months after acquisition?
- [ ] **Attribution Modeling** — Which marketing source drives the most deals? First-touch, last-touch, linear.
- [ ] **Benchmarking** — Compare your KPIs against industry benchmarks (curated data).

---

## SECTION 10 — MODULE 9: WORKFLOWS (Complete Upgrade)

### 10.1 Full Feature Set — Workflows v2

This module becomes the automation backbone of the entire platform. Think: Zapier + Make (Integromat) + n8n — built in.

#### A) Visual Workflow Builder
- [ ] **Node-Based Canvas** — Drag-and-drop nodes. Connect with arrows. Zoom in/out. Pan.
- [ ] **Node Types**:
  - **Triggers** (entry points)
  - **Actions** (do something)
  - **Conditions** (if/else branches)
  - **Loops** (for each item in a list)
  - **Wait/Delay** (wait N minutes/hours/days/until specific time)
  - **Human Approval** (pause until a user approves/rejects)
  - **Sub-Workflow** (call another workflow)
  - **Parallel Branches** (execute multiple branches simultaneously)
  - **Error Handler** (catch errors, take alternate path)
  - **Code Node** (run JavaScript or Python snippet)
  - **Transform** (map/filter/aggregate data)
  - **Split** (branch based on condition)
  - **Merge** (wait for parallel branches to complete)

#### B) Triggers (100+)
**CRM:** Lead created, Lead score changed, Deal stage changed, Deal won, Deal lost, Deal idle N days, Contact created, Activity overdue, Quote sent, Quote opened.

**Projects:** Task created, Task completed, Task overdue, Sprint ended, Milestone reached, Task assigned to me, Budget exceeded.

**HR:** Leave requested, Leave approved, Leave rejected, Attendance absent, Employee birthday, Probation ending, Payroll processed.

**Help Desk:** Ticket created, Ticket status changed, SLA breached, CSAT submitted, Ticket assigned.

**Accounting:** Invoice sent, Invoice overdue, Payment received, Expense submitted, Budget threshold crossed.

**Inventory:** Stock below reorder point, Purchase order created, Stock received.

**Forms:** Submission received, Submission approved, Submission rejected.

**Platform:** User login, User created, Scheduled (cron), Webhook received (inbound), API call, File uploaded.

#### C) Actions (100+)
**Notifications:** Send email (HTML template, any recipient), Send SMS (Twilio/local), Send in-app notification, Send Slack message, Send WhatsApp message.

**CRM:** Create contact, Create lead, Create deal, Update record fields, Add activity, Enroll in sequence.

**Projects:** Create task, Update task status, Assign task, Create subtask.

**HR:** Create leave request, Send announcement.

**Help Desk:** Create ticket, Update ticket, Add note, Send reply.

**Accounting:** Create invoice, Send payment reminder.

**Inventory:** Create purchase order.

**Platform:** Create record in any module, Update record in any module, Delete record, Call webhook (outbound), Run sub-workflow, Delay, Wait for approval, Run code node, Create form submission.

**Integrations:** Create Google Calendar event, Add to Mailchimp list, Create Stripe invoice, Send Razorpay payment link, Post to Slack channel, Create GitHub issue, Add row to Google Sheets, Send Telegram message.

#### D) Workflow Intelligence
- [ ] **Workflow Templates Library** — 100 pre-built templates: "New Lead → Welcome Email → Task: Follow up in 3 days", "Invoice Overdue → Reminder → Escalation".
- [ ] **Test Mode (Dry Run)** — Run workflow with real data but don't execute actions. Preview what would happen.
- [ ] **Step-by-Step Execution Log** — Every run shows each node: input data, output data, duration, success/failure.
- [ ] **Workflow Versioning** — Every save is a version. Rollback to any version.
- [ ] **Error Retry** — Failed actions automatically retry with backoff.
- [ ] **Concurrency Control** — Max parallel runs. Queue overflow.
- [ ] **Rate Limiting** — Don't fire more than N times per hour for a trigger.

---

## SECTION 11 — MODULE 10: DOCUMENTS (Complete Upgrade)

### 11.1 Full Feature Set — Documents v2

Become Notion + Confluence + Google Docs in one.

#### A) Block Editor (Notion-like)
- [ ] **Block Types**:
  - Headings (H1, H2, H3)
  - Paragraph
  - Bulleted list / Numbered list / Todo checklist
  - Toggle (collapsible section)
  - Quote / Callout (colored blocks with icons)
  - Code block (syntax highlighted — 50+ languages)
  - Math / LaTeX equation
  - Divider
  - Image (upload or URL, resize, caption)
  - Video embed (YouTube, Vimeo, Loom)
  - File attachment
  - Embed (Google Docs, Figma, Airtable, GitHub Gist, CodePen)
  - Table (with sort, filter, sum)
  - Database block (linked to ZenFlow data)
  - Mention (@user, @page, @date, @record)
  - Link preview (paste URL → rich card)
  - Mermaid diagram (flowcharts, sequence diagrams)
  - Excalidraw whiteboard
  - Kanban board (mini)
  - Template button (insert template content on click)

- [ ] **Slash Commands** — Type `/` → search and insert any block.
- [ ] **Markdown Shortcuts** — `##` → H2, `**bold**`, `- ` → list, `[ ]` → todo. Full markdown support.
- [ ] **Drag-and-Drop Blocks** — Reorder any block by dragging the handle.

#### B) Collaboration
- [ ] **Real-Time Co-editing** — Multiple users edit simultaneously. Cursor presence indicators. Conflict-free (CRDT-based).
- [ ] **Comments** — Highlight any text → add comment. Thread replies. Resolve/re-open.
- [ ] **Suggestions Mode** — Track changes (like Google Docs "Suggest edits"). Accept/reject.
- [ ] **@Mentions** — Notify a user by mentioning them. Jump to the mention.
- [ ] **Document Chat** — Thread-based discussion sidebar (like Notion comments but separate).

#### C) Organization
- [ ] **Nested Pages** — Unlimited depth. Left sidebar tree view. Drag to reorder.
- [ ] **Wikis / Spaces** — Create spaces per team (Engineering, Marketing, Finance). Control access per space.
- [ ] **Templates** — Save any document as a template. Team template gallery.
- [ ] **Favorites / Starred** — Pin frequently accessed documents.
- [ ] **Recent** — Last 20 documents visited.
- [ ] **Full-Text Search** — Search across all document content. Highlight matches.
- [ ] **Tags** — Tag documents for cross-space organization.
- [ ] **Backlinks** — See all documents that link to the current document.
- [ ] **Table of Contents** — Auto-generated from headings. Sticky sidebar.

#### D) Sharing & Export
- [ ] **Share Link** — View-only or editable public link. Expiry. Password.
- [ ] **Permission Levels** — Private, team, org, public.
- [ ] **PDF Export** — Full fidelity PDF with custom CSS.
- [ ] **Word Export** — `.docx` export.
- [ ] **Markdown Export**
- [ ] **Print** — Optimized print CSS.

---

## SECTION 12 — MODULE 11: CHAT (Complete Upgrade)

### 12.1 Full Feature Set — Chat v2

#### A) Messaging Features
- [ ] **Message Reactions** — Emoji reactions. Click to see who reacted.
- [ ] **Thread Replies** — Reply to a specific message. Thread view in sidebar. Unread thread count.
- [ ] **Message Editing** — Edit any sent message. "Edited" indicator.
- [ ] **Message Deletion** — Delete for everyone. "Message deleted" placeholder.
- [ ] **Message Pinning** — Pin important messages. "Pinned messages" panel.
- [ ] **Bookmarks / Saved Messages** — Save any message. Personal saved items list.
- [ ] **Message Forwarding** — Forward to another channel/DM.
- [ ] **Scheduled Messages** — Write now, send later.
- [ ] **Rich Text Formatting** — Bold, italic, strikethrough, code, code block, lists, links.
- [ ] **Code Snippets** — Syntax-highlighted code blocks. Language picker.
- [ ] **File Sharing** — Upload images, docs, videos. Preview in-chat. Download.
- [ ] **Link Previews** — Paste a URL → rich preview card (title, description, image).
- [ ] **Giphy / Tenor** — Search and send GIFs.

#### B) Organization
- [ ] **Channel Categories / Sections** — Group channels into sections. Collapse sections.
- [ ] **Read / Unread** — Mark channels as read. Jump to oldest unread.
- [ ] **Mute Channels** — Mute notifications while still subscribed.
- [ ] **Channel Archiving** — Archive inactive channels. Searchable but no new messages.
- [ ] **Channel Permissions** — Read-only channels (announcement channels). Post-only for select roles.
- [ ] **Shared Channels** — Invite external org users into a channel.
- [ ] **Guest Access** — Invite external users (clients) to specific channels only.

#### C) Presence & Status
- [ ] **Online / Away / Do Not Disturb / Offline** — Auto-detect based on activity. Manual override.
- [ ] **Custom Status** — "🏖 On vacation until Monday." With expiry.
- [ ] **Notification Schedule** — Don't notify outside work hours (per timezone).
- [ ] **Notification Sounds** — Custom per device.

#### D) Voice / Video
- [ ] **Huddles** — Quick audio call in a channel. Join/leave with one click.
- [ ] **Video Calls** — Screen sharing. Recording. Transcription.
- [ ] **Async Video** — Record and send a short video message (Loom-like).

#### E) Integrations & Bots
- [ ] **Incoming Webhooks** — Any external system can post to a channel.
- [ ] **Workflow Notifications** — Workflow engine posts to a channel on events.
- [ ] **Slash Commands** — `/create-task Buy server` → creates task. `/deal-status Acme` → shows deal info.
- [ ] **Bot Framework** — Build internal bots. Answer questions, run commands.

---

## SECTION 13 — NEW MODULE: EMAIL MARKETING

A module Zoho charges separately ($14/mo minimum). ZenFlow includes it.

### 13.1 Full Feature Set

- [ ] **Contact Lists & Segments** — Manual lists. Smart segments (CRM contacts where lead_score > 80, etc.).
- [ ] **Email Campaign Builder** — Drag-and-drop email designer. Templates library. Import HTML.
- [ ] **A/B Testing** — Test subject lines, content, send times. Auto-pick winner.
- [ ] **Email Scheduling** — Send now or at optimal time (AI-suggested).
- [ ] **Automation Sequences (Drip)** — Welcome series, nurture campaigns, re-engagement flows.
- [ ] **Unsubscribe Management** — One-click unsubscribe (CAN-SPAM/GDPR). Suppression lists.
- [ ] **Bounce Handling** — Hard bounce → auto-remove. Soft bounce → retry 3×.
- [ ] **Open/Click Tracking** — Per-contact engagement history.
- [ ] **Analytics** — Open rate, click rate, bounce rate, unsubscribe rate, revenue attributed.
- [ ] **SPF/DKIM/DMARC Setup Wizard** — Step-by-step DNS configuration guide.
- [ ] **Custom Sending Domain** — Send from `hello@yourcompany.com`

---

## SECTION 14 — NEW MODULE: CALENDAR & SCHEDULING

- [ ] **Personal Calendar** — All tasks, meetings, leave, reminders in one calendar.
- [ ] **Team Calendar** — Shared visibility. Who's working on what today.
- [ ] **Meeting Scheduler (Calendly-like)** — Share booking link. Define availability. Buffer between meetings. Max bookings/day. Custom questions on booking form.
- [ ] **Resource Booking** — Book conference rooms, vehicles, equipment.
- [ ] **Calendar Sync** — Two-way Google Calendar and Outlook sync.
- [ ] **Video Conference Integration** — Auto-create Zoom/Google Meet link on meeting booking.
- [ ] **Reminders** — Email + SMS + push before meeting.
- [ ] **Time Zones** — Handle multi-timezone teams. Meeting shown in each person's local time.

---

## SECTION 15 — NEW MODULE: AI ASSISTANT

This is the game-changer that separates ZenFlow from every competitor.

### 15.1 AI Features Across All Modules

#### AI Writing
- [ ] **Email Composer** — "Write a follow-up email to John who attended our demo yesterday." Tone selector (formal, friendly, concise).
- [ ] **Proposal Generator** — Input deal info → AI writes proposal draft.
- [ ] **Job Description Generator** — Input role → AI writes JD.
- [ ] **Knowledge Base Article Generator** — Input ticket issue → AI drafts KB article.
- [ ] **Document Summarizer** — "Summarize this 20-page contract in 5 bullet points."

#### AI Analytics
- [ ] **Natural Language Queries** — "Show me revenue by region for last quarter" → auto-builds report.
- [ ] **Insight Generation** — AI scans data, surfaces insights: "Deal velocity dropped 23% this month. Here are the 3 most likely reasons."
- [ ] **Anomaly Detection** — Flag unusual spikes/drops. "Ticket volume is 3× normal — possible system outage?"

#### AI CRM
- [ ] **Lead Scoring Model** — Train on historical won/lost deals. Predict probability for new leads.
- [ ] **Next Best Action** — "This lead hasn't responded in 5 days. Recommended: send case study via WhatsApp."
- [ ] **Deal Risk Scoring** — "This deal is at high risk of losing. Reasons: no activity in 10 days, champion changed."
- [ ] **Duplicate Detection** — AI finds likely duplicates across contacts, accounts.

#### AI Help Desk
- [ ] **Auto-Categorization** — Read ticket → suggest category, priority, assignee.
- [ ] **Suggested Replies** — Pull from KB + past tickets → suggest response.
- [ ] **Sentiment Analysis** — Detect anger/frustration → auto-escalate.
- [ ] **Ticket Deflection Chatbot** — Answers 40% of tickets automatically.

#### AI Workflow
- [ ] **Workflow Suggestion** — "You manually do X every Monday — would you like me to automate it?"
- [ ] **Smart Trigger Detection** — Observe admin behavior → suggest workflows.

---

## SECTION 16 — PLATFORM FEATURES (Cross-Cutting)

### 16.1 Advanced Search
- [ ] **Global Search** — `Cmd+K` opens universal search. Searches across all modules simultaneously.
- [ ] **Fuzzy/Semantic Search** — Find "john smth" → returns "John Smith." Intent understanding.
- [ ] **Search Filters** — Narrow by module, date range, created by.
- [ ] **Saved Searches** — Save complex filter combinations.
- [ ] **Recent Searches** — Last 10 queries.

### 16.2 Notifications v2
- [ ] **Real-Time Push** — WebSocket/SSE. Instant in-app notifications.
- [ ] **Notification Center** — Grouped by module. Mark all read. Filter by type.
- [ ] **Email Digest** — Daily or weekly summary of all notifications.
- [ ] **Notification Rules** — Per-user control: "Email me only for high-priority tickets."
- [ ] **Do Not Disturb** — Schedule quiet hours. Urgent notifications still come through.
- [ ] **@Mention Notifications** — Mention anyone in any comment/note/chat message.

### 16.3 Customization Platform
- [ ] **Custom Fields on Any Record** — Text, Number, Date, Select, Multi-Select, Checkbox, URL, Formula, Relation (to any other record type). Required, unique, default value.
- [ ] **Custom Views** — Per-user and shared views. Save current filter + sort + column set as a view.
- [ ] **Custom Modules** — No-code module builder: define fields, views, workflows, permissions. Build entirely new business objects.
- [ ] **Custom Roles & RBAC** — Create roles with granular permissions: per module, per action (view/create/edit/delete/export), per field.
- [ ] **Field-Level Permissions** — Hide sensitive fields (salary, SSN) from certain roles.
- [ ] **Record-Level Permissions** — "Can only see records assigned to me."
- [ ] **Custom Branding** — Logo, primary color, custom login page, custom email sender domain.
- [ ] **White-Labeling** — Remove "ZenFlow" branding entirely. Use customer's own brand.
- [ ] **Custom Domain** — `app.yourcompany.com` instead of `zenflow.app/org/yourcompany`.

### 16.4 Security & Compliance
- [ ] **SSO** — SAML 2.0 and OIDC. Google Workspace, Microsoft 365, Okta, Auth0.
- [ ] **MFA** — TOTP (Google Authenticator), SMS OTP, Hardware key (FIDO2/WebAuthn).
- [ ] **Session Management** — See all active sessions. Revoke individual or all.
- [ ] **IP Allowlisting** — Restrict login to specific IP ranges.
- [ ] **Audit Log** — Every user action logged: field-level changes, logins, exports, API calls. Immutable. Export.
- [ ] **Data Encryption** — Encryption at rest (AES-256). Encryption in transit (TLS 1.3). Field-level encryption for PII.
- [ ] **Data Residency** — Choose data region: India, US, EU.
- [ ] **GDPR Tools** — Data export (right of access). Data deletion (right to be forgotten). Consent management.
- [ ] **SOC 2 Controls** — Access control policies, change management, incident response.

### 16.5 API & Integrations Platform
- [ ] **REST API v2** — Full CRUD on all modules. Consistent response format. OpenAPI 3.0 spec.
- [ ] **GraphQL API** — Flexible query API for advanced integrations.
- [ ] **Webhooks v2** — Subscribe to any event. HMAC-signed. Retry queue. Webhook logs.
- [ ] **SDK** — JavaScript SDK. Python SDK. PHP SDK. React component library.
- [ ] **Marketplace** — App marketplace. Third-party integrations. One-click install.

**Native Integrations (Priority 1):**
- Google Workspace (Gmail, Calendar, Drive, Sheets)
- Microsoft 365 (Outlook, Teams, OneDrive, SharePoint)
- Slack
- WhatsApp Business API
- Twilio (SMS, Voice)
- Stripe / Razorpay / PayU
- Zoom / Google Meet
- DocuSign / DigiLocker
- Tally / SAP (accounting sync)
- Shopify / WooCommerce
- AWS S3 / Google Cloud Storage
- GitHub / GitLab / Jira (for Projects module)
- Mailchimp / SendGrid
- Clearbit (contact enrichment)
- OpenAI / Claude (AI features)

### 16.6 Mobile App (PWA + Native)
- [ ] **PWA (Phase 1)** — Installable on any device. Offline mode for key data. Push notifications.
- [ ] **Native iOS App (Phase 2)**
- [ ] **Native Android App (Phase 2)**
- [ ] **Features**: Full CRM, task management, chat, notifications, camera for receipt/document scanning, GPS check-in, voice notes.
- [ ] **Offline Mode** — View/edit records offline. Sync when back online. Conflict resolution.

### 16.7 Performance at Scale
- [ ] **Virtual Scrolling** — Lists of 100,000+ records load instantly. Only render visible rows.
- [ ] **Server-Side Pagination** — Every list endpoint paginated. Cursor-based for consistency.
- [ ] **Query Optimization** — Database indexes on every common query pattern. Query analyzer in dev tools.
- [ ] **Read Replicas** — Separate read traffic from write traffic.
- [ ] **Background Jobs** — Heavy operations (PDF generation, exports, bulk imports, email sending) run in BullMQ queue. User gets notified when done.
- [ ] **Caching Strategy** — Redis cache for: session, API responses, computed aggregates, option sources.
- [ ] **CDN** — Static assets, generated PDFs, uploaded files via CDN edge network.

### 16.8 Developer Experience
- [ ] **Dev Sandbox** — Isolated sandbox org for testing. Reset at any time.
- [ ] **API Playground** — Interactive API explorer. Like Swagger UI but better.
- [ ] **Webhook Tester** — Built-in webhook testing tool. Inspect payloads.
- [ ] **Changelog** — Public changelog. Subscribe to updates.
- [ ] **Status Page** — Live system status. Incident history.
- [ ] **CLI Tool** — `zenflow export --module crm --format csv` — export data from command line.

---

## SECTION 17 — ONBOARDING & USER EXPERIENCE

### 17.1 First-Run Experience
- [ ] **Onboarding Wizard** — 5-step setup: company info → invite team → import data → connect integrations → "Your ZenFlow is ready!"
- [ ] **Sample Data** — Every module populated with realistic demo data. "Load sample data" button.
- [ ] **Product Tours** — Per-module guided tours (Shepherd.js). Triggered on first visit. Skippable.
- [ ] **Onboarding Checklists** — "Complete your CRM setup: [✓] Add first contact [ ] Import contacts [ ] Set up pipeline [ ] Connect Gmail" — progress tracking.

### 17.2 Power User UX
- [ ] **Command Palette** (`Cmd+K`) — Search + navigate + run actions. "Create deal", "Go to invoices", "Add contact John Smith".
- [ ] **Keyboard Shortcuts** — Comprehensive shortcuts for every module. `?` shows shortcut cheat sheet.
- [ ] **Quick Add** — `+` button always visible → quick-create any record type.
- [ ] **Sticky Navigation** — Breadcrumbs always visible. Never lost.
- [ ] **Undo / Redo** — `Cmd+Z` undoes last action (for critical operations: delete, bulk update).
- [ ] **Dark Mode** — System-aware. Manual toggle. Per-user preference.
- [ ] **Density Settings** — Compact / Comfortable / Spacious view.
- [ ] **Accessibility** — WCAG 2.1 AA compliance. Screen reader support. Keyboard navigable. Color blind friendly.

### 17.3 Localization
- [ ] **Multi-Language** — English, Hindi, Spanish, French, German, Japanese, Arabic. Community-driven translations.
- [ ] **RTL Support** — Arabic, Hebrew full RTL layout.
- [ ] **Date/Number/Currency Formats** — Locale-aware.
- [ ] **Timezone Handling** — All timestamps stored in UTC, displayed in user's timezone.
- [ ] **India-Specific** — Indian date formats, currency (₹), GST/TDS/PF/ESI, Indian holiday calendars, Hindi UI.

---

## SECTION 18 — IMPLEMENTATION PHASES

### Phase 2 — Deep Module Upgrades (Months 1–3)
**Priority: Highest ROI, most user-visible**

1. **CRM v2** — Pipeline Kanban, deal products, email integration, lead scoring, sequences
2. **Forms v2** — Conditional logic, database option sources, approval workflow, webhooks, reCAPTCHA
3. **Projects v2** — Gantt view, subtasks, dependencies, time tracking, multiple views
4. **Help Desk v2** — SLA engine, email-to-ticket, canned responses, CSAT, KB versioning
5. **Accounting v2** — Double-entry engine, bank reconciliation, GST/TDS, financial statements

### Phase 3 — New Capabilities (Months 4–6)
1. **Workflow Engine v2** — Visual builder, 100+ triggers/actions, templates library
2. **Analytics v2** — Report builder, scheduled reports, cross-module joins
3. **Documents v2** — Block editor, real-time collaboration, version history
4. **Chat v2** — Threads, reactions, file sharing, presence, huddles
5. **HR v2** — Payroll, performance reviews, ATS, org chart

### Phase 4 — Platform & AI (Months 7–9)
1. **AI Assistant** — Writing, analytics, CRM intelligence, Help Desk automation
2. **Custom Fields & Custom Modules** — No-code builder
3. **RBAC v2** — Custom roles, field-level permissions
4. **Email Marketing module**
5. **Calendar & Scheduling module**
6. **SSO + MFA + Audit Log**
7. **Mobile PWA**

### Phase 5 — Scale & Ecosystem (Months 10–12)
1. **Native Integrations** — Google, Microsoft, Stripe, Razorpay, WhatsApp, Twilio, Slack
2. **API Marketplace**
3. **White-Labeling & Custom Domains**
4. **Native Mobile Apps (iOS + Android)**
5. **SOC 2 Type II compliance**
6. **Multi-datacenter / Data residency**

---

## SECTION 19 — DATABASE SCHEMA ADDITIONS REQUIRED

For every upgrade, new Prisma models needed. Key additions:

### CRM v2 Additions
```
CrmPipeline, CrmStage, CrmProduct, CrmQuote, CrmQuoteLine,
CrmEmailIntegration, CrmEmailLog, CrmSequence, CrmSequenceStep,
CrmSequenceEnrollment, CrmLeadScore, CrmTerritory, CrmCommissionRule
```

### Projects v2 Additions
```
ProjectSubtask, ProjectDependency, ProjectMilestone, ProjectTimeLog,
ProjectBudget, ProjectRisk, ProjectCustomField, ProjectTemplate,
ProjectTaskTemplate, ProjectChecklistItem
```

### HR v2 Additions
```
HrShift, HrShiftPattern, HrPayrollRun, HrPayslip, HrPayComponent,
HrGoal, HrPerformanceReview, HrJobPosting, HrApplication,
HrTraining, HrAssetAssignment, HrOnboardingTemplate, HrOnboardingTask
```

### Forms v2 Additions
```
FormOptionSource, FormConditionalRule, FormWebhookQueue,
FormApiToken, FormAuditLog, FormVersion, FormQrCode
```

### Platform Additions
```
CustomField, CustomFieldValue, CustomModule, CustomRole,
CustomPermission, AuditLog, Notification, NotificationPreference,
Integration, IntegrationCredential, WebhookSubscription, ApiToken,
EmailTemplate, SmsTemplate, OtpLog, Session
```

---

## SECTION 20 — THE NORTH STAR METRIC

**ZenFlow's success is measured by one thing:**

> **Time to Value** — How fast does a new organization go from signup to "I can't imagine working without this"?

This means:
- 5-minute onboarding
- Every module works standalone (no configuration required)
- Sample data makes every feature immediately understandable
- AI suggestions reduce the "blank page" problem
- Workflows automate the pain away in week 1

**When ZenFlow achieves < 30 minutes to first value across all 13+ modules, no competitor can match it.**

---

## APPENDIX A — COMPETITIVE FEATURE MATRIX

| Feature | ZenFlow Current | Zoho One | HubSpot | Salesforce | Monday | Jira |
|---------|----------------|----------|---------|------------|--------|------|
| CRM Pipeline Kanban | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Email Sequences | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Conditional Form Logic | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Gantt Chart | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Time Tracking | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Payroll | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Double-Entry Accounting | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Visual Workflow Builder | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Assistant | ❌ | Partial | ✅ | ✅ | ❌ | Partial |
| White-Labeling | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Custom Modules | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| SSO | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit Log | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Real-time Collaboration | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **After Phase 5** | **✅ ALL** | Partial | Partial | Partial | Partial | Partial |

---

## APPENDIX B — TECHNOLOGY ADDITIONS NEEDED

```
Current Stack (keep):
- Next.js 15, TypeScript 5, tRPC v11, Prisma v6, PostgreSQL 16
- BullMQ v5, Redis 7, MinIO, Turborepo, Shadcn/UI

Add for Phase 2-3:
- Yjs (real-time collaboration CRDT)
- Tiptap / Slate.js (rich text / block editor)
- React Flow / xyflow (visual workflow builder canvas)
- D3.js + Recharts v3 (advanced analytics charts)
- react-big-calendar or FullCalendar (Calendar module)
- SortableJS (existing — extend usage)
- Playwright (E2E testing)
- Zod v4 (upgrade)
- date-fns-tz (timezone handling)

Add for Phase 4:
- OpenAI SDK / Anthropic SDK (AI features)
- Stripe SDK / Razorpay SDK
- Nodemailer + AWS SES (email at scale)
- Twilio SDK (SMS, Voice, WhatsApp)
- Sharp (image processing)
- PDFKit / Puppeteer (PDF generation)
- Papa Parse (CSV import)
- ExcelJS (Excel import/export)
- node-cron (scheduled tasks)

Infrastructure upgrades:
- Nginx or Caddy (reverse proxy, SSL termination)
- PM2 or Docker Swarm (process management)
- Grafana + Prometheus (monitoring)
- Sentry (error tracking)
- PostHog (product analytics)
```

---

*This document is the blueprint. Every sprint, pick the highest-priority item, implement it with the depth of SchoolERP's consent forms module — thorough validation, audit trail, automation hooks, comprehensive reporting. Never ship a basic version.*

*"Basic is the enemy. Deep is the product."*
