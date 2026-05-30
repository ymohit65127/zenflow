"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, FileText, ChevronDown, Filter } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

type BillStatus = "draft" | "pending" | "approved" | "partially_paid" | "paid" | "overdue" | "void";

const STATUS_COLORS: Record<BillStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-blue-500/10 text-blue-600",
  partially_paid: "bg-purple-500/10 text-purple-600",
  paid: "bg-green-500/10 text-green-600",
  overdue: "bg-red-500/10 text-red-600",
  void: "bg-muted text-muted-foreground",
};

export default function BillsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatus | "">("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const utils = api.useUtils();

  const { data, isLoading } = api.accounting.bills.list.useQuery({
    limit,
    offset: page * limit,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const approveMutation = api.accounting.bills.approve.useMutation({
    onSuccess: () => {
      toast.success("Bill approved");
      void utils.accounting.bills.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  // Summary stats
  const pendingAmount =
    data?.items
      .filter((b) => b.status === "pending" || b.status === "approved")
      .reduce((s, b) => s + Number(b.balance_due), 0) ?? 0;
  const overdueAmount =
    data?.items
      .filter((b) => b.status === "overdue")
      .reduce((s, b) => s + Number(b.balance_due), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendor Bills</h1>
          <p className="text-muted-foreground mt-1">Accounts payable — bills from your vendors</p>
        </div>
        <Link
          href="/accounting/bills/new"
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Bill
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bills", value: data?.total ?? 0, isCurrency: false, color: "text-foreground" },
          { label: "Pending / Approved", value: data?.items.filter((b) => ["pending", "approved"].includes(b.status)).length ?? 0, isCurrency: false, color: "text-amber-600" },
          { label: "Payable Amount", value: pendingAmount, isCurrency: true, color: "text-brand-500" },
          { label: "Overdue", value: overdueAmount, isCurrency: true, color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
            <p className={cn("text-xl font-bold", s.color)}>
              {s.isCurrency ? formatCurrency(s.value as number, "INR") : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search bills..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as BillStatus | ""); setPage(0); }}
            className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            {(["draft", "pending", "approved", "partially_paid", "paid", "overdue", "void"] as BillStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toUpperCase()}
                </option>
              )
            )}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading bills…
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No bills found</p>
            <p className="text-sm mt-1">Create your first vendor bill</p>
            <Link
              href="/accounting/bills/new"
              className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Bill
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Bill #", "Vendor", "Bill Date", "Due Date", "Total", "Balance Due", "Status", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className={cn(
                            "text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                            (h === "Total" || h === "Balance Due") && "text-right"
                          )}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map((bill) => (
                    <tr key={bill.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-4 font-mono text-sm font-medium text-brand-500">
                        {bill.bill_number}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{bill.vendor?.name ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(bill.bill_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {bill.due_date ? formatDate(bill.due_date) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-sm tabular-nums">
                        {formatCurrency(Number(bill.grand_total), "INR")}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-sm tabular-nums">
                        {Number(bill.balance_due) > 0 ? (
                          <span className="text-red-500">{formatCurrency(Number(bill.balance_due), "INR")}</span>
                        ) : (
                          <span className="text-green-500">{formatCurrency(0, "INR")}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                            STATUS_COLORS[bill.status as BillStatus] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {bill.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {bill.status === "pending" && (
                            <button
                              onClick={() => approveMutation.mutate({ id: bill.id })}
                              disabled={approveMutation.isPending}
                              className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                            >
                              Approve
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
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, data?.total ?? 0)} of{" "}
                  {data?.total}
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
  );
}
