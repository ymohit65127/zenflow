// @ts-nocheck
// Core workflow execution logic
// Traverses the workflow graph node by node.
// For each node type, executes the appropriate action.
// Logs each step to WorkflowRunStep.
// Handles: conditions (branch), delays (schedule next step), approvals (pause + email),
//          HTTP actions, email actions, record create/update.

import type { PrismaClient } from '@zenflow/db';
import { interpolate } from './template-interpolation';
import { assertSafeUrl } from '@/lib/ssrf-guard';

export type WorkflowNode = {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
};

export type ExecutionContext = {
  run_id: string;
  workflow_id: string;
  org_id: string;
  trigger: Record<string, unknown>;
  steps: Record<string, { output: Record<string, unknown> }>;
  _orgId: string;
};

// Signal class to pause the run without marking it as failed
export class WorkflowPauseSignal extends Error {
  constructor(public readonly reason: 'delay' | 'approval') {
    super(`PAUSE:${reason}`);
    this.name = 'WorkflowPauseSignal';
  }
}

async function executeNodeAction(
  node: WorkflowNode,
  context: ExecutionContext,
  prisma: PrismaClient
): Promise<{ output: Record<string, unknown>; nextHandle?: string }> {
  const config = interpolate(node.config, context) as Record<string, unknown>;

  switch (node.type) {
    case 'trigger_event':
    case 'trigger_schedule':
    case 'trigger_webhook':
    case 'trigger_manual':
    case 'trigger_api':
      return { output: context.trigger };

    case 'condition': {
      const rules = (config.rules as Array<{ field: string; op: string; value: unknown }>) ?? [];
      const logic = (config.logic as string) ?? 'ALL';
      const results = rules.map((rule) => {
        const fieldVal = rule.field;
        const threshold = rule.value;
        switch (rule.op) {
          case 'eq': return fieldVal == threshold;
          case 'neq': return fieldVal != threshold;
          case 'gt': return Number(fieldVal) > Number(threshold);
          case 'lt': return Number(fieldVal) < Number(threshold);
          case 'gte': return Number(fieldVal) >= Number(threshold);
          case 'lte': return Number(fieldVal) <= Number(threshold);
          case 'contains': return String(fieldVal).includes(String(threshold));
          case 'is_null': return fieldVal == null;
          case 'is_not_null': return fieldVal != null;
          default: return false;
        }
      });
      const passed = logic === 'ALL' ? results.every(Boolean) : results.some(Boolean);
      return { output: { result: passed }, nextHandle: passed ? 'true' : 'false' };
    }

    case 'delay': {
      const amount = Number(config.amount ?? 0);
      const unit = (config.unit as string) ?? 'minutes';
      const ms = unit === 'minutes' ? amount * 60_000
               : unit === 'hours' ? amount * 3_600_000
               : amount * 86_400_000;
      // In production, enqueue a delayed job. Here we just record and signal pause.
      await prisma.workflowRunStep.updateMany({
        where: { run_id: context.run_id, node_id: node.id },
        data: { output_data: { delay_ms: ms, resume_at: new Date(Date.now() + ms).toISOString() } as object },
      });
      throw new WorkflowPauseSignal('delay');
    }

    case 'approval': {
      const approverIds = (config.approver_ids as string[]) ?? [];
      await prisma.workflowApprovalRequest.create({
        data: {
          run_id: context.run_id,
          step_node_id: node.id,
          approver_ids: approverIds,
          message: (config.message as string) ?? '',
          context_data: (config.context_data as object) ?? {},
          status: 'pending',
          expires_at: config.timeout_hours
            ? new Date(Date.now() + Number(config.timeout_hours) * 3_600_000)
            : null,
        },
      });
      throw new WorkflowPauseSignal('approval');
    }

    case 'action_send_email': {
      // Import email sender lazily to avoid circular deps
      const { sendEmail } = await import('@/lib/email');
      await sendEmail({
        to: config.to as string,
        subject: (config.subject as string) ?? '',
        html: (config.body_html as string) ?? (config.body as string) ?? '',
      });
      return { output: { sent: true, to: config.to } };
    }

    case 'action_send_webhook': {
      const url = config.url as string;
      const method = ((config.method as string) ?? 'POST').toUpperCase();
      const headers = (config.headers as Record<string, string>) ?? {};
      const body = config.body ? JSON.stringify(config.body) : undefined;

      // SSRF protection — blocks requests to private/internal addresses
      await assertSafeUrl(url);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: method !== 'GET' ? body : undefined,
        signal: AbortSignal.timeout(Number(config.timeout_ms ?? 10000)),
      });

      const responseText = await response.text();
      let responseJson: unknown;
      try { responseJson = JSON.parse(responseText); } catch { responseJson = responseText; }

      return {
        output: {
          status: response.status,
          ok: response.ok,
          body: responseJson,
        },
      };
    }

    case 'action_send_notification': {
      const userIds = (config.user_ids as string[]) ?? [];
      await prisma.notification.createMany({
        data: userIds.map((uid) => ({
          user_id: uid,
          organization_id: context.org_id,
          type: 'WORKFLOW',
          title: (config.title as string) ?? 'Workflow Notification',
          message: (config.body as string) ?? '',
          link: (config.link as string) ?? null,
          is_read: false,
        })),
        skipDuplicates: true,
      });
      return { output: { notified: userIds.length } };
    }

    case 'transform': {
      const ops = (config.operations as Array<{ type: string; key?: string; value?: unknown }>) ?? [];
      const result: Record<string, unknown> = {};
      for (const op of ops) {
        if (op.type === 'set_variable' && op.key) {
          result[op.key] = op.value;
        }
      }
      return { output: result };
    }

    case 'lookup': {
      const module = config.module as string;
      const filter = config.filter as Record<string, unknown>;
      const outputVar = (config.output_variable as string) ?? 'result';

      // Build a simple lookup query
      const tableMap: Record<string, string> = {
        crm_contacts: 'crmContact',
        crm_deals: 'crmDeal',
        crm_leads: 'crmLead',
      };
      const modelName = tableMap[module];
      if (modelName && (prisma as Record<string, unknown>)[modelName]) {
        const found = await (prisma as Record<string, { findFirst: (args: unknown) => Promise<unknown> }>)[modelName].findFirst({
          where: { ...filter, organization_id: context.org_id, deleted_at: null },
        });
        return { output: { [outputVar]: found } };
      }
      return { output: { [outputVar]: null } };
    }

    default:
      return { output: { skipped: true, node_type: node.type } };
  }
}

async function executeNode(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: ExecutionContext,
  workflow: { id: string; error_handling: string; max_retries: number },
  prisma: PrismaClient
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

  let output: Record<string, unknown> = {};
  let nextHandle: string | undefined;

  try {
    const result = await executeNodeAction(node, context, prisma);
    output = result.output;
    nextHandle = result.nextHandle;

    const now = new Date();
    await prisma.workflowRunStep.update({
      where: { id: stepLog.id },
      data: {
        status: 'completed',
        output_data: output as object,
        input_data: (interpolate(node.config, context) as object),
        completed_at: now,
        duration_ms: now.getTime() - (stepLog.started_at?.getTime() ?? now.getTime()),
      },
    });

    context.steps[node.id] = { output };

  } catch (err) {
    if (err instanceof WorkflowPauseSignal) {
      await prisma.workflowRunStep.update({
        where: { id: stepLog.id },
        data: { status: 'pending', completed_at: new Date() },
      });
      throw err; // propagate pause signal
    }

    await prisma.workflowRunStep.update({
      where: { id: stepLog.id },
      data: {
        status: 'failed',
        error_message: (err as Error).message,
        completed_at: new Date(),
      },
    });

    if (workflow.error_handling === 'stop') throw err;
    if (workflow.error_handling === 'retry' && stepLog.retry_count < workflow.max_retries) {
      await prisma.workflowRunStep.update({
        where: { id: stepLog.id },
        data: { retry_count: { increment: 1 } },
      });
      return executeNode(node, allNodes, edges, context, workflow, prisma);
    }
    // 'continue' — log failure but proceed
    context.steps[node.id] = { output: { error: (err as Error).message } };
  }

  // Find and traverse outgoing edges
  const outEdges = edges.filter(
    (e) => e.source === node.id && (!nextHandle || e.sourceHandle === nextHandle || !e.sourceHandle)
  );

  for (const edge of outEdges) {
    const nextNode = allNodes.find((n) => n.id === edge.target);
    if (nextNode) {
      await executeNode(nextNode, allNodes, edges, context, workflow, prisma);
    }
  }
}

export async function executeWorkflowRun(runId: string, prisma: PrismaClient): Promise<void> {
  const run = await prisma.workflowRun.findUniqueOrThrow({
    where: { id: runId },
    include: { workflow: true },
  });

  const workflow = run.workflow;
  const nodes = (workflow.nodes as WorkflowNode[]) ?? [];
  const edges = (workflow.edges as WorkflowEdge[]) ?? [];

  const startNode = nodes.find((n) => n.type.startsWith('trigger_'));
  if (!startNode) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'failed', error_message: 'No trigger node found', completed_at: new Date() },
    });
    return;
  }

  const context: ExecutionContext = {
    run_id: runId,
    workflow_id: workflow.id,
    org_id: workflow.organization_id,
    trigger: (run.trigger_data as Record<string, unknown>) ?? {},
    steps: {},
    _orgId: workflow.organization_id,
  };

  const wfConfig = {
    id: workflow.id,
    error_handling: workflow.error_handling,
    max_retries: workflow.max_retries,
  };

  try {
    await executeNode(startNode, nodes, edges, context, wfConfig, prisma);

    const now = new Date();
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completed_at: now,
        duration_ms: now.getTime() - run.started_at.getTime(),
      },
    });

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        total_runs: { increment: 1 },
        successful_runs: { increment: 1 },
        last_run_at: now,
      },
    });
  } catch (err) {
    if (err instanceof WorkflowPauseSignal) {
      // Run is paused (delay or approval), not failed
      return;
    }

    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        error_message: (err as Error).message,
        completed_at: new Date(),
      },
    });

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        total_runs: { increment: 1 },
        failed_runs: { increment: 1 },
      },
    });
  }
}
