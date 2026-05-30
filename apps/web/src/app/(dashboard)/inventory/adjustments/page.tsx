"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  Plus,
  CheckCircle,
  FileEdit,
  X,
} from "lucide-react";
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

const REASONS = [
  "count_discrepancy",
  "damage",
  "expiry",
  "theft",
  "other",
] as const;
type AdjReason = (typeof REASONS)[number];

function CreateAdjustmentDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: warehouses } = api.inventory.warehousesV2.list.useQuery();
  const { data: products } = api.inventory.products.list.useQuery({ limit: 200, offset: 0 });

  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState<AdjReason>("count_discrepancy");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { product_id: "", qty_before: 0, qty_after: 0, unit_cost: 0 },
  ]);

  const mutation = api.inventory.adjustments.create.useMutation({
    onSuccess: () => {
      toast.success("Adjustment created");
      void utils.inventory.adjustments.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const addLine = () => setLines((p) => [...p, { product_id: "", qty_before: 0, qty_after: 0, unit_cost: 0 }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: string, val: string | number) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">Create Stock Adjustment</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Warehouse *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">Select</option>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as AdjReason)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 capitalize"
              >
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Adjustment Lines</label>
              <button onClick={addLine} className="text-xs text-brand-500 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add Line</button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                <span className="col-span-4">Product</span>
                <span className="col-span-2">Before</span>
                <span className="col-span-2">After</span>
                <span className="col-span-2">Unit Cost</span>
                <span className="col-span-1 text-center">Change</span>
                <span className="col-span-1" />
              </div>
              {lines.map((line, i) => {
                const change = line.qty_after - line.qty_before;
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={line.product_id}
                      onChange={(e) => updateLine(i, "product_id", e.target.value)}
                      className="col-span-4 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    >
                      <option value="">Select product</option>
                      {products?.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                    <input type="number" min={0} value={line.qty_before} onChange={(e) => updateLine(i, "qty_before", parseFloat(e.target.value) || 0)} className="col-span-2 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
                    <input type="number" min={0} value={line.qty_after} onChange={(e) => updateLine(i, "qty_after", parseFloat(e.target.value) || 0)} className="col-span-2 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
                    <input type="number" min={0} step="any" value={line.unit_cost} onChange={(e) => updateLine(i, "unit_cost", parseFloat(e.target.value) || 0)} className="col-span-2 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
                    <span className={cn("col-span-1 text-center text-sm font-semibold", change > 0 ? "text-green-600" : change < 0 ? "text-red-500" : "text-muted-foreground")}>
                      {change > 0 ? `+${change}` : change}
                    </span>
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)} className="col-span-1 text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() =>
              mutation.mutate({
                warehouse_id: warehouseId,
                reason,
                notes: notes || undefined,
                lines: lines.map((l) => ({
                  product_id: l.product_id,
                  qty_before: l.qty_before,
                  qty_after: l.qty_after,
                  unit_cost: l.unit_cost,
                })),
              })
            }
            disabled={mutation.isPending || !warehouseId || lines.some((l) => !l.product_id)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdjustmentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"draft" | "approved" | "posted" | "cancelled" | "">("");
  const [page, setPage] = useState(0);
  const limit = 20;
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data, isLoading } = api.inventory.adjustments.list.useQuery({
    status: (statusFilter || undefined) as "draft" | "approved" | "posted" | "cancelled" | undefined,
    limit,
    offset: page * limit,
  });

  const postMutation = api.inventory.adjustments.post.useMutation({
    onSuccess: () => {
      toast.success("Adjustment posted");
      void utils.inventory.adjustments.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const voidMutation = api.inventory.adjustments.void.useMutation({
    onSuccess: () => {
      toast.success("Adjustment voided");
      void utils.inventory.adjustments.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showCreate && <CreateAdjustmentDialog onClose={() => setShowCreate(false)} />}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Stock Adjustments</h1>
            <p className="text-muted-foreground mt-1">Record stock corrections and write-offs</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Adjustment
          </button>
        </div>

        <div className="flex gap-2">
          {(["", "draft", "approved", "posted", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium capitalize",
                statusFilter === s ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "" ? "All" : s}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading adjustments…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No adjustments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Adj #", "Warehouse ID", "Reason", "Lines", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map((adj) => (
                    <tr key={adj.id} className="hover:bg-muted/20">
                      <td className="px-5 py-4 font-mono text-sm font-semibold">{adj.adjustment_number}</td>
                      <td className="px-5 py-4 text-sm font-mono text-muted-foreground">{adj.warehouse_id}</td>
                      <td className="px-5 py-4">
                        <span className="text-sm capitalize">{adj.reason}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{adj._count.lines}</td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                          adj.status === "posted" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                        )}>
                          {adj.status === "posted" ? <CheckCircle className="w-3 h-3" /> : <FileEdit className="w-3 h-3" />}
                          {adj.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {adj.status === "draft" && (
                          <div className="flex gap-2">
                            <button onClick={() => postMutation.mutate({ id: adj.id })} className="text-xs text-green-600 hover:underline">Post</button>
                            <button onClick={() => setConfirmVoidId(adj.id)} className="text-xs text-red-500 hover:underline">Void</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!confirmVoidId} onOpenChange={(open) => { if (!open) setConfirmVoidId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this adjustment?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVoidId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmVoidId) { voidMutation.mutate({ id: confirmVoidId }); setConfirmVoidId(null); } }}>Void</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
