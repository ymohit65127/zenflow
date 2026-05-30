"use client";

import { useState } from "react";
import { BarChart3, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]!);
  const { data, isLoading, refetch } = api.accounting.reports.balanceSheet.useQuery(
    { as_of_date: asOfDate },
    { enabled: false }
  );

  const handleRun = () => void refetch();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground mt-1">Assets = Liabilities + Equity</p>
        </div>
        {data && (
          <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">As Of Date</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <button onClick={handleRun} disabled={isLoading}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {isLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running…</> : "Run Report"}
        </button>
      </div>

      {data && (
        <>
          {/* Balance check */}
          <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
            data.balanced ? "bg-green-500/5 border-green-500/20 text-green-600" : "bg-red-500/5 border-red-500/20 text-red-600")}>
            {data.balanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {data.balanced
              ? `Balance sheet is balanced: Assets (${formatCurrency(data.totalAssets, "INR")}) = Liabilities + Equity (${formatCurrency(data.totalLiabilities + data.totalEquity, "INR")})`
              : "Balance sheet is NOT balanced — please check for missing journal entries"}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-blue-500/5">
                <h2 className="font-semibold text-blue-600 flex items-center gap-2">
                  Assets
                  <span className="ml-auto font-bold">{formatCurrency(data.totalAssets, "INR")}</span>
                </h2>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-border">
                  {data.assets.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="px-6 py-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{a.code}</span>
                        {a.name}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-sm tabular-nums">
                        {formatCurrency(Number(a.current_balance), "INR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-blue-500/5">
                    <td className="px-6 py-3 font-bold text-sm">Total Assets</td>
                    <td className="px-6 py-3 text-right font-bold text-sm tabular-nums text-blue-600">
                      {formatCurrency(data.totalAssets, "INR")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Liabilities + Equity */}
            <div className="space-y-4">
              {/* Liabilities */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-red-500/5">
                  <h2 className="font-semibold text-red-600 flex items-center gap-2">
                    Liabilities
                    <span className="ml-auto font-bold">{formatCurrency(data.totalLiabilities, "INR")}</span>
                  </h2>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-border">
                    {data.liabilities.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="px-6 py-3 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{a.code}</span>
                          {a.name}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-sm tabular-nums">
                          {formatCurrency(Number(a.current_balance), "INR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-red-500/5">
                      <td className="px-6 py-3 font-bold text-sm">Total Liabilities</td>
                      <td className="px-6 py-3 text-right font-bold text-sm tabular-nums text-red-600">
                        {formatCurrency(data.totalLiabilities, "INR")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Equity */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-purple-500/5">
                  <h2 className="font-semibold text-purple-600 flex items-center gap-2">
                    Equity
                    <span className="ml-auto font-bold">{formatCurrency(data.totalEquity, "INR")}</span>
                  </h2>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-border">
                    {data.equity.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="px-6 py-3 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{a.code}</span>
                          {a.name}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-sm tabular-nums">
                          {formatCurrency(Number(a.current_balance), "INR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-purple-500/5">
                      <td className="px-6 py-3 font-bold text-sm">Total Equity</td>
                      <td className="px-6 py-3 text-right font-bold text-sm tabular-nums text-purple-600">
                        {formatCurrency(data.totalEquity, "INR")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {!data && !isLoading && (
        <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-2xl">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Select a date and click Run Report</p>
        </div>
      )}
    </div>
  );
}
