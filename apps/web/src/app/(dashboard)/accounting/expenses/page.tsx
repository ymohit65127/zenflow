"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Receipt,
  X,
  Filter,
  ChevronDown,
  TrendingDown,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED" | "REIMBURSED";

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-600",
  APPROVED: "bg-green-500/10 text-green-600",
  REJECTED: "bg-red-500/10 text-red-600",
  REIMBURSED: "bg-blue-500/10 text-blue-600",
};

const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals & Entertainment",
  "Office Supplies",
  "Software & Subscriptions",
  "Marketing",
  "Utilities",
  "Rent",
  "Salaries",
  "Professional Services",
  "Equipment",
  "Training",
  "Other",
];

function AddExpenseDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]!);
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [expenseDate, setExpenseDate] = useState(
    () => new Date().toISOString().split("T")[0]!
  );
  const [notes, setNotes] = useState("");

  const mutation = api.accounting.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Expense added");
      void utils.accounting.expenses.list.invalidate();
      void utils.accounting.expenses.stats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const effectiveCategory = category === "Other" && customCategory ? customCategory : category;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Add Expense</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {category === "Other" && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Custom Category</label>
                <input
                  type="text"
                  placeholder="Enter category name"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            )}
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
                min={0.01}
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
                {["USD", "EUR", "GBP", "INR", "CAD", "AUD"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
            <label className="block text-sm font-medium mb-1.5">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              mutation.mutate({
                category: effectiveCategory,
                description,
                amount: parseFloat(amount) || 0,
                currency,
                expense_date: expenseDate,
                notes: notes || undefined,
              })
            }
            disabled={
              mutation.isPending ||
              !description.trim() ||
              !amount ||
              parseFloat(amount) <= 0
            }
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {mutation.isPending ? "Adding…" : "Add Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const limit = 20;

  const utils = api.useUtils();

  const { data, isLoading } = api.accounting.expenses.list.useQuery({
    limit,
    offset: page * limit,
    search: search || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
  });

  const { data: stats } = api.accounting.expenses.stats.useQuery();

  const updateMutation = api.accounting.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("Expense updated");
      void utils.accounting.expenses.list.invalidate();
      void utils.accounting.expenses.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.accounting.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Expense deleted");
      void utils.accounting.expenses.list.invalidate();
      void utils.accounting.expenses.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showAdd && <AddExpenseDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Expenses</h1>
            <p className="text-muted-foreground mt-1">Track and manage business expenses</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-violet-500" />
              <span className="text-sm text-muted-foreground">Total This Month</span>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(stats?.totalThisMonth ?? 0)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Pending Approval</span>
            </div>
            <p className="text-2xl font-bold">{stats?.pending ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold">{stats?.approved ?? 0}</p>
          </div>
        </div>

        {/* Category breakdown */}
        {(stats?.categoryBreakdown?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats?.categoryBreakdown.map((cat) => (
              <button
                key={cat.category}
                onClick={() =>
                  setCategoryFilter(
                    categoryFilter === cat.category ? "" : cat.category
                  )
                }
                className={cn(
                  "bg-card border rounded-xl p-4 text-left transition-all",
                  categoryFilter === cat.category
                    ? "border-brand-500 ring-2 ring-brand-500/20"
                    : "border-border hover:border-brand-500/50"
                )}
              >
                <p className="text-sm font-medium truncate">{cat.category}</p>
                <p className="text-lg font-bold mt-1 text-brand-500">
                  {formatCurrency(cat.amount)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ExpenseStatus | "");
                setPage(0);
              }}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="REIMBURSED">Reimbursed</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter("")}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-brand-500/10 text-brand-500 rounded-lg hover:bg-brand-500/20 transition-colors"
            >
              {categoryFilter}
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
              <p className="text-sm mt-1">
                {search || statusFilter || categoryFilter
                  ? "Try changing your filters"
                  : "Add your first expense to track spending"}
              </p>
              {!search && !statusFilter && !categoryFilter && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Expense
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Date", "Category", "Description", "Amount", "Status", "Actions"].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((exp) => (
                      <tr key={exp.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(exp.expense_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm max-w-xs truncate">{exp.description}</td>
                        <td className="px-6 py-4 font-medium whitespace-nowrap">
                          {formatCurrency(Number(exp.amount), exp.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                              STATUS_COLORS[exp.status as ExpenseStatus] ??
                                "bg-muted text-muted-foreground"
                            )}
                          >
                            {exp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {exp.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() =>
                                    updateMutation.mutate({ id: exp.id, status: "APPROVED" })
                                  }
                                  title="Approve"
                                  className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    updateMutation.mutate({ id: exp.id, status: "REJECTED" })
                                  }
                                  title="Reject"
                                  className="px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {exp.status === "APPROVED" && (
                              <button
                                onClick={() =>
                                  updateMutation.mutate({ id: exp.id, status: "REIMBURSED" })
                                }
                                title="Mark reimbursed"
                                className="px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                              >
                                Reimburse
                              </button>
                            )}
                            {(exp.status === "PENDING" || exp.status === "REJECTED") && (
                              <button
                                onClick={() => {
                                  if (window.confirm("Delete this expense?")) {
                                    deleteMutation.mutate({ id: exp.id });
                                  }
                                }}
                                className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <X className="w-4 h-4" />
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
                    Showing {page * limit + 1}–
                    {Math.min((page + 1) * limit, data?.total ?? 0)} of {data?.total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted"
                    >
                      Next
                    </button>
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
