// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Settings2,
  Trash2,
  Star,
  GitBranch,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

function StageChip({ stage }: { stage: { name: string; color: string; probability: unknown; stage_type: string } }) {
  return (
    <div
      className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"
      style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
    >
      <span>{stage.name}</span>
      <span className="opacity-70">·</span>
      <span>{Number(stage.probability)}%</span>
      {stage.stage_type !== "active" && (
        <span className="ml-0.5 opacity-60">({stage.stage_type})</span>
      )}
    </div>
  );
}

function CreatePipelineDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    color: "#3B82F6",
    currency: "USD",
    winProbabilityEnabled: true,
    rottingEnabled: false,
    rottingDays: 14,
  });

  const createMutation = api.crm.pipelines.create.useMutation({
    onSuccess: () => {
      toast.success("Pipeline created with default stages");
      setOpen(false);
      setForm({ name: "", color: "#3B82F6", currency: "USD", winProbabilityEnabled: true, rottingEnabled: false, rottingDays: 14 });
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Pipeline
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Pipeline</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Pipeline Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Sales Pipeline"
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border border-border"
              />
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <Label>Currency</Label>
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              maxLength={3}
              className="uppercase w-24"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Win Probability</p>
              <p className="text-xs text-muted-foreground">Track win % per stage</p>
            </div>
            <Switch
              checked={form.winProbabilityEnabled}
              onCheckedChange={(v) => setForm({ ...form, winProbabilityEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Rotting Detection</p>
              <p className="text-xs text-muted-foreground">Alert on stale deals</p>
            </div>
            <Switch
              checked={form.rottingEnabled}
              onCheckedChange={(v) => setForm({ ...form, rottingEnabled: v })}
            />
          </div>
          {form.rottingEnabled && (
            <div>
              <Label>Rotting after (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.rottingDays}
                onChange={(e) => setForm({ ...form, rottingDays: Number(e.target.value) })}
                className="w-24"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
            6 default stages will be created: Prospecting, Qualification, Proposal, Negotiation, Closed Won, Closed Lost
          </p>
          <Button
            className="w-full bg-brand-500 hover:bg-brand-600 text-white"
            disabled={!form.name || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            {createMutation.isPending ? "Creating..." : "Create Pipeline"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PipelinesPage() {
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null);
  const { data: pipelines, isLoading, refetch } = api.crm.pipelines.list.useQuery();

  const deleteMutation = api.crm.pipelines.delete.useMutation({
    onSuccess: () => { toast.success("Pipeline deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMutation = api.crm.pipelines.setDefault.useMutation({
    onSuccess: () => { toast.success("Default pipeline updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-brand-500" />
            Pipelines
          </h1>
          <p className="text-muted-foreground mt-1">Manage your sales pipelines and stages</p>
        </div>
        <CreatePipelineDialog onCreated={() => refetch()} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !pipelines || pipelines.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <GitBranch className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">No pipelines yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first pipeline to start managing deals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pipeline.color }}
                    />
                    <CardTitle className="text-base">{pipeline.name}</CardTitle>
                    {pipeline.is_default && (
                      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs">
                        <Star className="w-3 h-3 mr-1" /> Default
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {pipeline._count?.deals ?? 0} deals
                    </Badge>
                    {pipeline.rotting_enabled && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                        Rotting: {pipeline.rotting_days}d
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!pipeline.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setDefaultMutation.mutate({ id: pipeline.id })}
                      >
                        <Star className="w-3.5 h-3.5 mr-1" /> Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Delete this pipeline?")) {
                          deleteMutation.mutate({ id: pipeline.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPipeline(expandedPipeline === pipeline.id ? null : pipeline.id)}
                    >
                      {expandedPipeline === pipeline.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedPipeline === pipeline.id && (
                <CardContent className="pt-0">
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Stages</p>
                    <div className="flex flex-wrap gap-2">
                      {pipeline.stages?.map((stage) => (
                        <StageChip key={stage.id} stage={stage} />
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="text-muted-foreground">
                        Currency: <span className="text-foreground font-medium">{pipeline.currency}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Win Prob:{" "}
                        <span className="text-foreground font-medium">
                          {pipeline.win_probability_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Stages:{" "}
                        <span className="text-foreground font-medium">{pipeline.stages?.length ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
