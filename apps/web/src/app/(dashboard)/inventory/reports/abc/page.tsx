"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

const CLASS_COLORS = {
  A: { bg: "bg-green-500", text: "text-green-600", badge: "bg-green-500/10 text-green-600" },
  B: { bg: "bg-amber-500", text: "text-amber-600", badge: "bg-amber-500/10 text-amber-600" },
  C: { bg: "bg-muted", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

export default function ABCAnalysisPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const [fromDate, setFromDate] = useState(defaultFrom.toISOString().split("T")[0]!);
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0]!);

  const { data, isLoading } = api.inventory.reports.abcAnalysis.useQuery({
    from_date: fromDate,
    to_date: toDate,
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  const counts = data
    ? {
        A: data.items.filter((i) => i.classification === "A").length,
        B: data.items.filter((i) => i.classification === "B").length,
        C: data.items.filter((i) => i.classification === "C").length,
      }
    : { A: 0, B: 0, C: 0 };

  const values = data
    ? {
        A: data.items.filter((i) => i.classification === "A").reduce((s, i) => s + i.usage_value, 0),
        B: data.items.filter((i) => i.classification === "B").reduce((s, i) => s + i.usage_value, 0),
        C: data.items.filter((i) => i.classification === "C").reduce((s, i) => s + i.usage_value, 0),
      }
    : { A: 0, B: 0, C: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">ABC Analysis</h1>
          <p className="text-muted-foreground mt-1">Pareto analysis of inventory by sales value</p>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none" />
        </div>
      </div>

      {/* Class cards */}
      <div className="grid grid-cols-3 gap-4">
        {(["A", "B", "C"] as const).map((cls) => (
          <div key={cls} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white", CLASS_COLORS[cls].bg)}>
                {cls}
              </div>
              <div>
                <p className="font-semibold">Class {cls}</p>
                <p className="text-xs text-muted-foreground">
                  {cls === "A" ? "Top 70% of value" : cls === "B" ? "Next 20%" : "Bottom 10%"}
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold">{counts[cls]}</p>
            <p className="text-sm text-muted-foreground">products</p>
            <p className={cn("mt-1 text-sm font-semibold", CLASS_COLORS[cls].text)}>
              {formatCurrency(values[cls])}
            </p>
          </div>
        ))}
      </div>

      {/* Pareto bar chart (visual bars) */}
      {data && data.items.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Usage Value Distribution (Top 20 Products)
          </h2>
          <div className="space-y-2">
            {data.items.slice(0, 20).map((item) => {
              const maxValue = data.items[0]?.usage_value ?? 1;
              const pct = (item.usage_value / maxValue) * 100;
              const colors = CLASS_COLORS[item.classification];
              return (
                <div key={item.product_id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-medium truncate" title={item.name}>{item.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                  </div>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", colors.bg)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={cn("text-xs font-semibold w-24 text-right shrink-0", colors.text)}>
                    {formatCurrency(item.usage_value)}
                  </span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", colors.badge)}>
                    {item.classification}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Calculating ABC analysis…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No sales data in the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Rank", "Product", "SKU", "Usage Value", "Cumulative %", "Class"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item, i) => {
                  const colors = CLASS_COLORS[item.classification];
                  return (
                    <tr key={item.product_id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 text-sm text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-sm">{item.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                      <td className="px-5 py-3 text-sm font-semibold">{formatCurrency(item.usage_value)}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{item.cumulative_pct.toFixed(1)}%</td>
                      <td className="px-5 py-3">
                        <span className={cn("inline-flex px-2.5 py-1 rounded-full text-xs font-bold", colors.badge)}>
                          {item.classification}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
