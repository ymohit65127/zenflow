// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import {
  ArrowUpDown,
  Search,
  Warehouse,
  Filter,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const MOVEMENT_TYPES = [
  "purchase_receipt",
  "sale_delivery",
  "transfer_out",
  "transfer_in",
  "adjustment_in",
  "adjustment_out",
  "production_input",
  "production_output",
  "return_in",
  "return_out",
  "opening_balance",
  "scrapped",
] as const;

type MovementType = (typeof MOVEMENT_TYPES)[number];

const OUTBOUND = new Set([
  "sale_delivery",
  "transfer_out",
  "adjustment_out",
  "production_input",
  "return_out",
  "scrapped",
]);

function MovementTypeBadge({ type }: { type: string }) {
  const isOut = OUTBOUND.has(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        isOut
          ? "bg-red-500/10 text-red-600"
          : "bg-green-500/10 text-green-600"
      )}
    >
      {isOut ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
      {type.replace(/_/g, " ")}
    </span>
  );
}

export default function MovementsPage() {
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementType | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = api.inventory.movements.list.useQuery({
    warehouse_id: warehouseFilter || undefined,
    movement_type: (typeFilter || undefined) as MovementType | undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    limit,
    offset: page * limit,
  });

  const { data: warehouses } = api.inventory.warehousesV2.list.useQuery();
  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movement History</h1>
          <p className="text-muted-foreground mt-1">Complete stock movement audit trail</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {warehouses && warehouses.length > 0 && (
          <div className="relative">
            <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={warehouseFilter}
              onChange={(e) => { setWarehouseFilter(e.target.value); setPage(0); }}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as MovementType | ""); setPage(0); }}
            className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
          >
            <option value="">All Types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          placeholder="From date"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(0); }}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          placeholder="To date"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading movements…
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <ArrowUpDown className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No movements found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Date", "Product", "Type", "Warehouse", "Qty", "Unit Cost", "Total", "Running Stock", "Reference"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map((m) => {
                    const isOut = OUTBOUND.has(m.movement_type);
                    return (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(m.movement_date), "MMM dd, yyyy HH:mm")}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-sm">{m.product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.product.sku}</p>
                        </td>
                        <td className="px-5 py-3">
                          <MovementTypeBadge type={m.movement_type} />
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm text-muted-foreground">{m.warehouse.name}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            "font-semibold text-sm",
                            isOut ? "text-red-500" : "text-green-600"
                          )}>
                            {isOut ? "-" : "+"}{Number(m.quantity)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {Number(m.unit_cost) > 0 ? `₹${Number(m.unit_cost).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {Number(m.total_cost) > 0 ? `₹${Number(m.total_cost).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium">
                          {Number(m.running_stock)}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {m.reference_type && m.reference_id ? (
                            <span className="font-mono">{m.reference_type}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, data?.total ?? 0)} of {data?.total}
                </p>
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
  );
}
