// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { Plus, Target, TrendingUp, TrendingDown, X } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

function AddBudgetDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [financialYear, setFinancialYear] = useState(new Date().getFullYear());

  const mutation = api.accounting.budget.create.useMutation({
    onSuccess: () => {
      toast.success("Budget created");
      void utils.accounting.budget.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">New Budget</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Budget Name</label>
            <input type="text" placeholder="e.g. FY 2026-27 Annual Budget" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Financial Year</label>
            <input type="number" value={financialYear} onChange={(e) => setFinancialYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={() => mutation.mutate({ name, financial_year: financialYear })}
            disabled={mutation.isPending || !name.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {mutation.isPending ? "Creating…" : "Create Budget"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BudgetVarianceView({ budgetId }: { budgetId: string }) {
  const [month, setMonth] = useState<number | undefined>();
  const { data } = api.accounting.budget.variance.useQuery({ budget_id: budgetId, period_month: month });

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filter by month:</span>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setMonth(undefined)}
            className={cn("px-2 py-1 rounded text-xs font-medium transition-colors",
              month === undefined ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
          >
            Full Year
          </button>
          {MONTHS.map((m, i) => (
            <button
              key={m}
              onClick={() => setMonth(month === i + 1 ? undefined : i + 1)}
              className={cn("px-2 py-1 rounded text-xs font-medium transition-colors",
                month === i + 1 ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Account", "Budget", "Actual", "Variance", "Variance %"].map((h) => (
                  <th key={h} className={cn("text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider", h !== "Account" && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.lines.map((line, i) => {
                const isOver = line.variance > 0;
                return (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-sm">{line.account.code} — {line.account.name}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">{formatCurrency(line.budget_amount, "INR")}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">{formatCurrency(line.actual_amount, "INR")}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      <span className={cn("flex items-center justify-end gap-1", isOver ? "text-red-500" : "text-green-500")}>
                        {isOver ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatCurrency(Math.abs(line.variance), "INR")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {line.variance_pct !== null ? (
                        <span className={cn(line.variance_pct > 0 ? "text-red-500" : "text-green-500")}>
                          {Math.abs(line.variance_pct).toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BudgetPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  const { data: budgets, isLoading } = api.accounting.budget.list.useQuery({
    financial_year: currentYear,
  });

  const activateMutation = api.accounting.budget.update.useMutation({
    onSuccess: () => toast.success("Budget status updated"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      {showAdd && <AddBudgetDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Budgets</h1>
            <p className="text-muted-foreground mt-1">Budget vs actual variance analysis</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> New Budget
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />Loading…
          </div>
        ) : budgets?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-2xl">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No budgets for {currentYear}</p>
            <p className="text-sm mt-1">Create a budget to start tracking variances</p>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> New Budget
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {budgets?.map((budget) => (
              <div key={budget.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setSelectedBudgetId((prev) => (prev === budget.id ? null : budget.id))}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="font-semibold">{budget.name}</p>
                      <p className="text-sm text-muted-foreground">FY {budget.financial_year} · {budget._count.lines} accounts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full",
                      budget.status === "active" ? "bg-green-500/10 text-green-600" :
                        budget.status === "archived" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-600")}>
                      {budget.status.toUpperCase()}
                    </span>
                    {budget.status === "draft" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); activateMutation.mutate({ id: budget.id, status: "active" }); }}
                        className="px-2 py-1 text-xs font-medium bg-brand-500/10 text-brand-500 rounded-lg hover:bg-brand-500/20"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
                {selectedBudgetId === budget.id && (
                  <div className="border-t border-border p-6">
                    <BudgetVarianceView budgetId={budget.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
