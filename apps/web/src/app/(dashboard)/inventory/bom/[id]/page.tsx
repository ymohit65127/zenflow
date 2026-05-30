"use client";

import { use, useState } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle, Layers, Calculator } from "lucide-react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

export default function BOMDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [explodeQty, setExplodeQty] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState("");

  const { data: bom, isLoading } = api.inventory.bom.get.useQuery({ id });
  const { data: warehouses } = api.inventory.warehousesV2.list.useQuery();
  const { data: explosion, isLoading: exploding } = api.inventory.bom.explode.useQuery(
    { bom_id: id, quantity: explodeQty, warehouse_id: warehouseFilter || undefined },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!bom) return <div className="p-10 text-center text-muted-foreground">BOM not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory/bom" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{bom.name}</h1>
          <p className="text-muted-foreground mt-0.5">
            {bom.product.name} · v{bom.version}
          </p>
        </div>
        {bom.is_active && (
          <span className="ml-2 text-xs px-2 py-0.5 bg-brand-500/10 text-brand-500 rounded-full font-medium">
            Active
          </span>
        )}
      </div>

      {/* BOM Components */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Components</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Per {Number(bom.output_qty)} units of output
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["#", "Component", "Quantity", "Unit", "Scrap %", "Notes"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bom.lines.map((line) => (
                <tr key={line.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3 text-sm text-muted-foreground">{line.position + 1}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-sm">{line.component.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{line.component.sku}</p>
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold">{Number(line.quantity)}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{String(line.unit_of_measure)}</td>
                  <td className="px-5 py-3 text-sm">—</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{line.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>Output Qty: <strong className="text-foreground">{Number(bom.output_qty)}</strong></span>
        </div>
      </div>

      {/* BOM Explosion */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-brand-500" />
              BOM Explosion
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Check material requirements and availability</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Quantity:</label>
              <input
                type="number"
                min={1}
                value={explodeQty}
                onChange={(e) => setExplodeQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            {warehouses && warehouses.length > 0 && (
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {exploding ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Calculating…
          </div>
        ) : explosion ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Component", "Required", "Available", "Shortage", "Unit Cost", "Total Cost"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {explosion.components.map((comp) => {
                    const hasShortage = comp.shortage > 0;
                    return (
                      <tr key={comp.product_id} className={cn("hover:bg-muted/20", hasShortage && "bg-red-500/5")}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-sm">{comp.product_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{comp.sku}</p>
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold">
                          {comp.required_quantity.toFixed(2)} {comp.unit}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <span className={cn(
                            comp.available_quantity >= comp.required_quantity ? "text-green-600" : "text-red-500",
                            "font-medium"
                          )}>
                            {comp.available_quantity.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {hasShortage ? (
                            <span className="flex items-center gap-1 text-red-500 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              {comp.shortage.toFixed(2)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">₹{comp.unit_cost.toFixed(2)}</td>
                        <td className="px-5 py-3 text-sm font-medium">₹{comp.total_cost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-border grid grid-cols-1 gap-4 text-sm">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Material Cost</p>
                <p className="font-bold text-lg">₹{explosion.total_material_cost.toFixed(2)}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Select a quantity to see material requirements</p>
          </div>
        )}
      </div>
    </div>
  );
}
