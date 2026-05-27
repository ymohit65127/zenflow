# ZenFlow — ANALYTICS v2 Implementation

> **Module:** Analytics & Reporting v2
> **Stack:** Next.js 15 · tRPC v11 · Prisma v6 · PostgreSQL 16 · BullMQ · Redis · TypeScript 5
> **Author:** Mohit Yadav · **Date:** 2026-05-27
> **Status:** Ready for Implementation

---

## 1. Overview

Analytics v2 replaces the lightweight `AnalyticsReport` + `DashboardWidget` + `SavedFilter` tables with a full-featured business intelligence platform. Users can build reports using a visual query builder, arrange them on drag-and-drop dashboards, schedule automated email/PDF delivery, and set data threshold alerts. The query engine translates a JSON `data_source` config into Prisma queries or parameterized raw SQL, with Redis caching for expensive aggregations.

### 1.1 Capabilities

| Feature | v1 (existing) | v2 |
|---|---|---|
| Report types | 4 (Summary/Detailed/Comparison/Trend) | 6 (table/chart/pivot/funnel/cohort/kpi) |
| Dashboard widgets | 9 types, single widget model | Multi-report drag-drop dashboards |
| Scheduled delivery | is_scheduled flag only | Full schedule model with BullMQ + PDF/Excel/CSV |
| Data alerts | None | Threshold-based alerts with multi-channel notification |
| Query builder | config JSON (manual) | Visual dimension/measure/filter builder |
| Caching | None | Redis 5-min TTL with cache-busting |
| Export | None | PDF (Puppeteer), Excel (xlsx), CSV |
| Ad-hoc explore | None | Interactive explore with pivot support |
| Saved filters | Per-entity | Per-module, reusable across reports |

---

## 2. Database Schema (Prisma v6)

> Replaces existing `AnalyticsReport`, `DashboardWidget`, `SavedFilter` models.

```prisma
// =============================================================================
// MODULE 4 — ANALYTICS v2
// =============================================================================

model AnalyticsReport {
  id                   String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id      String      @db.Uuid
  created_by           String      @db.Uuid
  name                 String      @db.VarChar(255)
  description          String?     @db.Text
  report_type          ReportTypeV2  @default(chart)

  // Query definition
  data_source          Json
  // {
  //   module: 'crm_deals' | 'projects' | 'hr_employees' | ...,
  //   dimensions: [{ field: 'stage_name', alias: 'Stage' }],
  //   measures: [{ field: 'value', func: 'sum', alias: 'Total Value' }],
  //   filters: [{ field: 'status', op: 'eq', value: 'OPEN' }],
  //   joins: ['crm_pipeline_stages'],
  //   date_filter: { field: 'created_at', preset: 'last_30_days' | 'this_month' | 'custom', from: null, to: null },
  //   sort: [{ field: 'Total Value', direction: 'desc' }],
  //   limit: 100,
  //   group_by_date_trunc: 'day' | 'week' | 'month' | 'quarter' | 'year' | null
  // }

  // Visualization
  visualization_config Json
  // {
  //   chart_type: 'line' | 'bar' | 'stacked_bar' | 'pie' | 'donut' | 'area' | 'scatter' | 'heatmap',
  //   x_axis: 'Stage',
  //   y_axis: 'Total Value',
  //   color: 'status',
  //   group_by: null,
  //   show_legend: true,
  //   show_data_labels: false,
  //   color_palette: 'default' | 'pastel' | 'bold' | string[],
  //   kpi_comparison_period: 'prev_period' | 'prev_year' | null,
  //   pivot_row_field: null,
  //   pivot_col_field: null,
  //   pivot_value_field: null,
  //   funnel_stages: []
  // }

  is_public            Boolean     @default(false)
  public_token         String?     @unique @db.VarChar(64)
  tags                 String[]
  last_run_at          DateTime?
  last_run_duration_ms Int?
  created_at           DateTime    @default(now())
  updated_at           DateTime    @updatedAt

  organization          Organization             @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  scheduled_reports     AnalyticsScheduledReport[]
  alerts                AnalyticsDataAlert[]
  dashboard_layout_items AnalyticsDashboardItem[]

  @@index([organization_id])
  @@map("analytics_reports")
}

model AnalyticsDashboard {
  id              String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String           @db.Uuid
  created_by      String           @db.Uuid
  name            String           @db.VarChar(255)
  description     String?          @db.Text
  is_default      Boolean          @default(false)
  scope           DashboardScope   @default(personal)
  shared_with_ids String[]         // user IDs for team scope
  created_at      DateTime         @default(now())
  updated_at      DateTime         @updatedAt

  organization Organization            @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  items        AnalyticsDashboardItem[]

  @@index([organization_id, scope])
  @@map("analytics_dashboards")
}

model AnalyticsDashboardItem {
  id           String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  dashboard_id String      @db.Uuid
  report_id    String?     @db.Uuid
  widget_type  WidgetTypeV2 @default(chart)
  // Grid layout (react-grid-layout compatible)
  grid_x       Int         @default(0)
  grid_y       Int         @default(0)
  grid_w       Int         @default(6)   // out of 12 columns
  grid_h       Int         @default(4)
  // Inline config (overrides report config for this widget instance)
  title_override String?   @db.VarChar(255)
  config_override Json?
  created_at   DateTime    @default(now())

  dashboard AnalyticsDashboard @relation(fields: [dashboard_id], references: [id], onDelete: Cascade)
  report    AnalyticsReport?   @relation(fields: [report_id], references: [id])

  @@index([dashboard_id])
  @@map("analytics_dashboard_items")
}

model AnalyticsScheduledReport {
  id              String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String           @db.Uuid
  created_by      String           @db.Uuid
  report_id       String?          @db.Uuid
  dashboard_id    String?          @db.Uuid
  name            String           @db.VarChar(255)
  frequency       ReportFrequency
  day_of_week     Int?             // 0 = Sunday, 6 = Saturday (weekly)
  day_of_month    Int?             // 1–31 (monthly)
  hour_of_day     Int              @default(8)
  recipients      String[]         // email addresses
  format          ExportFormat     @default(pdf)
  is_active       Boolean          @default(true)
  last_sent_at    DateTime?
  next_send_at    DateTime?
  created_at      DateTime         @default(now())
  updated_at      DateTime         @updatedAt

  organization Organization    @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  report       AnalyticsReport? @relation(fields: [report_id], references: [id])

  @@index([organization_id, is_active])
  @@index([next_send_at, is_active])
  @@map("analytics_scheduled_reports")
}

model AnalyticsDataAlert {
  id                   String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id      String        @db.Uuid
  created_by           String        @db.Uuid
  report_id            String        @db.Uuid
  name                 String        @db.VarChar(255)
  // JSONPath-style path into the report result, e.g. "rows[0].Total Value"
  metric_path          String        @db.VarChar(255)
  operator             AlertOperator
  threshold            Decimal       @db.Decimal(15, 4)
  notification_channels Json
  // { email: true, sms: false, in_app: true }
  recipients           String[]
  is_active            Boolean       @default(true)
  last_triggered_at    DateTime?
  last_value           Decimal?      @db.Decimal(15, 4)
  created_at           DateTime      @default(now())
  updated_at           DateTime      @updatedAt

  organization Organization    @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  report       AnalyticsReport @relation(fields: [report_id], references: [id])

  @@index([organization_id, is_active])
  @@map("analytics_data_alerts")
}

model AnalyticsSavedFilter {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organization_id String   @db.Uuid
  user_id         String   @db.Uuid
  module          String   @db.VarChar(50)
  name            String   @db.VarChar(200)
  filters         Json
  // [{ field: 'status', op: 'eq', value: 'OPEN' }]
  created_at      DateTime @default(now())

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@index([organization_id, user_id, module])
  @@map("analytics_saved_filters")
}

// --- New Enums ---

enum ReportTypeV2 {
  table
  chart
  pivot
  funnel
  cohort
  kpi
}

enum DashboardScope {
  personal
  team
  org
}

enum WidgetTypeV2 {
  chart
  table
  kpi
  pivot
  funnel
  text
  divider
}

enum ReportFrequency {
  daily
  weekly
  monthly
  quarterly
}

enum ExportFormat {
  pdf
  excel
  csv
}

enum AlertOperator {
  gt
  lt
  gte
  lte
  eq
  change_pct_up
  change_pct_down
}
```

---

## 3. Data Source Module Definitions

Each ZenFlow module exposes a typed query schema. The query builder UI renders these as selectable fields.

### 3.1 CRM Module

```typescript
// apps/web/src/lib/analytics/modules/crm.ts

export const CRM_DEALS_MODULE = {
  module_id: 'crm_deals',
  label: 'CRM — Deals',
  primary_table: 'crm_deals',
  dimensions: [
    { field: 'status',        label: 'Deal Status',    type: 'enum' },
    { field: 'currency',      label: 'Currency',       type: 'string' },
    { field: 'stage_name',    label: 'Pipeline Stage', type: 'string', join: 'crm_pipeline_stages.name' },
    { field: 'pipeline_name', label: 'Pipeline',       type: 'string', join: 'crm_pipelines.name' },
    { field: 'assignee_name', label: 'Assigned To',    type: 'string', join: 'users.name' },
    { field: 'tags',          label: 'Tags',           type: 'array' },
    { field: 'created_at',    label: 'Created Date',   type: 'date' },
    { field: 'expected_close', label: 'Close Date',    type: 'date' },
  ],
  measures: [
    { field: 'id',    label: 'Deal Count',        func: ['count'] },
    { field: 'value', label: 'Deal Value',         func: ['sum', 'avg', 'min', 'max'] },
    { field: 'probability', label: 'Probability', func: ['avg'] },
  ],
  available_joins: ['crm_pipeline_stages', 'crm_pipelines', 'crm_contacts', 'users'],
  date_fields: ['created_at', 'expected_close', 'closed_at'],
};

export const CRM_CONTACTS_MODULE = {
  module_id: 'crm_contacts',
  label: 'CRM — Contacts',
  primary_table: 'crm_contacts',
  dimensions: [
    { field: 'status',   label: 'Status',   type: 'enum' },
    { field: 'source',   label: 'Source',   type: 'string' },
    { field: 'country',  label: 'Country',  type: 'string' },
    { field: 'city',     label: 'City',     type: 'string' },
    { field: 'tags',     label: 'Tags',     type: 'array' },
    { field: 'created_at', label: 'Created Date', type: 'date' },
  ],
  measures: [
    { field: 'id', label: 'Contact Count', func: ['count'] },
  ],
  date_fields: ['created_at', 'updated_at'],
};

export const CRM_LEADS_MODULE = {
  module_id: 'crm_leads',
  label: 'CRM — Leads',
  primary_table: 'crm_leads',
  dimensions: [
    { field: 'status',  label: 'Lead Status', type: 'enum' },
    { field: 'source',  label: 'Source',      type: 'enum' },
    { field: 'assignee_name', label: 'Assigned To', type: 'string', join: 'users.name' },
    { field: 'created_at', label: 'Created Date', type: 'date' },
  ],
  measures: [
    { field: 'id',               label: 'Lead Count',    func: ['count'] },
    { field: 'estimated_value',  label: 'Est. Value',    func: ['sum', 'avg'] },
    { field: 'score',            label: 'Lead Score',    func: ['avg', 'sum'] },
  ],
  date_fields: ['created_at', 'converted_at'],
};
```

### 3.2 Projects Module

```typescript
export const PROJECTS_TASKS_MODULE = {
  module_id: 'projects_tasks',
  label: 'Projects — Tasks',
  primary_table: 'tasks',
  dimensions: [
    { field: 'status',        label: 'Task Status',  type: 'enum' },
    { field: 'priority',      label: 'Priority',     type: 'enum' },
    { field: 'type',          label: 'Task Type',    type: 'enum' },
    { field: 'project_name',  label: 'Project',      type: 'string', join: 'projects.name' },
    { field: 'assignee_name', label: 'Assignee',     type: 'string', join: 'users.name via task_assignments' },
    { field: 'tags',          label: 'Tags',         type: 'array' },
    { field: 'due_date',      label: 'Due Date',     type: 'date' },
    { field: 'created_at',    label: 'Created Date', type: 'date' },
  ],
  measures: [
    { field: 'id',              label: 'Task Count',       func: ['count'] },
    { field: 'story_points',    label: 'Story Points',     func: ['sum', 'avg'] },
    { field: 'estimated_hours', label: 'Estimated Hours',  func: ['sum', 'avg'] },
    { field: 'actual_hours',    label: 'Actual Hours',     func: ['sum', 'avg'] },
  ],
  date_fields: ['created_at', 'due_date', 'completed_at', 'started_at'],
};
```

### 3.3 HR Module

```typescript
export const HR_EMPLOYEES_MODULE = {
  module_id: 'hr_employees',
  label: 'HR — Employees',
  primary_table: 'employees',
  dimensions: [
    { field: 'status',           label: 'Status',          type: 'enum' },
    { field: 'employment_type',  label: 'Employment Type', type: 'enum' },
    { field: 'gender',           label: 'Gender',          type: 'enum' },
    { field: 'department_name',  label: 'Department',      type: 'string', join: 'departments.name' },
    { field: 'designation',      label: 'Designation',     type: 'string' },
    { field: 'nationality',      label: 'Nationality',     type: 'string' },
    { field: 'join_date',        label: 'Join Date',       type: 'date' },
  ],
  measures: [
    { field: 'id',     label: 'Headcount', func: ['count'] },
    { field: 'salary', label: 'Salary',    func: ['sum', 'avg', 'min', 'max'] },
  ],
  date_fields: ['join_date', 'created_at'],
};

export const HR_LEAVE_MODULE = {
  module_id: 'hr_leave',
  label: 'HR — Leave Requests',
  primary_table: 'leave_requests',
  dimensions: [
    { field: 'status',          label: 'Status',      type: 'enum' },
    { field: 'leave_type_name', label: 'Leave Type',  type: 'string', join: 'leave_types.name' },
    { field: 'department_name', label: 'Department',  type: 'string', join: 'employees.department_id -> departments.name' },
    { field: 'from_date',       label: 'From Date',   type: 'date' },
  ],
  measures: [
    { field: 'id',   label: 'Request Count', func: ['count'] },
    { field: 'days', label: 'Days',          func: ['sum', 'avg'] },
  ],
  date_fields: ['from_date', 'to_date', 'created_at'],
};
```

### 3.4 Help Desk Module

```typescript
export const HELPDESK_TICKETS_MODULE = {
  module_id: 'helpdesk_tickets',
  label: 'Help Desk — Tickets',
  primary_table: 'tickets',
  dimensions: [
    { field: 'status',         label: 'Status',   type: 'enum' },
    { field: 'priority',       label: 'Priority', type: 'enum' },
    { field: 'type',           label: 'Type',     type: 'enum' },
    { field: 'channel',        label: 'Channel',  type: 'enum' },
    { field: 'category_name',  label: 'Category', type: 'string', join: 'ticket_categories.name' },
    { field: 'assignee_name',  label: 'Assignee', type: 'string', join: 'users.name via ticket_assignments' },
    { field: 'created_at',     label: 'Created',  type: 'date' },
  ],
  measures: [
    { field: 'id',   label: 'Ticket Count', func: ['count'] },
    // Computed: resolution_time_hours = (resolved_at - created_at) / 3600
    { field: 'resolution_time_hours', label: 'Avg Resolution Time (hrs)', func: ['avg'], computed: true },
    { field: 'first_response_hours',  label: 'Avg First Response (hrs)',  func: ['avg'], computed: true },
  ],
  date_fields: ['created_at', 'resolved_at', 'closed_at', 'due_at'],
};
```

### 3.5 Accounting Module

```typescript
export const ACCOUNTING_INVOICES_MODULE = {
  module_id: 'accounting_invoices',
  label: 'Accounting — Invoices',
  primary_table: 'invoices',
  dimensions: [
    { field: 'status',   label: 'Status',   type: 'enum' },
    { field: 'type',     label: 'Type',     type: 'enum' },
    { field: 'currency', label: 'Currency', type: 'string' },
    { field: 'issue_date', label: 'Issue Date', type: 'date' },
  ],
  measures: [
    { field: 'id',           label: 'Invoice Count', func: ['count'] },
    { field: 'total',        label: 'Total',         func: ['sum', 'avg'] },
    { field: 'paid_amount',  label: 'Paid Amount',   func: ['sum'] },
    { field: 'tax_total',    label: 'Tax Total',     func: ['sum'] },
  ],
  date_fields: ['issue_date', 'due_date', 'paid_at', 'created_at'],
};
```

### 3.6 Inventory Module

```typescript
export const INVENTORY_PRODUCTS_MODULE = {
  module_id: 'inventory_products',
  label: 'Inventory — Products',
  primary_table: 'products',
  dimensions: [
    { field: 'type',        label: 'Type',       type: 'enum' },
    { field: 'is_active',   label: 'Active',     type: 'boolean' },
    { field: 'unit',        label: 'Unit',       type: 'string' },
    { field: 'category_name', label: 'Category', type: 'string', join: 'product_categories.name via product_category_map' },
  ],
  measures: [
    { field: 'id',         label: 'Product Count', func: ['count'] },
    { field: 'cost_price', label: 'Cost Price',    func: ['avg', 'sum', 'min', 'max'] },
    { field: 'sale_price', label: 'Sale Price',    func: ['avg', 'sum', 'min', 'max'] },
    { field: 'quantity',   label: 'Stock Qty',     func: ['sum'], join: 'stock_items' },
  ],
  date_fields: ['created_at', 'updated_at'],
};
```

### 3.7 Forms Module

```typescript
export const FORMS_SUBMISSIONS_MODULE = {
  module_id: 'forms_submissions',
  label: 'Forms — Submissions',
  primary_table: 'form_submissions',
  dimensions: [
    { field: 'approval_status', label: 'Approval Status', type: 'enum' },
    { field: 'submitter_type',  label: 'Submitter Type',  type: 'enum' },
    { field: 'form_title',      label: 'Form',            type: 'string', join: 'forms.title' },
    { field: 'financial_year',  label: 'Financial Year',  type: 'number' },
    { field: 'created_at',      label: 'Submitted Date',  type: 'date' },
  ],
  measures: [
    { field: 'id',       label: 'Submission Count', func: ['count'] },
  ],
  date_fields: ['created_at'],
};
```

### 3.8 Workflows Module

```typescript
export const WORKFLOWS_RUNS_MODULE = {
  module_id: 'workflow_runs',
  label: 'Workflows — Runs',
  primary_table: 'workflow_runs',
  dimensions: [
    { field: 'status',         label: 'Status',        type: 'enum' },
    { field: 'trigger_type',   label: 'Trigger Type',  type: 'enum' },
    { field: 'workflow_name',  label: 'Workflow',      type: 'string', join: 'workflows.name' },
    { field: 'started_at',     label: 'Start Date',    type: 'date' },
  ],
  measures: [
    { field: 'id',          label: 'Run Count',          func: ['count'] },
    { field: 'duration_ms', label: 'Avg Duration (ms)',  func: ['avg', 'min', 'max'] },
  ],
  date_fields: ['started_at', 'completed_at'],
};
```

---

## 4. File Structure

```
apps/web/src/
├── app/
│   ├── (dashboard)/
│   │   └── analytics/
│   │       ├── page.tsx                           # Analytics home — dashboard list
│   │       ├── explore/
│   │       │   └── page.tsx                       # Ad-hoc query explorer
│   │       ├── reports/
│   │       │   ├── page.tsx                       # Reports list
│   │       │   ├── new/
│   │       │   │   └── page.tsx                   # Report builder wizard
│   │       │   └── [reportId]/
│   │       │       ├── page.tsx                   # Report detail + run
│   │       │       └── edit/
│   │       │           └── page.tsx               # Edit report config
│   │       ├── dashboards/
│   │       │   ├── page.tsx                       # Dashboard list
│   │       │   ├── new/
│   │       │   │   └── page.tsx                   # New dashboard
│   │       │   └── [dashboardId]/
│   │       │       ├── page.tsx                   # Dashboard view (react-grid-layout)
│   │       │       └── edit/
│   │       │           └── page.tsx               # Dashboard layout editor
│   │       ├── scheduled/
│   │       │   └── page.tsx                       # Scheduled reports management
│   │       └── alerts/
│   │           └── page.tsx                       # Data alerts management
│   └── api/
│       └── analytics/
│           └── public/
│               └── [token]/
│                   └── route.ts                   # Public report endpoint
├── server/
│   └── routers/
│       └── analytics.ts                           # All tRPC procedures
├── lib/
│   └── analytics/
│       ├── query-builder.ts                       # Translates data_source JSON → SQL
│       ├── cache.ts                               # Redis cache for report results
│       ├── chart-transformer.ts                   # Shapes raw SQL rows → chart series
│       ├── export/
│       │   ├── pdf-exporter.ts                    # Puppeteer PDF generation
│       │   ├── excel-exporter.ts                  # xlsx workbook generation
│       │   └── csv-exporter.ts                    # CSV streaming
│       ├── modules/
│       │   ├── crm.ts
│       │   ├── projects.ts
│       │   ├── hr.ts
│       │   ├── helpdesk.ts
│       │   ├── accounting.ts
│       │   ├── inventory.ts
│       │   ├── forms.ts
│       │   └── workflows.ts
│       └── alert-checker.ts                       # BullMQ worker: evaluates alert conditions
├── workers/
│   ├── analytics-scheduled.worker.ts              # Runs scheduled reports + sends email
│   └── analytics-alerts.worker.ts                 # Checks data alerts on a schedule
└── components/
    └── analytics/
        ├── ReportBuilder/
        │   ├── ReportBuilder.tsx                  # Main wizard (data source → viz → preview)
        │   ├── ModulePicker.tsx                   # Module selector dropdown
        │   ├── DimensionMeasurePicker.tsx         # Drag dimensions/measures to query
        │   ├── FilterBuilder.tsx                  # Add/edit filter conditions
        │   ├── DateFilterPicker.tsx               # Date range / preset picker
        │   ├── SortBuilder.tsx                    # Sort field configuration
        │   └── VisualizationPicker.tsx            # Chart type selector + axis mapping
        ├── charts/
        │   ├── LineChart.tsx                      # Recharts LineChart wrapper
        │   ├── BarChart.tsx                       # Recharts BarChart wrapper
        │   ├── PieChart.tsx                       # Recharts PieChart wrapper
        │   ├── AreaChart.tsx
        │   ├── FunnelChart.tsx
        │   ├── HeatmapChart.tsx
        │   ├── KpiWidget.tsx                      # Single metric with trend
        │   ├── PivotTable.tsx                     # Pivot table component
        │   └── DataTable.tsx                      # Sortable table with pagination
        ├── Dashboard/
        │   ├── DashboardGrid.tsx                  # react-grid-layout canvas
        │   ├── DashboardWidget.tsx                # Single widget wrapper
        │   └── AddWidgetModal.tsx                 # Report picker modal
        └── shared/
            ├── DatePresetPicker.tsx
            └── ExportMenu.tsx
```

---

## 5. tRPC Router — All Procedures

```typescript
// apps/web/src/server/routers/analytics.ts

export const analyticsRouter = createTRPCRouter({

  // ── Reports ─────────────────────────────────────────────────────────────────

  reports: {
    list: orgProcedure
      .input(z.object({ page: z.number(), tags: z.string().array().optional(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => { /* paginated list */ }),

    get: orgProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => { /* ... */ }),

    create: orgProcedure
      .input(ReportCreateSchema)
      .mutation(async ({ ctx, input }) => { /* ... */ }),

    update: orgProcedure
      .input(ReportUpdateSchema)
      .mutation(async ({ ctx, input }) => { /* ... */ }),

    delete: orgProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => { /* ... */ }),

    /**
     * Execute the report query. Returns rows + metadata.
     * Checks Redis cache first (key: analytics:report:{id}:{hash(filters)})
     * Cache TTL: 5 minutes for live reports, 1 hour for scheduled snapshots.
     */
    run: orgProcedure
      .input(z.object({ id: z.string(), override_filters: z.any().optional() }))
      .query(async ({ ctx, input }) => {
        const cacheKey = `analytics:report:${input.id}:${hashFilters(input.override_filters)}`;
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const report = await prisma.analyticsReport.findUniqueOrThrow({ where: { id: input.id } });
        const start = Date.now();
        const rows = await queryBuilder.execute(report.data_source as DataSourceConfig, ctx.org.id);
        const duration = Date.now() - start;

        await prisma.analyticsReport.update({
          where: { id: input.id },
          data: { last_run_at: new Date(), last_run_duration_ms: duration },
        });

        const result = { rows, meta: { duration_ms: duration, row_count: rows.length } };
        await redis.setex(cacheKey, 300, JSON.stringify(result)); // 5 min TTL
        return result;
      }),
  },

  // ── Dashboards ───────────────────────────────────────────────────────────────

  dashboards: {
    list: orgProcedure.input(z.object({ scope: z.nativeEnum(DashboardScope).optional() })).query(async ({ ctx, input }) => { /* ... */ }),
    get: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => { /* ... */ }),
    create: orgProcedure.input(DashboardCreateSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
    update: orgProcedure.input(DashboardUpdateSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
    delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    /** Save react-grid-layout position array. */
    saveLayout: orgProcedure
      .input(z.object({ id: z.string(), items: z.array(DashboardItemLayoutSchema) }))
      .mutation(async ({ ctx, input }) => { /* upsert AnalyticsDashboardItem positions */ }),
    addWidget: orgProcedure
      .input(z.object({ dashboardId: z.string(), reportId: z.string(), grid: GridPositionSchema }))
      .mutation(async ({ ctx, input }) => { /* ... */ }),
    removeWidget: orgProcedure
      .input(z.object({ itemId: z.string() }))
      .mutation(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── Scheduled Reports ───────────────────────────────────────────────────────

  scheduled: {
    list: orgProcedure.query(async ({ ctx }) => { /* ... */ }),
    create: orgProcedure.input(ScheduledReportSchema).mutation(async ({ ctx, input }) => {
      /* Create record + compute next_send_at using cronstrue/cron lib */
    }),
    update: orgProcedure.input(ScheduledReportSchema.partial().extend({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    /** Manually trigger a scheduled report send. */
    sendNow: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── Alerts ──────────────────────────────────────────────────────────────────

  alerts: {
    list: orgProcedure.query(async ({ ctx }) => { /* ... */ }),
    create: orgProcedure.input(AlertCreateSchema).mutation(async ({ ctx, input }) => { /* ... */ }),
    update: orgProcedure.input(AlertCreateSchema.partial().extend({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { /* ... */ }),
    toggle: orgProcedure.input(z.object({ id: z.string(), active: z.boolean() })).mutation(async ({ ctx, input }) => { /* ... */ }),
  },

  // ── Ad-hoc Explore ──────────────────────────────────────────────────────────

  explore: orgProcedure
    .input(z.object({ data_source: DataSourceConfigSchema, limit: z.number().max(1000).default(100) }))
    .query(async ({ ctx, input }) => {
      // No caching for ad-hoc queries — direct execution
      return queryBuilder.execute(input.data_source, ctx.org.id, input.limit);
    }),

  // ── Export ──────────────────────────────────────────────────────────────────

  export: orgProcedure
    .input(z.object({ reportId: z.string(), format: z.nativeEnum(ExportFormat) }))
    .mutation(async ({ ctx, input }) => {
      /* Run report, generate file, upload to S3, return signed URL */
    }),
});
```

---

## 6. Business Logic

### 6.1 Query Builder — data_source → Parameterized SQL

```typescript
// apps/web/src/lib/analytics/query-builder.ts

import { prisma } from '@db';
import { getModuleDefinition } from './modules';

export async function executeQuery(
  config: DataSourceConfig,
  orgId: string,
  limitOverride?: number
): Promise<Record<string, unknown>[]> {
  const moduleDef = getModuleDefinition(config.module);
  if (!moduleDef) throw new Error(`Unknown module: ${config.module}`);

  const selects: string[] = [];
  const groupByCols: string[] = [];

  // Build SELECT for dimensions
  for (const dim of config.dimensions) {
    const dimDef = moduleDef.dimensions.find(d => d.field === dim.field);
    if (!dimDef) continue;

    if (config.group_by_date_trunc && dimDef.type === 'date') {
      selects.push(`DATE_TRUNC('${config.group_by_date_trunc}', ${moduleDef.primary_table}.${dim.field}) AS "${dim.alias ?? dim.field}"`);
      groupByCols.push(`DATE_TRUNC('${config.group_by_date_trunc}', ${moduleDef.primary_table}.${dim.field})`);
    } else {
      const col = dimDef.join ? resolveJoinColumn(dimDef.join) : `${moduleDef.primary_table}.${dim.field}`;
      selects.push(`${col} AS "${dim.alias ?? dim.field}"`);
      groupByCols.push(col);
    }
  }

  // Build SELECT for measures
  for (const measure of config.measures) {
    const mDef = moduleDef.measures.find(m => m.field === measure.field);
    if (!mDef) continue;
    if (mDef.computed) {
      selects.push(buildComputedMeasure(mDef.field, measure.func, moduleDef.primary_table, measure.alias));
    } else {
      selects.push(`${measure.func.toUpperCase()}(${moduleDef.primary_table}.${measure.field}) AS "${measure.alias ?? measure.field}"`);
    }
  }

  // WHERE clauses
  const whereClauses: string[] = [`${moduleDef.primary_table}.organization_id = '${orgId}'`];
  for (const filter of (config.filters ?? [])) {
    whereClauses.push(buildFilterClause(filter, moduleDef.primary_table));
  }
  if (config.date_filter) {
    whereClauses.push(buildDateFilter(config.date_filter, moduleDef.primary_table));
  }

  // Soft-delete exclusion
  if (hasDeletedAt(moduleDef.primary_table)) {
    whereClauses.push(`${moduleDef.primary_table}.deleted_at IS NULL`);
  }

  const orderBy = config.sort?.map(s => `"${s.field}" ${s.direction}`).join(', ') ?? '';
  const limit = Math.min(limitOverride ?? config.limit ?? 100, 10000);

  const sql = `
    SELECT ${selects.join(', ')}
    FROM ${moduleDef.primary_table}
    ${buildJoins(config, moduleDef)}
    WHERE ${whereClauses.join(' AND ')}
    ${groupByCols.length ? `GROUP BY ${groupByCols.join(', ')}` : ''}
    ${orderBy ? `ORDER BY ${orderBy}` : ''}
    LIMIT ${limit}
  `;

  return prisma.$queryRawUnsafe(sql) as Promise<Record<string, unknown>[]>;
}
```

### 6.2 Chart Data Transformer

```typescript
// apps/web/src/lib/analytics/chart-transformer.ts

export function transformToChartSeries(
  rows: Record<string, unknown>[],
  config: VisualizationConfig
) {
  if (config.chart_type === 'pie' || config.chart_type === 'donut') {
    return rows.map(row => ({
      name: String(row[config.x_axis] ?? 'Unknown'),
      value: Number(row[config.y_axis] ?? 0),
    }));
  }

  if (config.group_by) {
    // Multi-series — group by color field
    const groups = [...new Set(rows.map(r => String(r[config.group_by!])))];
    const xValues = [...new Set(rows.map(r => String(r[config.x_axis])))];
    return xValues.map(x => {
      const point: Record<string, unknown> = { name: x };
      for (const g of groups) {
        const match = rows.find(r => String(r[config.x_axis]) === x && String(r[config.group_by!]) === g);
        point[g] = match ? Number(match[config.y_axis] ?? 0) : 0;
      }
      return point;
    });
  }

  return rows.map(row => ({
    name: String(row[config.x_axis] ?? ''),
    value: Number(row[config.y_axis] ?? 0),
  }));
}
```

### 6.3 Scheduled Report BullMQ Worker

```typescript
// apps/web/src/workers/analytics-scheduled.worker.ts

import { Worker } from 'bullmq';
import { redis } from '@/lib/redis';

// Cron job (separate scheduler process) enqueues jobs for due reports every minute.
// BullMQ job data: { scheduledReportId }

const worker = new Worker('analytics-scheduled', async (job) => {
  const schedule = await prisma.analyticsScheduledReport.findUniqueOrThrow({
    where: { id: job.data.scheduledReportId },
    include: { report: true },
  });

  // Run the report
  const rows = schedule.report_id
    ? await executeQuery(schedule.report!.data_source as DataSourceConfig, schedule.organization_id)
    : [];

  // Generate file
  let fileBuffer: Buffer;
  let mimeType: string;
  let filename: string;

  if (schedule.format === 'pdf') {
    fileBuffer = await generatePdfReport(rows, schedule.report!);
    mimeType = 'application/pdf';
    filename = `${schedule.name}.pdf`;
  } else if (schedule.format === 'excel') {
    fileBuffer = await generateExcelReport(rows, schedule.report!);
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    filename = `${schedule.name}.xlsx`;
  } else {
    fileBuffer = Buffer.from(generateCsvReport(rows));
    mimeType = 'text/csv';
    filename = `${schedule.name}.csv`;
  }

  // Send email to recipients
  await sendEmail({
    to: schedule.recipients,
    subject: `ZenFlow Report: ${schedule.name}`,
    html: `<p>Please find the scheduled report attached.</p>`,
    attachments: [{ filename, content: fileBuffer, contentType: mimeType }],
  });

  // Update last_sent_at and compute next_send_at
  const nextSend = computeNextSendAt(schedule);
  await prisma.analyticsScheduledReport.update({
    where: { id: schedule.id },
    data: { last_sent_at: new Date(), next_send_at: nextSend },
  });
}, { connection: redis });
```

### 6.4 Data Alert Checker

```typescript
// apps/web/src/workers/analytics-alerts.worker.ts
// Runs every 15 minutes via BullMQ repeat job

import { Worker } from 'bullmq';

const worker = new Worker('analytics-alerts', async () => {
  const activeAlerts = await prisma.analyticsDataAlert.findMany({
    where: { is_active: true },
    include: { report: true },
  });

  for (const alert of activeAlerts) {
    const rows = await executeQuery(alert.report.data_source as DataSourceConfig, alert.organization_id);
    const value = extractMetricValue(rows, alert.metric_path);
    const triggered = evaluateAlertCondition(value, alert.operator as AlertOperator, Number(alert.threshold));

    if (triggered) {
      await notifyAlertChannels(alert, value);
      await prisma.analyticsDataAlert.update({
        where: { id: alert.id },
        data: { last_triggered_at: new Date(), last_value: value },
      });
    }
  }
}, { connection: redis });

function evaluateAlertCondition(value: number, op: AlertOperator, threshold: number): boolean {
  switch (op) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'change_pct_up': return value > threshold; // threshold = % change
    case 'change_pct_down': return value < -threshold;
    default: return false;
  }
}
```

### 6.5 Redis Caching Strategy

```typescript
// apps/web/src/lib/analytics/cache.ts

const CACHE_TTL_SECONDS = {
  live_report: 300,          // 5 minutes
  scheduled_snapshot: 3600,  // 1 hour
  dashboard: 60,             // 1 minute (dashboard runs all widgets)
  explore: 0,                // no cache
};

export function buildCacheKey(reportId: string, orgId: string, overrideFilters?: unknown): string {
  const filterHash = overrideFilters
    ? crypto.createHash('md5').update(JSON.stringify(overrideFilters)).digest('hex').slice(0, 8)
    : 'default';
  return `analytics:report:${orgId}:${reportId}:${filterHash}`;
}

export async function bustReportCache(reportId: string, orgId: string): Promise<void> {
  const pattern = `analytics:report:${orgId}:${reportId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}
```

---

## 7. KPI Widget — Comparison Logic

For `report_type = kpi`, the widget shows a single metric value with a comparison to the previous period.

```typescript
export async function runKpiReport(report: AnalyticsReport, orgId: string) {
  const config = report.data_source as DataSourceConfig;
  const vizConfig = report.visualization_config as VisualizationConfig;

  // Current period
  const currentRows = await executeQuery(config, orgId);
  const currentValue = Number(currentRows[0]?.[config.measures[0].alias ?? config.measures[0].field] ?? 0);

  let prevValue: number | null = null;
  if (vizConfig.kpi_comparison_period) {
    const prevConfig = shiftDateFilter(config, vizConfig.kpi_comparison_period);
    const prevRows = await executeQuery(prevConfig, orgId);
    prevValue = Number(prevRows[0]?.[config.measures[0].alias ?? config.measures[0].field] ?? 0);
  }

  const changePct = prevValue !== null && prevValue !== 0
    ? ((currentValue - prevValue) / prevValue) * 100
    : null;

  return { value: currentValue, prev_value: prevValue, change_pct: changePct };
}
```

---

## 8. npm Packages

```json
{
  "dependencies": {
    "recharts": "^2.12.0",
    "react-grid-layout": "^1.4.4",
    "bullmq": "^5.8.0",
    "ioredis": "^5.3.2",
    "puppeteer": "^22.0.0",
    "xlsx": "^0.18.5",
    "zod": "^3.23.0",
    "@tanstack/react-table": "^8.17.0",
    "date-fns": "^3.6.0",
    "cronstrue": "^2.50.0"
  },
  "devDependencies": {
    "@types/react-grid-layout": "^1.3.5"
  }
}
```

---

## 9. Public Report Sharing

When `is_public = true` and `public_token` is set:

- URL: `https://app.zenflow.io/analytics/public/{public_token}`
- No authentication required
- `public_token` is a 64-char random hex string generated on first publish
- Token is served via `/api/analytics/public/[token]/route.ts` which runs the report without `organization_id` auth check (the token implicitly scopes to the org)
- Rate limited: 60 requests per minute per IP via Redis rolling window (same pattern as Forms v2)

---

## 10. Cohort Analysis

For `report_type = cohort`, the system computes a retention matrix:

```typescript
// Cohort query: group users by first_action_week, then count returning users per week offset
export async function runCohortReport(config: DataSourceConfig, orgId: string) {
  const sql = `
    WITH cohorts AS (
      SELECT
        DATE_TRUNC('week', first_event.created_at) AS cohort_week,
        first_event.user_id
      FROM ${config.primary_table} first_event
      WHERE first_event.organization_id = '${orgId}'
    ),
    activity AS (
      SELECT
        c.cohort_week,
        c.user_id,
        EXTRACT(WEEK FROM AGE(a.created_at, c.cohort_week))::int AS week_offset
      FROM cohorts c
      JOIN ${config.primary_table} a ON a.user_id = c.user_id
      WHERE a.organization_id = '${orgId}'
    )
    SELECT
      cohort_week::date AS "Cohort",
      week_offset AS "Week",
      COUNT(DISTINCT user_id) AS "Users"
    FROM activity
    GROUP BY cohort_week, week_offset
    ORDER BY cohort_week, week_offset
  `;
  return prisma.$queryRawUnsafe(sql);
}
```

---

## 11. Funnel Analysis

For `report_type = funnel`, stages are defined in `visualization_config.funnel_stages`:

```json
{
  "funnel_stages": [
    { "label": "Lead Created",   "module": "crm_leads",    "count_field": "id" },
    { "label": "Lead Qualified", "module": "crm_leads",    "count_field": "id", "filter": { "status": "QUALIFIED" } },
    { "label": "Deal Created",   "module": "crm_deals",    "count_field": "id" },
    { "label": "Deal Won",       "module": "crm_deals",    "count_field": "id", "filter": { "status": "WON" } }
  ]
}
```

Each stage runs a separate count query. Conversion rates are computed as `(stage_n / stage_n-1) * 100`.
