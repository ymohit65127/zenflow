"use client";

import { useState } from "react";
import { Factory, Plus, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

type ProdStatus = "draft" | "released" | "in_progress" | "completed" | "cancelled";
const STATUS_COLORS: Record<ProdStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  released: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-amber-500/10 text-amber-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
};

function CreateOrderDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: products } = api.inventory.products.list.useQuery({ limit: 200, offset: 0 });
  const { data: warehouses } = api.inventory.warehousesV2.list.useQuery();

  const [form, setForm] = useState({
    product_id: "",
    bom_id: "",
    planned_qty: 1,
    warehouse_id: "",
    planned_start: "",
    planned_end: "",
    notes: "",
  });

  const { data: boms } = api.inventory.bom.list.useQuery(
    { product_id: form.product_id },
    { enabled: !!form.product_id }
  );

  const mutation = api.inventory.production.create.useMutation({
    onSuccess: () => {
      toast.success("Production order created");
      void utils.inventory.production.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Create Production Order</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Product *</label>
            <select value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value, bom_id: "" }))}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none">
              <option value="">Select product</option>
              {products?.items.filter((p) => p.track_inventory).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">BOM *</label>
            <select value={form.bom_id} onChange={(e) => setForm((f) => ({ ...f, bom_id: e.target.value }))}
              disabled={!form.product_id}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none disabled:opacity-50">
              <option value="">Select BOM</option>
              {boms?.items.map((b) => <option key={b.id} value={b.id}>{b.name} v{b.version}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Quantity *</label>
              <input type="number" min={1} value={form.planned_qty} onChange={(e) => setForm((f) => ({ ...f, planned_qty: parseFloat(e.target.value) || 1 }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Warehouse *</label>
              <select value={form.warehouse_id} onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none">
                <option value="">Select</option>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Planned Start</label>
              <input type="date" value={form.planned_start} onChange={(e) => setForm((f) => ({ ...f, planned_start: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Planned End</label>
              <input type="date" value={form.planned_end} onChange={(e) => setForm((f) => ({ ...f, planned_end: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() => mutation.mutate({
              product_id: form.product_id,
              bom_id: form.bom_id,
              planned_qty: form.planned_qty,
              warehouse_id: form.warehouse_id,
              planned_start: form.planned_start || undefined,
              planned_end: form.planned_end || undefined,
              notes: form.notes || undefined,
            })}
            disabled={mutation.isPending || !form.product_id || !form.bom_id || !form.warehouse_id}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductionPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProdStatus | "">("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading } = api.inventory.production.list.useQuery({
    status: (statusFilter || undefined) as ProdStatus | undefined,
    limit,
    offset: page * limit,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showCreate && <CreateOrderDialog onClose={() => setShowCreate(false)} />}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Production Orders</h1>
            <p className="text-muted-foreground mt-1">Manage manufacturing orders</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["", "draft", "released", "in_progress", "completed", "cancelled"] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s as ProdStatus | ""); setPage(0); }}
              className={cn("px-3 py-1.5 rounded-full text-sm font-medium capitalize", statusFilter === s ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {s === "" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Factory className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No production orders found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Order #", "BOM", "Planned Qty", "Status", "Planned", "Actions"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/20">
                        <td className="px-5 py-4 font-mono text-sm font-semibold">{order.order_number}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{order.bom?.name ?? "—"}</td>
                        <td className="px-5 py-4 text-sm font-semibold">{Number(order.planned_qty)}</td>
                        <td className="px-5 py-4">
                          <span className={cn("inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize", STATUS_COLORS[order.status as ProdStatus] ?? STATUS_COLORS.draft)}>
                            {order.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {order.planned_start ? format(new Date(order.planned_start), "MMM dd") : "—"}
                          {order.planned_end ? ` → ${format(new Date(order.planned_end), "MMM dd")}` : ""}
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/inventory/production/${order.id}`} className="flex items-center gap-1 text-xs text-brand-500 hover:underline">
                            Manage <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
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
