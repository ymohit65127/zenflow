// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { Plus, Search, Receipt, X, Filter, ChevronDown, CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "reimbursed";

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-amber-500/10 text-amber-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  reimbursed: "bg-blue-500/10 text-blue-600",
};

function AddExpenseDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: accounts } = api.accounting.coa.list.useQuery({});
  const { data: vendors } = api.accounting.vendors.list.useQuery({ limit: 100, offset: 0 });

  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [vendorId, setVendorId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("personal");
  const [notes, setNotes] = useState("");

  const expenseAccounts = accounts?.filter((a) => a.account_type === "expense");

  const mutation = api.accounting.accExpenses.create.useMutation({
    onSuccess: () => {
      toast.success("Expense added");
      void utils.accounting.accExpenses.list.invalidate();
      void utils.accounting.accExpenses.stats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">New Expense Claim</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Expense Account</label>
            <select
              value={expenseAccountId}
              onChange={(e) => setExpenseAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">Select account…</option>
              {expenseAccounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {["company_card", "personal", "petty_cash", "other"].map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, " ").toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              type="text"
              placeholder="What was this expense for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Amount</label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {["INR", "USD", "EUR", "GBP"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vendor (optional)</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">None</option>
              {vendors?.items.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={() =>
              mutation.mutate({
                expense_account_id: expenseAccountId,
                expense_date: expenseDate,
                description: description || undefined,
                amount: parseFloat(amount) || 0,
                currency,
                vendor_id: vendorId || undefined,
                payment_method: paymentMethod as "personal",
                notes: notes || undefined,
              })
            }
            disabled={mutation.isPending || !expenseAccountId || !amount || parseFloat(amount) <= 0}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {mutation.isPending ? "Adding…" : "Add Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountingExpensesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const limit = 20;

  const utils = api.useUtils();

  const { data, isLoading } = api.accounting.accExpenses.list.useQuery({
    limit,
    offset: page * limit,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const { data: stats } = api.accounting.accExpenses.stats.useQuery();

  const approveMutation = api.accounting.accExpenses.approve.useMutation({
    onSuccess: () => {
      toast.success("Expense approved");
      void utils.accounting.accExpenses.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = api.accounting.accExpenses.reject.useMutation({
    onSuccess: () => {
      toast.success("Expense rejected");
      void utils.accounting.accExpenses.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reimburseMutation = api.accounting.accExpenses.reimburse.useMutation({
    onSuccess: () => {
      toast.success("Marked as reimbursed");
      void utils.accounting.accExpenses.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showAdd && <AddExpenseDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Expense Claims</h1>
            <p className="text-muted-foreground mt-1">Track and approve employee expenses</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Expense
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total This Month", value: formatCurrency(stats?.totalThisMonth ?? 0, "INR"), icon: Receipt, cls: "text-brand-500" },
            { label: "Pending Approval", value: String(stats?.pending ?? 0), icon: Clock, cls: "text-amber-500" },
            { label: "Approved", value: String(stats?.approved ?? 0), icon: CheckCircle2, cls: "text-green-500" },
            { label: "Reimbursed", value: String(stats?.reimbursed ?? 0), icon: XCircle, cls: "text-blue-500" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={cn("w-4 h-4", s.cls)} />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ExpenseStatus | ""); setPage(0); }}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              {(["draft", "submitted", "approved", "rejected", "reimbursed"] as ExpenseStatus[]).map((s) => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading expenses…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No expenses found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["#", "Date", "Description", "Amount", "Status", "Actions"].map((h) => (
                        <th
                          key={h}
                          className={cn(
                            "text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                            h === "Amount" && "text-right"
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((exp) => (
                      <tr key={exp.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          {exp.expense_number ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(exp.expense_date)}
                        </td>
                        <td className="px-6 py-4 text-sm max-w-xs truncate">{exp.description ?? "—"}</td>
                        <td className="px-6 py-4 text-right font-medium text-sm tabular-nums">
                          {formatCurrency(Number(exp.amount), exp.currency ?? "INR")}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                              STATUS_COLORS[exp.approval_status as ExpenseStatus] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {exp.approval_status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {exp.approval_status === "submitted" && (
                              <>
                                <button
                                  onClick={() => approveMutation.mutate({ id: exp.id })}
                                  className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => rejectMutation.mutate({ id: exp.id, reason: "Rejected" })}
                                  className="px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {exp.approval_status === "approved" && (
                              <button
                                onClick={() => reimburseMutation.mutate({ id: exp.id })}
                                className="px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                              >
                                Reimburse
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">
                    Showing {page * limit + 1}–{Math.min((page + 1) * limit, data?.total ?? 0)} of {data?.total}
                  </p>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted">Previous</button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted">Next</button>
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
