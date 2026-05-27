// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { Receipt, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GSTReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, refetch } = api.accounting.reports.gstSummary.useQuery(
    { month, year },
    { enabled: false }
  );

  const handleRun = () => void refetch();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GST Summary (GSTR-1)</h1>
        <p className="text-muted-foreground mt-1">
          Goods & Services Tax — outward and inward supply summary
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Month</label>
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50">
            {MONTHS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Year</label>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50">
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>
        <button onClick={handleRun} disabled={isLoading}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {isLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running…</> : "Generate Report"}
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Outward Tax Collected", value: data.outward_supplies.tax_amount, icon: TrendingUp, cls: "text-green-500", bg: "bg-green-500/10" },
              { label: "Input Tax Credit", value: data.input_tax_credit, icon: TrendingDown, cls: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Net Tax Payable", value: data.net_tax_payable, icon: DollarSign, cls: "text-orange-500", bg: "bg-orange-500/10" },
              { label: "Tax Liability", value: data.tax_liability, icon: Receipt, cls: data.tax_liability >= 0 ? "text-red-500" : "text-green-500", bg: data.tax_liability >= 0 ? "bg-red-500/10" : "bg-green-500/10" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.cls)} />
                </div>
                <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                <p className={cn("text-xl font-bold", s.cls)}>{formatCurrency(s.value, "INR")}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Outward Supplies */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-green-500/5">
                <h2 className="font-semibold text-green-600">Outward Supplies (GSTR-1)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{MONTHS[month - 1]} {year}</p>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: "Invoices", value: data.outward_supplies.count },
                  { label: "Taxable Value", value: formatCurrency(data.outward_supplies.taxable_amount, "INR") },
                  { label: "GST Collected", value: formatCurrency(data.outward_supplies.tax_amount, "INR") },
                  { label: "Total Invoice Value", value: formatCurrency(data.outward_supplies.total, "INR") },
                ].map((row) => (
                  <div key={row.label} className="px-6 py-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-sm">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Inward Supplies */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-blue-500/5">
                <h2 className="font-semibold text-blue-600">Inward Supplies (GSTR-2)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{MONTHS[month - 1]} {year}</p>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: "Bills", value: data.inward_supplies.count },
                  { label: "Taxable Value", value: formatCurrency(data.inward_supplies.taxable_amount, "INR") },
                  { label: "Input Tax Credit", value: formatCurrency(data.inward_supplies.tax_amount, "INR") },
                  { label: "Total Bill Value", value: formatCurrency(data.inward_supplies.total, "INR") },
                ].map((row) => (
                  <div key={row.label} className="px-6 py-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-sm">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tax computation */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">GST Tax Computation</h2>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Output Tax (Tax Collected on Sales)", value: data.outward_supplies.tax_amount, cls: "text-foreground" },
                { label: "Input Tax Credit (ITC Available)", value: -data.input_tax_credit, cls: "text-green-600" },
                { label: "Net GST Payable", value: data.net_tax_payable, cls: data.net_tax_payable > 0 ? "text-red-500 font-bold" : "text-green-500 font-bold" },
              ].map((row) => (
                <div key={row.label} className="px-6 py-4 flex items-center justify-between">
                  <span className="text-sm">{row.label}</span>
                  <span className={cn("text-sm tabular-nums", row.cls)}>
                    {row.value < 0 ? `(${formatCurrency(-row.value, "INR")})` : formatCurrency(row.value, "INR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!data && !isLoading && (
        <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-2xl">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Select month and year, then click Generate Report</p>
        </div>
      )}
    </div>
  );
}
