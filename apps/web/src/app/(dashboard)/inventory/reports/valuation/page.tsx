"use client";

import { useState } from "react";
import {
  DollarSign,
  Warehouse,
  BarChart3,
  TrendingUp,
  Package,
  ChevronDown,
} from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

export default function ValuationReportPage() {
  const [warehouseFilter, setWarehouseFilter] = useState("");

  const { data: warehouses } = api.inventory.warehousesV2.list.useQuery();
  const { data, isLoading } = api.inventory.reports.stockValuation.useQuery({
    warehouse_id: warehouseFilter || undefined,
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Valuation Report</h1>
          <p className="text-muted-foreground mt-1">Inventory value by product and warehouse</p>
        </div>
        {warehouses && warehouses.length > 0 && (
          <div className="relative">
            <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-brand-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-brand-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data.totalValue)}</p>
            <p className="text-muted-foreground text-sm mt-0.5">Total Inventory Value</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-cyan-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{data.totalItems}</p>
            <p className="text-muted-foreground text-sm mt-0.5">Total SKU Lines</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-violet-500/10 rounded-xl flex items-center justify-center">
                <Warehouse className="w-5 h-5 text-violet-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{data.byWarehouse.length}</p>
            <p className="text-muted-foreground text-sm mt-0.5">Warehouses</p>
          </div>
        </div>
      )}

      {/* By warehouse breakdown */}
      {data && data.byWarehouse.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            By Warehouse
          </h2>
          <div className="space-y-3">
            {data.byWarehouse
              .sort((a, b) => b.value - a.value)
              .map((wh) => {
                const pct = data.totalValue > 0 ? (wh.value / data.totalValue) * 100 : 0;
                return (
                  <div key={wh.warehouse_id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{wh.name}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{wh.skus} SKUs</span>
                        <span className="font-semibold text-foreground">{formatCurrency(wh.value)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Detailed table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Calculating valuation…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No stock data found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Product", "SKU", "Warehouse", "Qty on Hand", "Avg Cost", "Total Value", "Unit"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium text-sm">{item.product_name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{item.warehouse_name}</td>
                    <td className="px-5 py-3 text-sm font-semibold">{item.quantity_on_hand.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">₹{item.average_cost.toFixed(4)}</td>
                    <td className="px-5 py-3 text-sm font-bold text-brand-500">{formatCurrency(item.total_value)}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{item.unit_of_measure}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/10">
                  <td colSpan={5} className="px-5 py-3 text-sm font-semibold">Total</td>
                  <td className="px-5 py-3 text-sm font-bold text-brand-500">{formatCurrency(data.totalValue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
