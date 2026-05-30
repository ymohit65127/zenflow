"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  BookOpen,
  ChevronDown,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

type JournalStatus = "draft" | "posted" | "reversed" | "void";

const STATUS_CONFIG: Record<JournalStatus, { label: string; cls: string; icon: React.ElementType }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground", icon: Clock },
  posted: { label: "Posted", cls: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  reversed: { label: "Reversed", cls: "bg-purple-500/10 text-purple-600", icon: RotateCcw },
  void: { label: "Void", cls: "bg-red-500/10 text-red-600", icon: XCircle },
};

export default function JournalEntriesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JournalStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const limit = 25;

  const utils = api.useUtils();

  const { data, isLoading } = api.accounting.journal.list.useQuery({
    limit,
    offset: page * limit,
    status: statusFilter || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    search: search || undefined,
  });

  const postMutation = api.accounting.journal.post.useMutation({
    onSuccess: () => {
      toast.success("Journal entry posted");
      void utils.accounting.journal.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const voidMutation = api.accounting.journal.void.useMutation({
    onSuccess: () => {
      toast.success("Journal entry voided");
      void utils.accounting.journal.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground mt-1">Double-entry bookkeeping records</p>
        </div>
        <Link
          href="/accounting/journal/new"
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(STATUS_CONFIG) as [JournalStatus, (typeof STATUS_CONFIG)[JournalStatus]][]).map(
          ([status, cfg]) => {
            const Icon = cfg.icon;
            const count = data?.items.filter((i) => i.status === status).length ?? 0;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
                className={cn(
                  "bg-card border rounded-xl p-4 text-left transition-all",
                  statusFilter === status
                    ? "border-brand-500 ring-2 ring-brand-500/20"
                    : "border-border hover:border-brand-500/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </button>
            );
          }
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search entries..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as JournalStatus | ""); setPage(0); }}
            className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([s, c]) => (
              <option key={s} value={s}>{c.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading entries…
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No journal entries found</p>
            <p className="text-sm mt-1">Create your first manual entry</p>
            <Link
              href="/accounting/journal/new"
              className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Entry
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Entry #", "Date", "Description", "Debit", "Credit", "Status", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className={cn(
                            "text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                            (h === "Debit" || h === "Credit") && "text-right"
                          )}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map((entry) => {
                    const cfg = STATUS_CONFIG[entry.status as JournalStatus];
                    const Icon = cfg?.icon ?? Clock;
                    const totalDebit = entry.lines.reduce(
                      (s, l) => s + Number(l.debit_amount),
                      0
                    );
                    const totalCredit = entry.lines.reduce(
                      (s, l) => s + Number(l.credit_amount),
                      0
                    );
                    return (
                      <tr key={entry.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4 font-mono text-sm font-medium text-brand-500">
                          {entry.entry_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(entry.entry_date)}
                        </td>
                        <td className="px-6 py-4 text-sm max-w-xs truncate">{entry.description}</td>
                        <td className="px-6 py-4 text-right font-medium text-sm tabular-nums">
                          {formatCurrency(totalDebit, "INR")}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-sm tabular-nums">
                          {formatCurrency(totalCredit, "INR")}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                              cfg?.cls ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {cfg?.label ?? entry.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {entry.status === "draft" && (
                              <>
                                <button
                                  onClick={() => postMutation.mutate({ id: entry.id })}
                                  disabled={postMutation.isPending}
                                  className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                                >
                                  Post
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm("Void this entry?")) {
                                      voidMutation.mutate({ id: entry.id });
                                    }
                                  }}
                                  className="px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                                >
                                  Void
                                </button>
                              </>
                            )}
                          </div>
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
