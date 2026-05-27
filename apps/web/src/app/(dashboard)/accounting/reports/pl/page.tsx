"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";

export default function PLReportPage() {
  const now = new Date();
  const [fromDate, setFromDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]!
  );
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]!);

  const { data, isLoading, refetch } = api.accounting.reports.profitAndLoss.useQuery(
    { from_date: fromDate, to_date: toDate },
    { enabled: false }
  );

  const handleRun = () => void refetch();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profit & Loss Statement</h1>
          <p className="text-muted-foreground mt-1">Revenue, expenses, and net profit for a period</p>
        </div>
        {data && (
          <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running…
            </>
          ) : "Run Report"}
        </button>
      </div>

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-green-500">
                {formatCurrency(data.totalRevenue, "INR")}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Total Expenses</span>
              </div>
              <p className="text-2xl font-bold text-red-500">
                {formatCurrency(data.totalExpenses, "INR")}
              </p>
            </div>
            <div
              className={cn(
                "rounded-xl p-5 border",
                data.netProfit >= 0
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-red-500/5 border-red-500/20"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Minus className={cn("w-4 h-4", data.netProfit >= 0 ? "text-green-500" : "text-red-500")} />
                <span className="text-sm text-muted-foreground">Net Profit</span>
              </div>
              <p className={cn("text-2xl font-bold", data.netProfit >= 0 ? "text-green-500" : "text-red-500")}>
                {formatCurrency(data.netProfit, "INR")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Gross margin: {data.grossMarginPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Detailed breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-green-500/5">
                <h2 className="font-semibold text-green-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Revenue
                  <span className="ml-auto font-bold">{formatCurrency(data.totalRevenue, "INR")}</span>
                </h2>
              </div>
              {data.revenue.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">No revenue accounts with activity</p>
              ) : (
                <table className="w-full">
                  <tbody className="divide-y divide-border">
                    {data.revenue.map((r) => (
                      <tr key={r.account_id} className="hover:bg-muted/20">
                        <td className="px-6 py-3 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{r.code}</span>
                          {r.name}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-sm tabular-nums text-green-600">
                          {formatCurrency(Number(r.total), "INR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-green-500/5">
                      <td className="px-6 py-3 font-semibold text-sm">Total Revenue</td>
                      <td className="px-6 py-3 text-right font-bold text-sm tabular-nums text-green-600">
                        {formatCurrency(data.totalRevenue, "INR")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Expenses */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-red-500/5">
                <h2 className="font-semibold text-red-600 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Expenses
                  <span className="ml-auto font-bold">{formatCurrency(data.totalExpenses, "INR")}</span>
                </h2>
              </div>
              {data.expenses.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">No expense accounts with activity</p>
              ) : (
                <table className="w-full">
                  <tbody className="divide-y divide-border">
                    {data.expenses.map((e) => (
                      <tr key={e.account_id} className="hover:bg-muted/20">
                        <td className="px-6 py-3 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{e.code}</span>
                          {e.name}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-sm tabular-nums text-red-600">
                          {formatCurrency(Number(e.total), "INR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-red-500/5">
                      <td className="px-6 py-3 font-semibold text-sm">Total Expenses</td>
                      <td className="px-6 py-3 text-right font-bold text-sm tabular-nums text-red-600">
                        {formatCurrency(data.totalExpenses, "INR")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          {/* Net profit summary */}
          <div className={cn(
            "p-5 rounded-2xl border flex items-center justify-between",
            data.netProfit >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
          )}>
            <div>
              <p className="font-semibold">Net {data.netProfit >= 0 ? "Profit" : "Loss"}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Period: {data.from_date} to {data.to_date}
              </p>
            </div>
            <p className={cn("text-3xl font-bold", data.netProfit >= 0 ? "text-green-500" : "text-red-500")}>
              {formatCurrency(Math.abs(data.netProfit), "INR")}
            </p>
          </div>
        </>
      )}

      {!data && !isLoading && (
        <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-2xl">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Select a date range and click Run Report</p>
        </div>
      )}
    </div>
  );
}
