"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  Clock,
  Zap,
  Globe,
  FileText,
  Mail,
  GitBranch,
  RefreshCw,
  X,
  Loader2,
  Activity,
  CheckCircle2,
} from "lucide-react";

type TriggerType =
  | "SCHEDULE"
  | "WEBHOOK"
  | "RECORD_CREATED"
  | "RECORD_UPDATED"
  | "RECORD_DELETED"
  | "FIELD_CHANGED"
  | "FORM_SUBMITTED"
  | "EMAIL_RECEIVED"
  | "MANUAL";

const TRIGGER_META: Record<
  TriggerType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  SCHEDULE: {
    label: "Schedule",
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  WEBHOOK: {
    label: "Webhook",
    icon: <Globe className="w-3.5 h-3.5" />,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  RECORD_CREATED: {
    label: "Record Created",
    icon: <Plus className="w-3.5 h-3.5" />,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  RECORD_UPDATED: {
    label: "Record Updated",
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  },
  RECORD_DELETED: {
    label: "Record Deleted",
    icon: <Trash2 className="w-3.5 h-3.5" />,
    color: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  FIELD_CHANGED: {
    label: "Field Changed",
    icon: <Pencil className="w-3.5 h-3.5" />,
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  },
  FORM_SUBMITTED: {
    label: "Form Submitted",
    icon: <FileText className="w-3.5 h-3.5" />,
    color: "bg-brand-500/10 text-brand-600 border-brand-500/20",
  },
  EMAIL_RECEIVED: {
    label: "Email Received",
    icon: <Mail className="w-3.5 h-3.5" />,
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  },
  MANUAL: {
    label: "Manual",
    icon: <Zap className="w-3.5 h-3.5" />,
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  },
};

const TRIGGER_TYPES = Object.keys(TRIGGER_META) as TriggerType[];

export default function WorkflowsPage() {
  const utils = api.useUtils();

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: workflows = [], isLoading } = api.workflows.list.useQuery({});
  const { data: stats } = api.workflows.stats.useQuery({});

  // ── State ─────────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createTrigger, setCreateTrigger] = useState<TriggerType>("MANUAL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = api.workflows.create.useMutation({
    onSuccess: (data) => {
      toast.success("Workflow created");
      void utils.workflows.list.invalidate();
      void utils.workflows.stats.invalidate();
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setCreateTrigger("MANUAL");
      // Navigate to editor
      window.location.href = `/workflows/${data.id}`;
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.workflows.delete.useMutation({
    onSuccess: () => {
      toast.success("Workflow archived");
      void utils.workflows.list.invalidate();
      void utils.workflows.stats.invalidate();
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const activateMutation = api.workflows.activate.useMutation({
    onSuccess: () => {
      toast.success("Workflow activated");
      void utils.workflows.list.invalidate();
      void utils.workflows.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deactivateMutation = api.workflows.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Workflow paused");
      void utils.workflows.list.invalidate();
      void utils.workflows.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const triggerMutation = api.workflows.trigger.useMutation({
    onSuccess: () => {
      toast.success("Workflow run started and completed");
      void utils.workflows.list.invalidate();
      void utils.workflows.stats.invalidate();
      setRunningId(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setRunningId(null);
    },
  });

  function handleToggle(id: string, isActive: boolean) {
    if (isActive) {
      deactivateMutation.mutate({ id });
    } else {
      activateMutation.mutate({ id });
    }
  }

  function handleRun(id: string) {
    setRunningId(id);
    triggerMutation.mutate({ id });
  }

  const statCards = [
    {
      label: "Total Workflows",
      value: stats?.total ?? 0,
      icon: Workflow,
      color: "brand",
    },
    {
      label: "Active",
      value: stats?.active ?? 0,
      icon: CheckCircle2,
      color: "green",
    },
    {
      label: "Runs Today",
      value: stats?.runsToday ?? 0,
      icon: Activity,
      color: "violet",
    },
    {
      label: "Total Runs",
      value: stats?.totalRuns ?? 0,
      icon: GitBranch,
      color: "cyan",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflow Automation</h1>
          <p className="text-muted-foreground mt-1">
            Build trigger-based automations to streamline repetitive processes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/workflows/integrations"
            className="flex items-center gap-1.5 border border-border hover:bg-muted px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Zap className="w-4 h-4" />
            Integrations
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
                s.color === "brand" && "bg-brand-500/10",
                s.color === "green" && "bg-green-500/10",
                s.color === "violet" && "bg-violet-500/10",
                s.color === "cyan" && "bg-cyan-500/10"
              )}
            >
              <s.icon
                className={cn(
                  "w-5 h-5",
                  s.color === "brand" && "text-brand-500",
                  s.color === "green" && "text-green-500",
                  s.color === "violet" && "text-violet-500",
                  s.color === "cyan" && "text-cyan-500"
                )}
              />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Workflow grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-card border border-border rounded-2xl p-6 animate-pulse"
            >
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2 mb-6" />
              <div className="h-6 bg-muted rounded w-24" />
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <Workflow className="w-8 h-8 text-brand-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">No workflows yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first automation to get started
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workflows.map((wf) => {
            const meta =
              TRIGGER_META[wf.trigger_type as keyof typeof TRIGGER_META];
            const isRunning = runningId === wf.id;
            return (
              <div
                key={wf.id}
                className="bg-card border border-border rounded-2xl p-6 hover:border-brand-500/30 transition-all group"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-semibold truncate group-hover:text-brand-500 transition-colors">
                      {wf.name}
                    </h3>
                    {wf.description && (
                      <p className="text-muted-foreground text-xs mt-1 line-clamp-2">
                        {wf.description}
                      </p>
                    )}
                  </div>
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggle(wf.id, wf.is_active)}
                    title={wf.is_active ? "Pause workflow" : "Activate workflow"}
                    className={cn(
                      "flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium transition-all border",
                      wf.is_active
                        ? "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20"
                        : "bg-gray-500/10 text-gray-500 border-gray-500/20 hover:bg-gray-500/20"
                    )}
                  >
                    {wf.is_active ? "Active" : "Paused"}
                  </button>
                </div>

                {/* Trigger badge */}
                {meta && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                      meta.color
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                )}

                {/* Stats */}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    {wf.run_count} runs
                  </span>
                  {wf.last_run_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {timeAgo(wf.last_run_at)}
                    </span>
                  )}
                  <span className="ml-auto">
                    {wf._count.steps} step{wf._count.steps !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                  <Link
                    href={`/workflows/${wf.id}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-2.5 py-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Link>
                  <button
                    onClick={() => handleRun(wf.id)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand-500 transition-colors border border-border rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Run Now
                  </button>
                  <Link
                    href={`/workflows/${wf.id}/runs`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-2.5 py-1.5"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Runs ({wf._count.runs})
                  </Link>
                  <button
                    onClick={() => setDeletingId(wf.id)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors border border-border rounded-lg px-2.5 py-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Workflow Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">Create Workflow</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Workflow Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Send welcome email on signup"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Description
                </label>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Optional description…"
                  rows={2}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Trigger Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TRIGGER_TYPES.map((t) => {
                    const m = TRIGGER_META[t]!;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCreateTrigger(t)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                          createTrigger === t
                            ? "border-brand-500 bg-brand-500/10 text-brand-600"
                            : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted"
                        )}
                      >
                        {m.icon}
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border border-border hover:bg-muted rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!createName.trim()) {
                    toast.error("Workflow name is required");
                    return;
                  }
                  createMutation.mutate({
                    name: createName.trim(),
                    description: createDesc.trim() || undefined,
                    trigger_type: createTrigger,
                  });
                }}
                disabled={createMutation.isPending}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Create & Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-semibold text-lg mb-2">Archive Workflow?</h2>
            <p className="text-muted-foreground text-sm mb-6">
              This will archive the workflow. It can be restored later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 border border-border hover:bg-muted rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deletingId })}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
