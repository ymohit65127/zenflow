// Internal event bus for ZenFlow events
// Other modules emit events that can trigger workflows with TRIGGER_EVENT

import { prisma } from '@zenflow/db';

type EventTriggerConfig = {
  event_name: string;
  filters?: Array<{ field: string; op: string; value: unknown }>;
};

function evaluateTriggerFilters(
  filters: Array<{ field: string; op: string; value: unknown }>,
  payload: Record<string, unknown>
): boolean {
  if (!filters || filters.length === 0) return true;

  return filters.every((filter) => {
    const fieldVal = payload[filter.field];
    switch (filter.op) {
      case 'eq': return fieldVal == filter.value;
      case 'neq': return fieldVal != filter.value;
      case 'gt': return Number(fieldVal) > Number(filter.value);
      case 'lt': return Number(fieldVal) < Number(filter.value);
      case 'gte': return Number(fieldVal) >= Number(filter.value);
      case 'lte': return Number(fieldVal) <= Number(filter.value);
      case 'contains': return String(fieldVal).includes(String(filter.value));
      case 'in':
        return Array.isArray(filter.value)
          ? (filter.value as unknown[]).includes(fieldVal)
          : false;
      case 'is_null': return fieldVal == null;
      case 'is_not_null': return fieldVal != null;
      default: return true;
    }
  });
}

export const zenflowEvents = {
  emit: async (
    eventName: string,
    orgId: string,
    data: Record<string, unknown>
  ): Promise<void> => {
    // Find all active workflows triggered by this event for this org
    const workflows = await prisma.workflowV2.findMany({
      where: {
        organization_id: orgId,
        status: 'active',
        trigger_type: 'event',
      },
      select: { id: true, trigger_config: true },
    });

    const matchedWorkflowIds: string[] = [];

    for (const wf of workflows) {
      const config = wf.trigger_config as EventTriggerConfig;
      if (config.event_name !== eventName) continue;

      const passes = evaluateTriggerFilters(config.filters ?? [], data);

      // Log trigger
      await prisma.workflowTriggerLog.create({
        data: {
          workflow_id: wf.id,
          trigger_type: 'event',
          trigger_data: data as object,
          matched: passes,
        },
      });

      if (passes) {
        matchedWorkflowIds.push(wf.id);
      }
    }

    // Create WorkflowRun records for matched workflows
    if (matchedWorkflowIds.length > 0) {
      await prisma.workflowV2Run.createMany({
        data: matchedWorkflowIds.map((workflowId) => ({
          workflow_id: workflowId,
          workflow_version: 1,
          trigger_type: 'event' as const,
          trigger_data: data as object,
          status: 'running' as const,
        })),
      });

      // In production, we would enqueue these to BullMQ here.
      // For now, runs are created with 'running' status and processed by the worker.
    }
  },
};

// Standard event name constants
export const WORKFLOW_EVENTS = {
  // CRM
  CRM_DEAL_CREATED: 'crm.deal.created',
  CRM_DEAL_UPDATED: 'crm.deal.updated',
  CRM_DEAL_STAGE_CHANGED: 'crm.deal.stage_changed',
  CRM_LEAD_CREATED: 'crm.lead.created',
  CRM_CONTACT_CREATED: 'crm.contact.created',

  // Projects
  PROJECT_TASK_CREATED: 'project.task.created',
  PROJECT_TASK_COMPLETED: 'project.task.completed',
  PROJECT_TASK_OVERDUE: 'project.task.overdue',

  // HR
  HR_LEAVE_SUBMITTED: 'hr.leave.submitted',
  HR_LEAVE_APPROVED: 'hr.leave.approved',
  HR_LEAVE_REJECTED: 'hr.leave.rejected',
  HR_EMPLOYEE_ONBOARDED: 'hr.employee.onboarded',

  // Help Desk
  HELPDESK_TICKET_OPENED: 'helpdesk.ticket.opened',
  HELPDESK_TICKET_RESOLVED: 'helpdesk.ticket.resolved',
  HELPDESK_TICKET_ASSIGNED: 'helpdesk.ticket.assigned',

  // Forms
  FORM_SUBMITTED: 'form.submitted',
  FORM_APPROVED: 'form.approved',
  FORM_REJECTED: 'form.rejected',

  // Accounting
  ACCOUNTING_INVOICE_SENT: 'accounting.invoice.sent',
  ACCOUNTING_INVOICE_PAID: 'accounting.invoice.paid',
  ACCOUNTING_INVOICE_OVERDUE: 'accounting.invoice.overdue',
} as const;
