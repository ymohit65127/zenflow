"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  FileText,
  Send,
  Eye,
  Trash2,
  ChevronDown,
  Filter,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/10 text-blue-600",
  VIEWED: "bg-purple-500/10 text-purple-600",
  PARTIAL: "bg-amber-500/10 text-amber-600",
  PAID: "bg-green-500/10 text-green-600",
  OVERDUE: "bg-red-500/10 text-red-600",
  CANCELLED: "bg-muted text-muted-foreground",
};

const ALL_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const utils = api.useUtils();

  const { data, isLoading } = api.accounting.invoices.list.useQuery({
    limit,
    offset: page * limit,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const sendMutation = api.accounting.invoices.send.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as sent");
      void utils.accounting.invoices.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.accounting.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      void utils.accounting.invoices.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage your invoices and payments
          </p>
        </div>
        <Link
          href="/accounting/invoices/new"
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search invoices..."
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
              setStatusFilter(e.target.value as InvoiceStatus | "");
              setPage(0);
            }}
            className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
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
            Loading invoices…
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No invoices found</p>
            <p className="text-sm mt-1">
              {search || statusFilter
                ? "Try changing your filters"
                : "Create your first invoice to get started"}
            </p>
            {!search && !statusFilter && (
              <Link
                href="/accounting/invoices/new"
                className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Invoice
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "Invoice #",
                      "Type",
                      "Issue Date",
                      "Due Date",
                      "Amount",
                      "Paid",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/accounting/invoices/${inv.id}`}
                          className="font-medium text-brand-500 hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {inv.type.replace("_", " ")}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(inv.issue_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {inv.due_date
                          ? new Date(inv.due_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-4 font-medium whitespace-nowrap">
                        {formatCurrency(Number(inv.total), inv.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {Number(inv.paid_amount) > 0
                          ? formatCurrency(Number(inv.paid_amount), inv.currency)
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                            STATUS_COLORS[inv.status as InvoiceStatus] ??
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/accounting/invoices/${inv.id}`}
                            title="View invoice"
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {inv.status === "DRAFT" && (
                            <button
                              onClick={() => sendMutation.mutate({ id: inv.id })}
                              title="Mark as sent"
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors text-muted-foreground hover:text-blue-600"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete invoice ${inv.invoice_number}?`
                                  )
                                ) {
                                  deleteMutation.mutate({ id: inv.id });
                                }
                              }}
                              title="Delete invoice"
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, data?.total ?? 0)} of{" "}
                  {data?.total} invoices
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
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
