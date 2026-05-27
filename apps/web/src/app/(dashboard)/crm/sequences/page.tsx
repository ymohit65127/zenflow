// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Zap,
  Plus,
  Users,
  CheckCircle,
  Play,
  Pause,
  MoreHorizontal,
  Mail,
  Phone,
  Clock,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  archived: "bg-muted text-muted-foreground",
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual Enroll",
  lead_created: "Lead Created",
  lead_score: "Lead Score",
  deal_stage: "Deal Stage",
};

function CreateSequenceDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    goal: "",
    trigger_type: "manual" as const,
  });

  const createMutation = api.crm.sequences.create.useMutation({
    onSuccess: (seq) => {
      toast.success("Sequence created");
      setOpen(false);
      setForm({ name: "", description: "", goal: "", trigger_type: "manual" });
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Sequence
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sequence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Sequence Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="New Lead Nurture"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this sequence accomplish?"
              rows={2}
            />
          </div>
          <div>
            <Label>Goal</Label>
            <Input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Book a discovery call"
            />
          </div>
          <div>
            <Label>Trigger</Label>
            <Select
              value={form.trigger_type}
              onValueChange={(v) => setForm({ ...form, trigger_type: v as typeof form.trigger_type })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Enrollment</SelectItem>
                <SelectItem value="lead_created">Lead Created</SelectItem>
                <SelectItem value="lead_score">Lead Score Threshold</SelectItem>
                <SelectItem value="deal_stage">Deal Stage Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full bg-brand-500 hover:bg-brand-600 text-white"
            disabled={!form.name || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            {createMutation.isPending ? "Creating..." : "Create Sequence"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SequencesPage() {
  const { data: sequences, isLoading, refetch } = api.crm.sequences.list.useQuery({});

  const activateMutation = api.crm.sequences.activate.useMutation({
    onSuccess: () => { toast.success("Sequence activated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const pauseMutation = api.crm.sequences.pause.useMutation({
    onSuccess: () => { toast.success("Sequence paused"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const stepIcons: Record<string, typeof Mail> = {
    email: Mail,
    call: Phone,
    wait: Clock,
    task: CheckSquare,
    sms: Mail,
  };

  const active = sequences?.filter((s) => s.status === "active").length ?? 0;
  const totalEnrolled = sequences?.reduce((sum, s) => sum + s.enrolled_count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-brand-500" />
            Sequences
          </h1>
          <p className="text-muted-foreground mt-1">Automated multi-step contact workflows</p>
        </div>
        <CreateSequenceDialog onCreated={() => refetch()} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{sequences?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Sequences</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{totalEnrolled}</p>
            <p className="text-xs text-muted-foreground">Total Enrolled</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !sequences || sequences.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">No sequences yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create automated workflows to nurture leads</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sequences.map((seq) => (
            <Card key={seq.id} className="hover:border-brand-500/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">{seq.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[seq.status]}`}>
                        {seq.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {TRIGGER_LABELS[seq.trigger_type] ?? seq.trigger_type}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/crm/sequences/${seq.id}`}>View / Edit</Link>
                      </DropdownMenuItem>
                      {seq.status === "draft" && (
                        <DropdownMenuItem onClick={() => activateMutation.mutate({ id: seq.id })}>
                          <Play className="w-3.5 h-3.5 mr-2 text-green-500" /> Activate
                        </DropdownMenuItem>
                      )}
                      {seq.status === "active" && (
                        <DropdownMenuItem onClick={() => pauseMutation.mutate({ id: seq.id })}>
                          <Pause className="w-3.5 h-3.5 mr-2 text-yellow-500" /> Pause
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {seq.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{seq.description}</p>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold">{seq._count?.steps ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Steps</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-brand-500">{seq.enrolled_count}</p>
                    <p className="text-xs text-muted-foreground">Enrolled</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-500">{seq.completed_count}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
                <Link href={`/crm/sequences/${seq.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-3 text-xs">
                    View Sequence
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
