// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import {
  ArrowLeftRight,
  Plus,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  FileEdit,
  ChevronDown,
  X,
} from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

type TransferStatus = "draft" | "in_transit" | "received" | "cancelled";

const STATUS_CONFIG: Record<TransferStatus, { icon: React.ElementType; label: string; colors: string }> = {
  draft: { icon: FileEdit, label: "Draft", colors: "bg-muted text-muted-foreground" },
  in_transit: { icon: Truck, label: "In Transit", colors: "bg-blue-500/10 text-blue-600" },
  received: { icon: CheckCircle, label: "Received", colors: "bg-green-500/10 text-green-600" },
  cancelled: { icon: XCircle, label: "Cancelled", colors: "bg-red-500/10 text-red-600" },
};

function CreateTransferDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: warehouses } = api.inventory.warehousesV2.list.useQuery();
  const { data: products } = api.inventory.products.list.useQuery({ limit: 200, offset: 0 });

  const [fromWh, setFromWh] = useState("");
  const [toWh, setToWh] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([
    { product_id: "", quantity_requested: 1, unit_cost: 0 },
  ]);

  const mutation = api.inventory.transfers.create.useMutation({
    onSuccess: () => {
      toast.success("Transfer created");
      void utils.inventory.transfers.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const addLine = () => setLines((prev) => [...prev, { product_id: "", quantity_requested: 1, unit_cost: 0 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: string, val: string | number) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));
  };

  const canSubmit = fromWh && toWh && fromWh !== toWh && lines.every((l) => l.product_id && l.quantity_requested > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">Create Transfer</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">From Warehouse *</label>
              <select
                value={fromWh}
                onChange={(e) => setFromWh(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">Select warehouse</option>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">To Warehouse *</label>
              <select
                value={toWh}
                onChange={(e) => setToWh(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">Select warehouse</option>
                {warehouses?.filter((w) => w.id !== fromWh).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Transfer Lines *</label>
              <button onClick={addLine} className="text-xs text-brand-500 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(i, "product_id", e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    <option value="">Select product</option>
                    {products?.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity_requested}
                    onChange={(e) => updateLine(i, "quantity_requested", parseFloat(e.target.value) || 1)}
                    placeholder="Qty"
                    className="w-24 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                  <input
                    type="number"
                    min={0}
                    value={line.unit_cost}
                    onChange={(e) => updateLine(i, "unit_cost", parseFloat(e.target.value) || 0)}
                    placeholder="Cost"
                    className="w-28 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(i)} className="p-2 text-muted-foreground hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() =>
              mutation.mutate({
                from_warehouse_id: fromWh,
                to_warehouse_id: toWh,
                notes: notes || undefined,
                lines: lines.map((l) => ({
                  product_id: l.product_id,
                  quantity_requested: l.quantity_requested,
                  unit_cost: l.unit_cost,
                })),
              })
            }
            disabled={mutation.isPending || !canSubmit}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TransfersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const utils = api.useUtils();
  const { data, isLoading } = api.inventory.transfers.list.useQuery({
    status: (statusFilter || undefined) as TransferStatus | undefined,
    limit,
    offset: page * limit,
  });

  const cancelMutation = api.inventory.transfers.cancel.useMutation({
    onSuccess: () => {
      toast.success("Transfer cancelled");
      void utils.inventory.transfers.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showCreate && <CreateTransferDialog onClose={() => setShowCreate(false)} />}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Transfers</h1>
            <p className="text-muted-foreground mt-1">Inter-warehouse stock transfers</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Transfer
          </button>
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 flex-wrap">
          {(["", "draft", "in_transit", "received", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s as TransferStatus | ""); setPage(0); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize",
                statusFilter === s
                  ? "bg-brand-500 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading transfers…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No transfers found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Transfer #", "From", "To", "Lines", "Status", "Created", "Actions"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((t) => {
                      const statusConf = STATUS_CONFIG[t.status as TransferStatus] ?? STATUS_CONFIG.draft;
                      const Icon = statusConf.icon;
                      return (
                        <tr key={t.id} className="hover:bg-muted/20">
                          <td className="px-5 py-4 font-mono text-sm font-semibold">{t.transfer_number}</td>
                          <td className="px-5 py-4 text-sm">{t.from_warehouse.name}</td>
                          <td className="px-5 py-4 text-sm">{t.to_warehouse.name}</td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">{t._count.lines}</td>
                          <td className="px-5 py-4">
                            <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize", statusConf.colors)}>
                              <Icon className="w-3 h-3" />
                              {statusConf.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">
                            {format(new Date(t.created_at), "MMM dd, yyyy")}
                          </td>
                          <td className="px-5 py-4">
                            {t.status !== "cancelled" && t.status !== "received" && (
                              <button
                                onClick={() => {
                                  if (window.confirm("Cancel this transfer?")) {
                                    cancelMutation.mutate({ id: t.id });
                                  }
                                }}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Cancel
                              </button>
                            )}
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
    </>
  );
}
