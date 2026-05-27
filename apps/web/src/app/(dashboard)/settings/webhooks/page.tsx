"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Webhook,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const AVAILABLE_EVENTS = [
  "crm.contact.created",
  "crm.contact.updated",
  "crm.deal.created",
  "crm.deal.stage_changed",
  "crm.deal.won",
  "crm.deal.lost",
  "hr.employee.created",
  "hr.leave.approved",
  "helpdesk.ticket.created",
  "helpdesk.ticket.resolved",
  "projects.task.created",
  "projects.task.completed",
  "accounting.invoice.paid",
  "forms.submission.created",
];

function WebhookRow({ sub }: { sub: any }) {
  const utils = api.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = api.platform.webhooks.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook removed.");
      void utils.platform.webhooks.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = api.platform.webhooks.update.useMutation({
    onSuccess: () => void utils.platform.webhooks.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={sub.is_active ? "success" : "secondary"} className="text-xs">
              {sub.is_active ? "Active" : "Inactive"}
            </Badge>
            {sub.failure_count > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertCircle className="w-3 h-3" />
                {sub.failure_count} failure{sub.failure_count !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm font-mono text-muted-foreground mt-0.5 truncate">{sub.url}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sub.events.length} event{sub.events.length !== 1 ? "s" : ""} subscribed
            {sub.last_triggered_at && (
              <> · Last triggered {format(new Date(sub.last_triggered_at), "MMM dd HH:mm")}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={sub.is_active}
            onCheckedChange={(v) => updateMutation.mutate({ id: sub.id, data: { is_active: v } })}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          <Separator />
          <div className="p-4 bg-muted/10">
            <p className="text-xs font-medium text-muted-foreground mb-2">Subscribed Events</p>
            <div className="flex flex-wrap gap-1.5">
              {sub.events.map((e: string) => (
                <Badge key={e} variant="outline" className="text-xs font-mono">
                  {e}
                </Badge>
              ))}
            </div>
            {sub.secret && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Signing Secret (HMAC)
                </p>
                <code className="text-xs font-mono bg-muted rounded px-2 py-1">
                  {sub.secret.slice(0, 8)}••••••••
                </code>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Webhook</DialogTitle>
            <DialogDescription>This webhook will stop receiving events.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: sub.id })}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WebhooksSettingsPage() {
  const utils = api.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ url: "", events: [] as string[] });

  const { data: subs, isLoading } = api.platform.webhooks.list.useQuery();

  const createMutation = api.platform.webhooks.create.useMutation({
    onSuccess: () => {
      toast.success("Webhook created.");
      setCreateOpen(false);
      setForm({ url: "", events: [] });
      void utils.platform.webhooks.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleEvent = (e: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Subscribe to ZenFlow events and receive them at your endpoint via HTTP POST.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Webhook
        </Button>
      </div>

      {subs && subs.length > 0 ? (
        <div className="space-y-3">
          {subs.map((sub: any) => (
            <WebhookRow key={sub.id} sub={sub} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Webhook className="w-8 h-8" />
            <p className="text-sm">No webhooks configured.</p>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Enter your endpoint URL and select which events to subscribe to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Endpoint URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://your-server.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>Events to subscribe</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto border border-border rounded-lg p-3">
                {AVAILABLE_EVENTS.map((e) => (
                  <div key={e} className="flex items-center gap-2">
                    <Checkbox
                      id={`evt-${e}`}
                      checked={form.events.includes(e)}
                      onCheckedChange={() => toggleEvent(e)}
                    />
                    <label htmlFor={`evt-${e}`} className="text-xs font-mono cursor-pointer">
                      {e}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: form.url,
                  url: form.url,
                  events: form.events,
                })
              }
              disabled={!form.url || form.events.length === 0}
              loading={createMutation.isPending}
            >
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
