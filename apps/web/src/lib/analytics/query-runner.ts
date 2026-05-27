// Analytics Query Runner
// Translates a structured AnalyticsQuery config into parameterized Prisma raw SQL
// Data sources: crm_deals, crm_contacts, crm_leads, projects_tasks, hr_employees,
//               hr_leave, helpdesk_tickets, accounting_invoices, inventory_products,
//               forms_submissions, workflow_runs

export type AnalyticsQuery = {
  dataSource: string;
  dimensions: string[];
  measures: { field: string; aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' }[];
  filters: { field: string; operator: string; value: unknown }[];
  dateRange: { field: string; from: string; to: string };
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
};

export type ModuleDefinition = {
  module_id: string;
  label: string;
  primary_table: string;
  dimensions: Array<{
    field: string;
    label: string;
    type: string;
    join?: string;
  }>;
  measures: Array<{
    field: string;
    label: string;
    func: string[];
    computed?: boolean;
  }>;
  date_fields: string[];
};

export const DATA_SOURCE_MODULES: ModuleDefinition[] = [
  {
    module_id: 'crm_deals',
    label: 'CRM — Deals',
    primary_table: 'crm_deals',
    dimensions: [
      { field: 'status', label: 'Deal Status', type: 'enum' },
      { field: 'currency', label: 'Currency', type: 'string' },
      { field: 'stage_name', label: 'Pipeline Stage', type: 'string', join: 'crm_pipeline_stages.name' },
      { field: 'pipeline_name', label: 'Pipeline', type: 'string', join: 'crm_pipelines.name' },
      { field: 'assignee_name', label: 'Assigned To', type: 'string', join: 'users.name' },
      { field: 'created_at', label: 'Created Date', type: 'date' },
      { field: 'expected_close', label: 'Close Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Deal Count', func: ['count'] },
      { field: 'value', label: 'Deal Value', func: ['sum', 'avg', 'min', 'max'] },
      { field: 'probability', label: 'Probability', func: ['avg'] },
    ],
    date_fields: ['created_at', 'expected_close', 'closed_at'],
  },
  {
    module_id: 'crm_contacts',
    label: 'CRM — Contacts',
    primary_table: 'crm_contacts',
    dimensions: [
      { field: 'status', label: 'Status', type: 'enum' },
      { field: 'source', label: 'Source', type: 'string' },
      { field: 'country', label: 'Country', type: 'string' },
      { field: 'city', label: 'City', type: 'string' },
      { field: 'created_at', label: 'Created Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Contact Count', func: ['count'] },
    ],
    date_fields: ['created_at', 'updated_at'],
  },
  {
    module_id: 'crm_leads',
    label: 'CRM — Leads',
    primary_table: 'crm_leads',
    dimensions: [
      { field: 'status', label: 'Lead Status', type: 'enum' },
      { field: 'source', label: 'Source', type: 'enum' },
      { field: 'created_at', label: 'Created Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Lead Count', func: ['count'] },
      { field: 'estimated_value', label: 'Est. Value', func: ['sum', 'avg'] },
      { field: 'score', label: 'Lead Score', func: ['avg', 'sum'] },
    ],
    date_fields: ['created_at', 'converted_at'],
  },
  {
    module_id: 'projects_tasks',
    label: 'Projects — Tasks',
    primary_table: 'tasks',
    dimensions: [
      { field: 'status', label: 'Task Status', type: 'enum' },
      { field: 'priority', label: 'Priority', type: 'enum' },
      { field: 'type', label: 'Task Type', type: 'enum' },
      { field: 'created_at', label: 'Created Date', type: 'date' },
      { field: 'due_date', label: 'Due Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Task Count', func: ['count'] },
      { field: 'story_points', label: 'Story Points', func: ['sum', 'avg'] },
      { field: 'estimated_hours', label: 'Estimated Hours', func: ['sum', 'avg'] },
    ],
    date_fields: ['created_at', 'due_date', 'completed_at'],
  },
  {
    module_id: 'hr_employees',
    label: 'HR — Employees',
    primary_table: 'employees',
    dimensions: [
      { field: 'status', label: 'Status', type: 'enum' },
      { field: 'employment_type', label: 'Employment Type', type: 'enum' },
      { field: 'gender', label: 'Gender', type: 'enum' },
      { field: 'designation', label: 'Designation', type: 'string' },
      { field: 'join_date', label: 'Join Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Headcount', func: ['count'] },
      { field: 'salary', label: 'Salary', func: ['sum', 'avg', 'min', 'max'] },
    ],
    date_fields: ['join_date', 'created_at'],
  },
  {
    module_id: 'hr_leave',
    label: 'HR — Leave Requests',
    primary_table: 'leave_requests',
    dimensions: [
      { field: 'status', label: 'Status', type: 'enum' },
      { field: 'from_date', label: 'From Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Request Count', func: ['count'] },
      { field: 'days', label: 'Days', func: ['sum', 'avg'] },
    ],
    date_fields: ['from_date', 'to_date', 'created_at'],
  },
  {
    module_id: 'helpdesk_tickets',
    label: 'Help Desk — Tickets',
    primary_table: 'tickets',
    dimensions: [
      { field: 'status', label: 'Status', type: 'enum' },
      { field: 'priority', label: 'Priority', type: 'enum' },
      { field: 'type', label: 'Type', type: 'enum' },
      { field: 'channel', label: 'Channel', type: 'enum' },
      { field: 'created_at', label: 'Created', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Ticket Count', func: ['count'] },
    ],
    date_fields: ['created_at', 'resolved_at', 'closed_at'],
  },
  {
    module_id: 'accounting_invoices',
    label: 'Accounting — Invoices',
    primary_table: 'invoices',
    dimensions: [
      { field: 'status', label: 'Status', type: 'enum' },
      { field: 'type', label: 'Type', type: 'enum' },
      { field: 'currency', label: 'Currency', type: 'string' },
      { field: 'issue_date', label: 'Issue Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Invoice Count', func: ['count'] },
      { field: 'total', label: 'Total', func: ['sum', 'avg'] },
      { field: 'paid_amount', label: 'Paid Amount', func: ['sum'] },
      { field: 'tax_total', label: 'Tax Total', func: ['sum'] },
    ],
    date_fields: ['issue_date', 'due_date', 'paid_at', 'created_at'],
  },
  {
    module_id: 'inventory_products',
    label: 'Inventory — Products',
    primary_table: 'products',
    dimensions: [
      { field: 'type', label: 'Type', type: 'enum' },
      { field: 'is_active', label: 'Active', type: 'boolean' },
      { field: 'unit', label: 'Unit', type: 'string' },
    ],
    measures: [
      { field: 'id', label: 'Product Count', func: ['count'] },
      { field: 'cost_price', label: 'Cost Price', func: ['avg', 'sum', 'min', 'max'] },
      { field: 'sale_price', label: 'Sale Price', func: ['avg', 'sum', 'min', 'max'] },
    ],
    date_fields: ['created_at', 'updated_at'],
  },
  {
    module_id: 'forms_submissions',
    label: 'Forms — Submissions',
    primary_table: 'form_submissions',
    dimensions: [
      { field: 'approval_status', label: 'Approval Status', type: 'enum' },
      { field: 'created_at', label: 'Submitted Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Submission Count', func: ['count'] },
    ],
    date_fields: ['created_at'],
  },
  {
    module_id: 'workflow_runs',
    label: 'Workflows — Runs',
    primary_table: 'workflow_runs',
    dimensions: [
      { field: 'status', label: 'Status', type: 'enum' },
      { field: 'trigger_type', label: 'Trigger Type', type: 'enum' },
      { field: 'started_at', label: 'Start Date', type: 'date' },
    ],
    measures: [
      { field: 'id', label: 'Run Count', func: ['count'] },
      { field: 'duration_ms', label: 'Avg Duration (ms)', func: ['avg', 'min', 'max'] },
    ],
    date_fields: ['started_at', 'completed_at'],
  },
];

function getModuleDefinition(moduleId: string): ModuleDefinition | undefined {
  return DATA_SOURCE_MODULES.find((m) => m.module_id === moduleId);
}

// Tables known to have deleted_at soft-delete column
const SOFT_DELETE_TABLES = new Set([
  'crm_deals', 'crm_contacts', 'crm_leads', 'tasks', 'projects',
  'tickets', 'invoices', 'employees', 'products',
]);

function sanitizeIdentifier(name: string): string {
  // Allow only alphanumeric and underscore to prevent SQL injection
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

function buildFilterClause(
  filter: { field: string; operator: string; value: unknown },
  tableName: string
): string {
  const col = `${sanitizeIdentifier(tableName)}.${sanitizeIdentifier(filter.field)}`;
  const val = filter.value;
  const strVal = typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : String(val);

  switch (filter.operator) {
    case 'eq': return `${col} = ${strVal}`;
    case 'neq': return `${col} != ${strVal}`;
    case 'gt': return `${col} > ${strVal}`;
    case 'lt': return `${col} < ${strVal}`;
    case 'gte': return `${col} >= ${strVal}`;
    case 'lte': return `${col} <= ${strVal}`;
    case 'like': return `${col} ILIKE '%${String(val).replace(/'/g, "''")}%'`;
    case 'in': return `${col} = ANY(ARRAY[${(val as string[]).map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')}])`;
    case 'is_null': return `${col} IS NULL`;
    case 'is_not_null': return `${col} IS NOT NULL`;
    default: return `${col} = ${strVal}`;
  }
}

export async function runAnalyticsQuery(
  prisma: { $queryRawUnsafe: (sql: string) => Promise<unknown[]> },
  orgId: string,
  query: AnalyticsQuery
): Promise<Record<string, unknown>[]> {
  const moduleDef = getModuleDefinition(query.dataSource);
  if (!moduleDef) {
    throw new Error(`Unknown data source: ${query.dataSource}`);
  }

  const table = sanitizeIdentifier(moduleDef.primary_table);
  const safeOrgId = orgId.replace(/[^a-zA-Z0-9-]/g, '');

  const selects: string[] = [];
  const groupByCols: string[] = [];

  // Build SELECT for dimensions
  for (const dimField of query.dimensions) {
    const dimDef = moduleDef.dimensions.find((d) => d.field === dimField);
    if (!dimDef) continue;
    const safeField = sanitizeIdentifier(dimDef.field);
    const col = `${table}.${safeField}`;
    selects.push(`${col} AS "${safeField}"`);
    groupByCols.push(col);
  }

  // Build SELECT for measures
  for (const measure of query.measures) {
    const mDef = moduleDef.measures.find((m) => m.field === measure.field);
    if (!mDef) continue;
    const safeField = sanitizeIdentifier(measure.field);
    const agg = measure.aggregation.toUpperCase();
    selects.push(`${agg}(${table}.${safeField}) AS "${agg.toLowerCase()}_${safeField}"`);
  }

  if (selects.length === 0) {
    selects.push(`COUNT(${table}.id) AS "count_id"`);
  }

  // WHERE clauses
  const whereClauses: string[] = [
    `${table}.organization_id = '${safeOrgId}'`,
  ];

  // Date range filter
  if (query.dateRange) {
    const safeDateField = sanitizeIdentifier(query.dateRange.field);
    const fromDate = query.dateRange.from.replace(/[^0-9T:.Z-]/g, '');
    const toDate = query.dateRange.to.replace(/[^0-9T:.Z-]/g, '');
    whereClauses.push(`${table}.${safeDateField} >= '${fromDate}'`);
    whereClauses.push(`${table}.${safeDateField} <= '${toDate}'`);
  }

  // Additional filters
  for (const filter of query.filters) {
    try {
      whereClauses.push(buildFilterClause(filter, table));
    } catch {
      // Skip malformed filters
    }
  }

  // Soft-delete exclusion
  if (SOFT_DELETE_TABLES.has(moduleDef.primary_table)) {
    whereClauses.push(`${table}.deleted_at IS NULL`);
  }

  // ORDER BY
  let orderByClause = '';
  if (query.orderBy) {
    const safeField = sanitizeIdentifier(query.orderBy.field);
    const dir = query.orderBy.direction === 'desc' ? 'DESC' : 'ASC';
    orderByClause = `ORDER BY "${safeField}" ${dir}`;
  }

  const limit = Math.min(query.limit ?? 100, 10000);

  const sql = [
    `SELECT ${selects.join(', ')}`,
    `FROM ${table}`,
    `WHERE ${whereClauses.join(' AND ')}`,
    groupByCols.length > 0 ? `GROUP BY ${groupByCols.join(', ')}` : '',
    orderByClause,
    `LIMIT ${limit}`,
  ].filter(Boolean).join('\n');

  const rows = await prisma.$queryRawUnsafe(sql);
  return rows as Record<string, unknown>[];
}
