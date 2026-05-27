// @ts-nocheck
"use client";
// @ts-nocheck

import { use, useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Zap,
  Play,
  Pause,
  Plus,
  Mail,
  Phone,
  Clock,
  CheckSquare,
  Trash2,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type StepType = "email" | "sms" | "call" | "task" | "wait";

const STEP_TYPE_CONFIG: Record<StepType, { icon: typeof Mail; color: string; label: string }> = {
  email: { icon: Mail, color: "text-blue-500", label: "Email" },
  sms: { icon: Mail, color: "text-purple-500", label: "SMS" },
  call: { icon: Phone, color: "text-green-500", label: "Call" },
  task: { icon: CheckSquare, color: "text-orange-500", label: "Task" },
  wait: { icon: Clock, color: "text-slate-500", label: "Wait" },
};

function StepCard({
  step,
  index,
  onDelete,
}: {
  step: {
    type: StepType;
    position: number;
    wait_days: number;
    wait_hours: number;
    subject?: string | null;
    body?: string | null;
    task_title?: string | null;
  };
  index: number;
  onDelete: () => void;
}) {
  const config = STEP_TYPE_CONFIG[step.type] ?? STEP_TYPE_CONFIG.email;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full bg-muted flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        {index < 99 && <div className="w-px h-6 bg-border mt-1" />}
      </div>
      <div className="flex-1 bg-card border border-border rounded-lg p-3 mb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{config.label}</Badge>
            {(step.wait_days > 0 || step.wait_hours > 0) && (
              <span className="text-xs text-muted-foreground">
                Wait {step.wait_days}d {step.wait_hours}h before
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
        {step.subject && <p className="text-sm font-medium">{step.subject}</p>}
        {step.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{step.body}</p>
        )}
        {step.task_title && <p className="text-sm">{step.task_title}</p>}
        {step.type === "wait" && (
          <p className="text-sm text-muted-foreground">
            Wait for {step.wait_days} day(s), {step.wait_hours} hour(s)
          </p>
        )}
      </div>
    </div>
  );
}

export default function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: sequence, isLoading, refetch } = api.crm.sequences.getById.useQuery({ id });
  const { data: enrollmentsData } = api.crm.sequences.getEnrollments.useQuery({
    sequenceId: id,
    limit: 25,
  });

  const [newStepType, setNewStepType] = useState<StepType>("email");
  const [newStepSubject, setNewStepSubject] = useState("");
  const [newStepBody, setNewStepBody] = useState("");
  const [newStepWaitDays, setNewStepWaitDays] = useState(1);
  const [editedSteps, setEditedSteps] = useState<NonNullable<typeof sequence>["steps"]>([]);
  const [stepsChanged, setStepsChanged] = useState(false);

  const activateMutation = api.crm.sequences.activate.useMutation({
    onSuccess: () => { toast.success("Sequence activated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const pauseMutation = api.crm.sequences.pause.useMutation({
    onSuccess: () => { toast.success("Sequence paused"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const updateStepsMutation = api.crm.sequences.updateSteps.useMutation({
    onSuccess: () => { toast.success("Steps saved"); refetch(); setStepsChanged(false); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!sequence) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Sequence not found</p>
        <Link href="/crm/sequences" className="text-brand-500 mt-2 block">Back to sequences</Link>
      </div>
    );
  }

  const currentSteps = stepsChanged ? (editedSteps as NonNullable<typeof sequence>["steps"]) : sequence.steps;

  function addStep() {
    const steps = stepsChanged ? (editedSteps as NonNullable<typeof sequence>["steps"]) : sequence!.steps;
    const newStep = {
      id: `temp-${Date.now()}`,
      sequence_id: id,
      position: steps.length,
      type: newStepType,
      wait_days: newStepWaitDays,
      wait_hours: 0,
      wait_until_time: null,
      subject: newStepType === "email" ? newStepSubject || null : null,
      body: newStepType === "email" ? newStepBody || null : null,
      task_title: newStepType === "task" ? newStepSubject || null : null,
      task_type: null,
      template_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    setEditedSteps([...steps, newStep] as NonNullable<typeof sequence>["steps"]);
    setStepsChanged(true);
    setNewStepSubject("");
    setNewStepBody("");
  }

  function removeStep(index: number) {
    const steps = stepsChanged ? [...(editedSteps as NonNullable<typeof sequence>["steps"])] : [...sequence!.steps];
    steps.splice(index, 1);
    const reindexed = steps.map((s, i) => ({ ...s, position: i }));
    setEditedSteps(reindexed as NonNullable<typeof sequence>["steps"]);
    setStepsChanged(true);
  }

  function saveSteps() {
    updateStepsMutation.mutate({
      sequenceId: id,
      steps: currentSteps.map((s) => ({
        position: s.position,
        type: s.type as StepType,
        wait_days: s.wait_days,
        wait_hours: s.wait_hours,
        wait_until_time: s.wait_until_time ?? undefined,
        subject: s.subject ?? undefined,
        body: s.body ?? undefined,
        task_title: s.task_title ?? undefined,
        task_type: s.task_type as typeof s.task_type ?? undefined,
      })),
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/crm/sequences" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Sequences
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{sequence.name}</h1>
              {sequence.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{sequence.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={
                sequence.status === "active"
                  ? "bg-green-100 text-green-700"
                  : sequence.status === "paused"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-muted text-muted-foreground"
              }
            >
              {sequence.status}
            </Badge>
            {sequence.status === "draft" && (
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => activateMutation.mutate({ id })}
              >
                <Play className="w-3.5 h-3.5 mr-1" /> Activate
              </Button>
            )}
            {sequence.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => pauseMutation.mutate({ id })}>
                <Pause className="w-3.5 h-3.5 mr-1" /> Pause
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5">
          <div className="text-center">
            <p className="text-2xl font-bold">{sequence.steps?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Steps</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-brand-500">{sequence.stats?.active ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{sequence.stats?.completed ?? 0}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-muted-foreground">{sequence.stats?.exited ?? 0}</p>
            <p className="text-xs text-muted-foreground">Exited</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps">Steps ({currentSteps.length})</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step builder */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Sequence Steps</h3>
                {stepsChanged && (
                  <Button
                    size="sm"
                    className="bg-brand-500 hover:bg-brand-600 text-white"
                    disabled={updateStepsMutation.isPending}
                    onClick={saveSteps}
                  >
                    {updateStepsMutation.isPending ? "Saving..." : "Save Steps"}
                  </Button>
                )}
              </div>

              {currentSteps.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No steps yet. Add your first step below.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {currentSteps.map((step, idx) => (
                    <StepCard
                      key={step.id}
                      step={{
                        type: step.type as StepType,
                        position: step.position,
                        wait_days: step.wait_days,
                        wait_hours: step.wait_hours,
                        subject: step.subject,
                        body: step.body,
                        task_title: step.task_title,
                      }}
                      index={idx}
                      onDelete={() => removeStep(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Add step panel */}
            <div className="bg-card border border-border rounded-xl p-4 h-fit">
              <h3 className="font-semibold mb-4 text-sm">Add Step</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Step Type</Label>
                  <Select value={newStepType} onValueChange={(v) => setNewStepType(v as StepType)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="call">Call reminder</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="wait">Wait (delay)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Wait (days before this step)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newStepWaitDays}
                    onChange={(e) => setNewStepWaitDays(Number(e.target.value))}
                    className="h-8"
                  />
                </div>

                {(newStepType === "email" || newStepType === "task" || newStepType === "call") && (
                  <div>
                    <Label className="text-xs">
                      {newStepType === "email" ? "Subject" : "Title"}
                    </Label>
                    <Input
                      value={newStepSubject}
                      onChange={(e) => setNewStepSubject(e.target.value)}
                      className="h-8"
                      placeholder={newStepType === "email" ? "Follow up on our conversation" : "Call prospect"}
                    />
                  </div>
                )}

                {newStepType === "email" && (
                  <div>
                    <Label className="text-xs">Email Body</Label>
                    <Textarea
                      value={newStepBody}
                      onChange={(e) => setNewStepBody(e.target.value)}
                      rows={3}
                      placeholder="Hi {{first_name}}, just following up..."
                    />
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                  onClick={addStep}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {enrollmentsData?.enrollments && enrollmentsData.enrollments.length > 0 ? (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-4 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>Contact</span>
                  <span>Status</span>
                  <span>Step</span>
                  <span>Enrolled</span>
                </div>
                {enrollmentsData.enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="grid grid-cols-4 gap-4 p-3 items-center hover:bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">
                        {enrollment.contact?.first_name} {enrollment.contact?.last_name ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{enrollment.contact?.email}</p>
                    </div>
                    <Badge
                      className={
                        enrollment.status === "active"
                          ? "bg-green-100 text-green-700 w-fit"
                          : enrollment.status === "completed"
                          ? "bg-blue-100 text-blue-700 w-fit"
                          : "bg-muted text-muted-foreground w-fit"
                      }
                    >
                      {enrollment.status}
                    </Badge>
                    <span className="text-sm">Step {enrollment.current_step_position + 1}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(enrollment.enrolled_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No enrollments yet</p>
                {sequence.status !== "active" && (
                  <p className="text-xs mt-1">Activate the sequence first</p>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
