"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ── v2 Step Logs Panel ─────────────────────────────────────────────────────────

function RunStepLogs({ runId }: { runId: string }) {
  const { data: logs, isLoading } = api.workflows.runsV2.logs.useQuery({ runId });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    running: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-gray-100 text-gray-500',
    skipped: 'bg-gray-50 text-gray-400',
  };

  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading step logs...</div>;
  if (!logs?.length) return <div className="p-4 text-xs text-muted-foreground">No step logs available.</div>;

  return (
    <div className="space-y-1 mt-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Step Logs</p>
      {logs.map((log) => (
        <div key={log.id} className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
          >
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColors[log.status] ?? 'bg-gray-100'}`}>
              {log.status}
            </span>
            <span className="text-sm font-medium flex-1 truncate">{log.node_name}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">{log.node_type}</span>
            {log.duration_ms != null && (
              <span className="text-xs text-muted-foreground flex-shrink-0">{log.duration_ms}ms</span>
            )}
            {expandedLog === log.id ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
          </button>
          {expandedLog === log.id && (
            <div className="px-3 pb-3 grid grid-cols-2 gap-3 bg-muted/20 border-t border-border">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 mt-2">Input</p>
                <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32 font-mono">{JSON.stringify(log.input_data, null, 2)}</pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 mt-2">Output</p>
                <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32 font-mono">{JSON.stringify(log.output_data, null, 2)}</pre>
              </div>
              {log.error_message && (
                <div className="col-span-2">
                  <p className="text-xs text-red-500 bg-red-50 rounded p-2">{log.error_message}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type RunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

const STATUS_META: Record<
  RunStatus,
  { label: string; icon: React.ReactNode; badge: string }
> = {
  RUNNING: {
    label: "Running",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  COMPLETED: {
    label: "Completed",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    badge: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  FAILED: {
    label: "Failed",
    icon: <XCircle className="w-3.5 h-3.5" />,
    badge: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: <XCircle className="w-3.5 h-3.5" />,
    badge: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  },
};

function duration(start: Date, end: Date | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function WorkflowRunsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: workflow } = api.workflows.get.useQuery({ id });
  const { data: runs = [], isLoading } = api.workflows.runs.list.useQuery({
    workflowId: id,
  });

  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const completed = runs.filter((r) => r.status === "COMPLETED").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  const running = runs.filter((r) => r.status === "RUNNING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/workflows/${id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {workflow?.name ?? "Workflow"} — Runs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Execution history and results
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Runs",
            value: runs.length,
            icon: Activity,
            color: "brand",
          },
          {
            label: "Completed",
            value: completed,
            icon: CheckCircle2,
            color: "green",
          },
          {
            label: "Failed",
            value: failed,
            icon: XCircle,
            color: "red",
          },
          {
            label: "Running",
            value: running,
            icon: Loader2,
            color: "yellow",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
                s.color === "brand" && "bg-brand-500/10",
                s.color === "green" && "bg-green-500/10",
                s.color === "red" && "bg-red-500/10",
                s.color === "yellow" && "bg-yellow-500/10"
              )}
            >
              <s.icon
                className={cn(
                  "w-4.5 h-4.5",
                  s.color === "brand" && "text-brand-500",
                  s.color === "green" && "text-green-500",
                  s.color === "red" && "text-red-500",
                  s.color === "yellow" && "text-yellow-500"
                )}
                style={{ width: "1.125rem", height: "1.125rem" }}
              />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Runs table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Run History</h2>
          <span className="text-xs text-muted-foreground">
            {runs.length} total
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Activity className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No runs yet.</p>
            <p className="text-muted-foreground/60 text-xs">
              Use &quot;Run Now&quot; in the editor to trigger a manual run.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {runs.map((run, idx) => {
              const meta = STATUS_META[run.status as RunStatus];
              const isExpanded = expandedRun === run.id;
              return (
                <div key={run.id}>
                  <div
                    onClick={() =>
                      setExpandedRun(isExpanded ? null : run.id)
                    }
                    className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <span className="text-xs text-muted-foreground w-8 flex-shrink-0">
                      #{runs.length - idx}
                    </span>

                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                        meta.badge
                      )}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {formatDate(run.started_at, "MMM d, yyyy HH:mm:ss")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {timeAgo(run.started_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {duration(run.started_at, run.completed_at ?? null)}
                    </div>

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-5 bg-muted/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            Trigger Data
                          </p>
                          <pre className="bg-muted rounded-xl p-3 text-xs overflow-auto max-h-40 font-mono">
                            {JSON.stringify(run.trigger_data, null, 2) ?? "{}"}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            Result Data
                          </p>
                          <pre className="bg-muted rounded-xl p-3 text-xs overflow-auto max-h-40 font-mono">
                            {JSON.stringify(run.result_data, null, 2) ?? "{}"}
                          </pre>
                          {run.error && (
                            <p className="mt-2 text-xs text-red-500 bg-red-500/10 rounded-lg p-2">
                              {run.error}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* v2: Per-step logs */}
                      <RunStepLogs runId={run.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
