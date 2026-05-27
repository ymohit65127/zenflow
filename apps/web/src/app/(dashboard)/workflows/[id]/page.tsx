"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Zap,
  Save,
  Plus,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  Settings2,
  Loader2,
  Clock,
  Globe,
  Mail,
  FileText,
  Bell,
  Code2,
  Timer,
  GitBranch,
  RefreshCw,
  Activity,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StepType =
  | "CONDITION"
  | "ACTION_EMAIL"
  | "ACTION_WEBHOOK"
  | "ACTION_CREATE_RECORD"
  | "ACTION_UPDATE_RECORD"
  | "ACTION_ASSIGN"
  | "ACTION_NOTIFY"
  | "ACTION_DELAY"
  | "ACTION_API_CALL";

interface StepDraft {
  id: string;
  name: string;
  type: StepType;
  config: Record<string, unknown>;
  sort_order: number;
  parent_id: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step meta
// ─────────────────────────────────────────────────────────────────────────────

const STEP_META: Record<
  StepType,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  CONDITION: {
    label: "Condition",
    icon: <GitBranch className="w-4 h-4" />,
    color: "text-amber-600",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  ACTION_EMAIL: {
    label: "Send Email",
    icon: <Mail className="w-4 h-4" />,
    color: "text-blue-600",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  ACTION_WEBHOOK: {
    label: "Call Webhook",
    icon: <Globe className="w-4 h-4" />,
    color: "text-green-600",
    bg: "bg-green-500/10 border-green-500/30",
  },
  ACTION_CREATE_RECORD: {
    label: "Create Record",
    icon: <Plus className="w-4 h-4" />,
    color: "text-brand-600",
    bg: "bg-brand-500/10 border-brand-500/30",
  },
  ACTION_UPDATE_RECORD: {
    label: "Update Record",
    icon: <RefreshCw className="w-4 h-4" />,
    color: "text-cyan-600",
    bg: "bg-cyan-500/10 border-cyan-500/30",
  },
  ACTION_ASSIGN: {
    label: "Assign User",
    icon: <Settings2 className="w-4 h-4" />,
    color: "text-violet-600",
    bg: "bg-violet-500/10 border-violet-500/30",
  },
  ACTION_NOTIFY: {
    label: "Send Notification",
    icon: <Bell className="w-4 h-4" />,
    color: "text-pink-600",
    bg: "bg-pink-500/10 border-pink-500/30",
  },
  ACTION_DELAY: {
    label: "Add Delay",
    icon: <Timer className="w-4 h-4" />,
    color: "text-gray-600",
    bg: "bg-gray-500/10 border-gray-500/30",
  },
  ACTION_API_CALL: {
    label: "API Call",
    icon: <Code2 className="w-4 h-4" />,
    color: "text-teal-600",
    bg: "bg-teal-500/10 border-teal-500/30",
  },
};

const STEP_TYPES = Object.keys(STEP_META) as StepType[];

const TRIGGER_META: Record<string, { label: string; icon: React.ReactNode }> =
  {
    SCHEDULE: { label: "Schedule", icon: <Clock className="w-4 h-4" /> },
    WEBHOOK: { label: "Webhook", icon: <Globe className="w-4 h-4" /> },
    RECORD_CREATED: { label: "Record Created", icon: <Plus className="w-4 h-4" /> },
    RECORD_UPDATED: {
      label: "Record Updated",
      icon: <RefreshCw className="w-4 h-4" />,
    },
    RECORD_DELETED: { label: "Record Deleted", icon: <Trash2 className="w-4 h-4" /> },
    FIELD_CHANGED: { label: "Field Changed", icon: <Settings2 className="w-4 h-4" /> },
    FORM_SUBMITTED: {
      label: "Form Submitted",
      icon: <FileText className="w-4 h-4" />,
    },
    EMAIL_RECEIVED: { label: "Email Received", icon: <Mail className="w-4 h-4" /> },
    MANUAL: { label: "Manual Trigger", icon: <Zap className="w-4 h-4" /> },
  };

// ─────────────────────────────────────────────────────────────────────────────
// Step config form
// ─────────────────────────────────────────────────────────────────────────────

function StepConfigPanel({
  step,
  onChange,
}: {
  step: StepDraft;
  onChange: (updated: StepDraft) => void;
}) {
  const updateConfig = (key: string, value: unknown) => {
    onChange({ ...step, config: { ...step.config, [key]: value } });
  };

  const cfg = step.config;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Step Name
        </label>
        <input
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {step.type === "ACTION_EMAIL" && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              To
            </label>
            <input
              value={(cfg.to as string) ?? ""}
              onChange={(e) => updateConfig("to", e.target.value)}
              placeholder="{contact.email}"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Subject
            </label>
            <input
              value={(cfg.subject as string) ?? ""}
              onChange={(e) => updateConfig("subject", e.target.value)}
              placeholder="Welcome to {organization.name}"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Body
            </label>
            <textarea
              value={(cfg.body as string) ?? ""}
              onChange={(e) => updateConfig("body", e.target.value)}
              rows={4}
              placeholder="Email body content…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
            />
          </div>
        </>
      )}

      {step.type === "ACTION_WEBHOOK" && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              URL
            </label>
            <input
              value={(cfg.url as string) ?? ""}
              onChange={(e) => updateConfig("url", e.target.value)}
              placeholder="https://api.example.com/webhook"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Method
            </label>
            <select
              value={(cfg.method as string) ?? "POST"}
              onChange={(e) => updateConfig("method", e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {["POST", "GET", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Body (JSON)
            </label>
            <textarea
              value={(cfg.body as string) ?? ""}
              onChange={(e) => updateConfig("body", e.target.value)}
              rows={3}
              placeholder='{"key": "{{value}}"}'
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
            />
          </div>
        </>
      )}

      {step.type === "ACTION_NOTIFY" && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Message
            </label>
            <textarea
              value={(cfg.message as string) ?? ""}
              onChange={(e) => updateConfig("message", e.target.value)}
              rows={3}
              placeholder="Notification message…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Notify Users
            </label>
            <input
              value={(cfg.users as string) ?? ""}
              onChange={(e) => updateConfig("users", e.target.value)}
              placeholder="assignee, owner, all-members"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </>
      )}

      {step.type === "CONDITION" && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Field
            </label>
            <input
              value={(cfg.field as string) ?? ""}
              onChange={(e) => updateConfig("field", e.target.value)}
              placeholder="e.g. contact.status"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Operator
            </label>
            <select
              value={(cfg.operator as string) ?? "equals"}
              onChange={(e) => updateConfig("operator", e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {[
                "equals",
                "not_equals",
                "contains",
                "not_contains",
                "greater_than",
                "less_than",
                "is_empty",
                "is_not_empty",
              ].map((op) => (
                <option key={op} value={op}>
                  {op.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Value
            </label>
            <input
              value={(cfg.value as string) ?? ""}
              onChange={(e) => updateConfig("value", e.target.value)}
              placeholder="e.g. ACTIVE"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </>
      )}

      {step.type === "ACTION_DELAY" && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Delay (hours)
          </label>
          <input
            type="number"
            min={0}
            value={(cfg.delay_hours as number) ?? 1}
            onChange={(e) => updateConfig("delay_hours", Number(e.target.value))}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      )}

      {step.type === "ACTION_API_CALL" && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              API Endpoint
            </label>
            <input
              value={(cfg.endpoint as string) ?? ""}
              onChange={(e) => updateConfig("endpoint", e.target.value)}
              placeholder="https://api.example.com/v1/resource"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Authorization Header
            </label>
            <input
              value={(cfg.auth_header as string) ?? ""}
              onChange={(e) => updateConfig("auth_header", e.target.value)}
              placeholder="Bearer your-token"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </>
      )}

      {(step.type === "ACTION_CREATE_RECORD" ||
        step.type === "ACTION_UPDATE_RECORD" ||
        step.type === "ACTION_ASSIGN") && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Configuration (JSON)
          </label>
          <textarea
            value={
              typeof cfg.data === "string"
                ? cfg.data
                : JSON.stringify(cfg.data ?? {}, null, 2)
            }
            onChange={(e) => {
              try {
                updateConfig("data", JSON.parse(e.target.value));
              } catch {
                updateConfig("data", e.target.value);
              }
            }}
            rows={5}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add step picker
// ─────────────────────────────────────────────────────────────────────────────

function AddStepPicker({ onAdd }: { onAdd: (type: StepType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-brand-500/50 rounded-lg px-3 py-2 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Step
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
          {STEP_TYPES.map((type) => {
            const m = STEP_META[type];
            return (
              <button
                key={type}
                onClick={() => {
                  onAdd(type);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors text-left",
                  m.color
                )}
              >
                {m.icon}
                <span className="text-foreground">{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor page
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const utils = api.useUtils();

  const { data: workflow, isLoading } = api.workflows.get.useQuery({ id });

  // ── Local state ───────────────────────────────────────────────────────────
  const [localName, setLocalName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (workflow) {
      setLocalName(workflow.name);
      setSteps(
        workflow.steps.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type as StepType,
          config: (s.config as Record<string, unknown>) ?? {},
          sort_order: s.sort_order,
          parent_id: s.parent_id,
        }))
      );
    }
  }, [workflow]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateMutation = api.workflows.update.useMutation({
    onSuccess: () => {
      toast.success("Workflow saved");
      setIsDirty(false);
      void utils.workflows.get.invalidate({ id });
      void utils.workflows.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveStepsMutation = api.workflows.steps.save.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const activateMutation = api.workflows.activate.useMutation({
    onSuccess: () => {
      toast.success("Workflow activated");
      void utils.workflows.get.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });

  const deactivateMutation = api.workflows.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Workflow paused");
      void utils.workflows.get.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });

  const triggerMutation = api.workflows.trigger.useMutation({
    onSuccess: () => {
      toast.success("Workflow run completed");
      void utils.workflows.get.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = useCallback(async () => {
    await updateMutation.mutateAsync({ id, name: localName });
    await saveStepsMutation.mutateAsync({
      workflowId: id,
      steps: steps.map((s) => ({
        name: s.name,
        type: s.type,
        config: s.config,
        sort_order: s.sort_order,
        parent_id: s.parent_id,
      })),
    });
    setIsDirty(false);
  }, [id, localName, steps, updateMutation, saveStepsMutation]);

  function addStep(type: StepType) {
    const newStep: StepDraft = {
      id: `draft_${Date.now()}`,
      name: STEP_META[type].label,
      type,
      config: {},
      sort_order: steps.length,
      parent_id: null,
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedStep(newStep.id);
    setIsDirty(true);
  }

  function removeStep(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    if (selectedStep === stepId) setSelectedStep(null);
    setIsDirty(true);
  }

  function updateStep(updated: StepDraft) {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setIsDirty(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Workflow not found.</p>
        <Link href="/workflows" className="text-brand-500 text-sm hover:underline mt-2 inline-block">
          Back to workflows
        </Link>
      </div>
    );
  }

  const triggerMeta = TRIGGER_META[workflow.trigger_type];
  const activeStep = selectedStep
    ? steps.find((s) => s.id === selectedStep)
    : null;
  const isSaving =
    updateMutation.isPending || saveStepsMutation.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] -m-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-card flex-shrink-0">
        <Link
          href="/workflows"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            setIsDirty(true);
          }}
          className="text-base font-semibold bg-transparent border-none outline-none focus:bg-muted px-2 py-1 rounded-lg transition-colors flex-1 min-w-0"
        />

        <span
          className={cn(
            "flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border",
            workflow.status === "ACTIVE"
              ? "bg-green-500/10 text-green-600 border-green-500/20"
              : workflow.status === "PAUSED"
              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
              : "bg-gray-500/10 text-gray-500 border-gray-500/20"
          )}
        >
          {workflow.status}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <Link
            href={`/workflows/${id}/runs`}
            className="flex items-center gap-1.5 text-sm border border-border hover:bg-muted rounded-lg px-3 py-1.5 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Runs
          </Link>

          {workflow.is_active ? (
            <button
              onClick={() => deactivateMutation.mutate({ id })}
              disabled={deactivateMutation.isPending}
              className="flex items-center gap-1.5 text-sm border border-border hover:bg-muted rounded-lg px-3 py-1.5 transition-colors"
            >
              <Pause className="w-4 h-4" />
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => activateMutation.mutate({ id })}
              disabled={activateMutation.isPending}
              className="flex items-center gap-1.5 text-sm bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Play className="w-4 h-4" />
              Activate
            </button>
          )}

          <button
            onClick={() => triggerMutation.mutate({ id })}
            disabled={triggerMutation.isPending}
            className="flex items-center gap-1.5 text-sm border border-border hover:bg-muted rounded-lg px-3 py-1.5 transition-colors"
          >
            {triggerMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Run Now
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className={cn(
              "flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 transition-colors",
              isDirty
                ? "bg-brand-500 hover:bg-brand-600 text-white"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-auto p-6 bg-muted/30">
          <div className="max-w-lg mx-auto space-y-0">
            {/* Trigger node */}
            <div className="flex flex-col items-center">
              <div className="w-full bg-card border-2 border-brand-500/40 rounded-2xl p-5 shadow-sm hover:border-brand-500/70 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 flex-shrink-0">
                    {triggerMeta?.icon ?? <Zap className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Trigger
                    </p>
                    <p className="font-semibold text-sm">
                      {triggerMeta?.label ?? workflow.trigger_type}
                    </p>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {workflow.run_count} runs
                  </span>
                </div>
              </div>

              {/* Connector */}
              {steps.length > 0 && <Connector />}
            </div>

            {/* Step nodes */}
            {steps.map((step, idx) => {
              const meta = STEP_META[step.type];
              const isSelected = selectedStep === step.id;
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div
                    onClick={() =>
                      setSelectedStep(isSelected ? null : step.id)
                    }
                    className={cn(
                      "w-full bg-card border-2 rounded-2xl p-4 shadow-sm transition-all cursor-pointer",
                      isSelected
                        ? "border-brand-500 shadow-brand-500/10"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0",
                          meta.bg,
                          meta.color
                        )}
                      >
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-medium">
                          Step {idx + 1}
                        </p>
                        <p className="font-medium text-sm truncate">
                          {step.name}
                        </p>
                        {/* Config preview */}
                        {step.type === "ACTION_EMAIL" &&
                          Boolean(step.config.to) && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              To: {String(step.config.to)}
                            </p>
                          )}
                        {step.type === "ACTION_WEBHOOK" &&
                          Boolean(step.config.url) && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {String(step.config.method ?? "POST")}{" "}{String(step.config.url)}
                            </p>
                          )}
                        {step.type === "ACTION_DELAY" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Wait {Number(step.config.delay_hours ?? 1)}h
                          </p>
                        )}
                        {step.type === "CONDITION" && Boolean(step.config.field) && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {String(step.config.field)}{" "}
                            {String(step.config.operator ?? "equals")}{" "}
                            {String(step.config.value ?? "")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isSelected ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStep(step.id);
                          }}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Connector between steps */}
                  {idx < steps.length - 1 && <Connector />}
                </div>
              );
            })}

            {/* Add step */}
            <div className="flex flex-col items-center pt-4">
              {steps.length > 0 && <Connector />}
              <AddStepPicker onAdd={addStep} />
            </div>
          </div>
        </div>

        {/* Right panel — step config */}
        {activeStep && (
          <div className="w-80 border-l border-border bg-card overflow-auto flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-7 h-7 rounded-lg border flex items-center justify-center",
                    STEP_META[activeStep.type].bg,
                    STEP_META[activeStep.type].color
                  )}
                >
                  {STEP_META[activeStep.type].icon}
                </span>
                <span className="text-sm font-semibold">
                  {STEP_META[activeStep.type].label}
                </span>
              </div>
              <button
                onClick={() => setSelectedStep(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <StepConfigPanel
                step={activeStep}
                onChange={updateStep}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-5 bg-border" />
      <div className="w-2 h-2 rounded-full border-2 border-muted-foreground/30 bg-card" />
      <div className="w-px h-5 bg-border" />
    </div>
  );
}
