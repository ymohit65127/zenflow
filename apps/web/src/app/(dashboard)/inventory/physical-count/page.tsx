// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { ClipboardList, Plus, X, ChevronRight, CheckCircle, Play, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CountStatus = "draft" | "counting" | "reconciled" | "posted";
const STATUS_COLORS: Record<CountStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  counting: "bg-amber-500/10 text-amber-600",
  reconciled: "bg-blue-500/10 text-blue-600",
  posted: "bg-green-500/10 text-green-600",
};

function CreateCountDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: warehouses } = api.inventory.warehousesV2.list.useQuery();
  const [form, setForm] = useState({
    warehouse_id: "",
    scope: "full" as "full" | "partial" | "category" | "location",
    scheduled_date: "",
    notes: "",
  });

  const mutation = api.inventory.physicalCount.create.useMutation({
    onSuccess: () => {
      toast.success("Physical count created");
      void utils.inventory.physicalCount.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Create Physical Count</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Warehouse *</label>
            <select value={form.warehouse_id} onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none">
              <option value="">Select warehouse</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Scope</label>
            <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as typeof form.scope }))}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none capitalize">
              {["full", "partial", "category", "location"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Scheduled Date</label>
            <input type="date" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none resize-none" />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() => mutation.mutate({ ...form, notes: form.notes || undefined, scheduled_date: form.scheduled_date || undefined })}
            disabled={mutation.isPending || !form.warehouse_id}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create Count"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhysicalCountPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 20;
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data, isLoading } = api.inventory.physicalCount.list.useQuery({ limit, offset: page * limit });

  const startMutation = api.inventory.physicalCount.start.useMutation({
    onSuccess: () => { toast.success("Count started"); void utils.inventory.physicalCount.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const reconcileMutation = api.inventory.physicalCount.reconcile.useMutation({
    onSuccess: () => { toast.success("Count reconciled"); void utils.inventory.physicalCount.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const postMutation = api.inventory.physicalCount.post.useMutation({
    onSuccess: (result) => {
      toast.success(`Posted. ${result.variance_count} variances, ₹${result.total_value_change.toFixed(2)} change`);
      void utils.inventory.physicalCount.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showCreate && <CreateCountDialog onClose={() => setShowCreate(false)} />}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Physical Count</h1>
            <p className="text-muted-foreground mt-1">Cycle counts and full inventory audits</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            New Count
          </button>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading counts…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No physical counts yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Count #", "Warehouse", "Scope", "Lines", "Status", "Scheduled", "Actions"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((count) => {
                      const status = count.status as CountStatus;
                      return (
                        <tr key={count.id} className="hover:bg-muted/20">
                          <td className="px-5 py-4 font-mono text-sm font-semibold">{count.count_number}</td>
                          <td className="px-5 py-4 text-sm">{count.warehouse.name}</td>
                          <td className="px-5 py-4">
                            <span className="capitalize text-sm">{count.scope}</span>
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">{count._count.lines}</td>
                          <td className="px-5 py-4">
                            <span className={cn("inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize", STATUS_COLORS[status] ?? STATUS_COLORS.draft)}>
                              {count.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">
                            {count.scheduled_date ? format(new Date(count.scheduled_date), "MMM dd, yyyy") : "—"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {status === "draft" && (
                                <button onClick={() => startMutation.mutate({ id: count.id })} className="flex items-center gap-1 text-xs text-amber-600 hover:underline">
                                  <Play className="w-3 h-3" /> Start
                                </button>
                              )}
                              {status === "counting" && (
                                <button onClick={() => reconcileMutation.mutate({ id: count.id })} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                  <ClipboardCheck className="w-3 h-3" /> Reconcile
                                </button>
                              )}
                              {status === "reconciled" && (
                                <button onClick={() => setConfirmPostId(count.id)} className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                                  <CheckCircle className="w-3 h-3" /> Post
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">Page {page + 1} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Previous</button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={!!confirmPostId} onOpenChange={(open) => { if (!open) setConfirmPostId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post this count?</DialogTitle>
            <DialogDescription>This will finalize the physical count and update inventory levels.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPostId(null)}>Cancel</Button>
            <Button onClick={() => { if (confirmPostId) { postMutation.mutate({ id: confirmPostId }); setConfirmPostId(null); } }}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
