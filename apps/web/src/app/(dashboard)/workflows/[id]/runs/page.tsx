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
                    <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20">
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
