// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { GitBranch, Plus, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

function CreateBOMDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: products } = api.inventory.products.list.useQuery({ limit: 200, offset: 0 });

  const [form, setForm] = useState({
    product_id: "",
    name: "",
    version: "1.0",
    quantity: 1,
    overhead_cost: 0,
    is_default: true,
  });
  const [lines, setLines] = useState([
    { component_product_id: "", quantity: 1, unit: "", scrap_percent: 0, position: 0 },
  ]);

  const mutation = api.inventory.bom.create.useMutation({
    onSuccess: () => {
      toast.success("BOM created");
      void utils.inventory.bom.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const addLine = () =>
    setLines((p) => [...p, { component_product_id: "", quantity: 1, unit: "", scrap_percent: 0, position: p.length }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: string, val: string | number) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">Create BOM</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Finished Product *</label>
              <select
                value={form.product_id}
                onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value, name: products?.items.find((p) => p.id === e.target.value)?.name + " BOM" || "" }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none"
              >
                <option value="">Select product</option>
                {products?.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">BOM Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Version</label>
              <input type="text" value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Output Quantity</label>
              <input type="number" min={0.0001} step="any" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: parseFloat(e.target.value) || 1 }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Overhead Cost (₹)</label>
              <input type="number" min={0} step="any" value={form.overhead_cost} onChange={(e) => setForm((f) => ({ ...f, overhead_cost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Components *</label>
              <button onClick={addLine} className="text-xs text-brand-500 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                <span className="col-span-5">Component</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Scrap %</span>
                <span className="col-span-2">Unit</span>
                <span className="col-span-1" />
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select value={line.component_product_id} onChange={(e) => updateLine(i, "component_product_id", e.target.value)}
                    className="col-span-5 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none">
                    <option value="">Select component</option>
                    {products?.items.filter((p) => p.id !== form.product_id).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <input type="number" min={0} step="any" value={line.quantity} onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
                  <input type="number" min={0} max={100} step="any" value={line.scrap_percent} onChange={(e) => updateLine(i, "scrap_percent", parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
                  <input type="text" value={line.unit} onChange={(e) => updateLine(i, "unit", e.target.value)} placeholder="pcs"
                    className="col-span-2 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none" />
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(i)} className="col-span-1 text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() => mutation.mutate({ ...form, lines: lines.map((l, idx) => ({ ...l, position: idx })) })}
            disabled={mutation.isPending || !form.product_id || !form.name || lines.some((l) => !l.component_product_id)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create BOM"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BOMPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading } = api.inventory.bom.list.useQuery({ limit, offset: page * limit });
  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showCreate && <CreateBOMDialog onClose={() => setShowCreate(false)} />}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bill of Materials</h1>
            <p className="text-muted-foreground mt-1">Define component requirements for manufactured products</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            Create BOM
          </button>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading BOMs…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No BOMs defined yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Product", "BOM Name", "Version", "Components", "Default", "Created", "Actions"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((bom) => (
                      <tr key={bom.id} className="hover:bg-muted/20">
                        <td className="px-5 py-4">
                          <p className="font-medium text-sm">{bom.product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{bom.product.sku}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium">{bom.name}</td>
                        <td className="px-5 py-4 font-mono text-sm text-muted-foreground">{bom.version}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{bom._count.lines}</td>
                        <td className="px-5 py-4">
                          {bom.is_default && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-500">Default</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {format(new Date(bom.created_at), "MMM dd, yyyy")}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/inventory/bom/${bom.id}`}
                            className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
                          >
                            View <ChevronRight className="w-3 h-3" />
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
