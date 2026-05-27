// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Plus,
  DollarSign,
  Eye,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatCurrency(val: number | null | undefined) {
  if (!val) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  sent: { label: "Sent", classes: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepted", classes: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", classes: "bg-red-100 text-red-700" },
  expired: { label: "Expired", classes: "bg-orange-100 text-orange-700" },
};

function CreateQuoteDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ dealId: "", title: "" });

  const { data: dealsData } = api.crm.dealsV2.list.useQuery({
    limit: 50,
    filters: {},
    sort: { field: "created_at", dir: "desc" },
  });

  const createMutation = api.crm.quotes.create.useMutation({
    onSuccess: () => {
      toast.success("Quote created");
      setOpen(false);
      setForm({ dealId: "", title: "" });
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Deal *</Label>
            <Select value={form.dealId} onValueChange={(v) => setForm({ ...form, dealId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a deal" />
              </SelectTrigger>
              <SelectContent>
                {dealsData?.deals?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quote Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Software License Agreement"
            />
          </div>
          <Button
            className="w-full bg-brand-500 hover:bg-brand-600 text-white"
            disabled={!form.dealId || !form.title || createMutation.isPending}
            onClick={() => createMutation.mutate({ dealId: form.dealId, title: form.title })}
          >
            {createMutation.isPending ? "Creating..." : "Create Quote"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function QuotesPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch } = api.crm.quotes.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as "draft" | "sent" | "accepted" | "rejected" | "expired" : undefined,
    limit: 50,
  });

  const sendMutation = api.crm.quotes.send.useMutation({
    onSuccess: () => { toast.success("Quote sent"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const acceptMutation = api.crm.quotes.markAccepted.useMutation({
    onSuccess: () => { toast.success("Quote accepted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = api.crm.quotes.markRejected.useMutation({
    onSuccess: () => { toast.success("Quote rejected"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const quotes = data?.quotes ?? [];
  const totalValue = quotes.reduce((sum, q) => sum + Number(q.grand_total ?? 0), 0);
  const acceptedValue = quotes
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + Number(q.grand_total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-500" />
            Quotes
          </h1>
          <p className="text-muted-foreground mt-1">{quotes.length} quotes · {formatCurrency(totalValue)} total</p>
        </div>
        <CreateQuoteDialog onCreated={() => refetch()} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = quotes.filter((q) => q.status === status).length;
          return (
            <Card key={status} className="cursor-pointer hover:border-brand-500/40 transition-colors" onClick={() => setStatusFilter(status)}>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([s, c]) => (
              <SelectItem key={s} value={s}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading quotes...</div>
        ) : quotes.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No quotes found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {quotes.map((quote) => {
              const statusConfig = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.draft;
              return (
                <div key={quote.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/crm/quotes/${quote.id}`}
                        className="font-medium hover:text-brand-500 truncate"
                      >
                        {quote.title}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.classes}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{quote.number}</span>
                      {quote.deal && (
                        <span className="text-xs text-muted-foreground">· {quote.deal.name}</span>
                      )}
                      {quote._count && (
                        <span className="text-xs text-muted-foreground">· {quote._count.lines} lines</span>
                      )}
                    </div>
                  </div>

                  {quote.open_count > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {quote.open_count}
                    </span>
                  )}

                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(quote.grand_total))}</p>
                    {quote.valid_until && (
                      <p className="text-xs text-muted-foreground">
                        Valid until {new Date(quote.valid_until).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/crm/quotes/${quote.id}`}>View / Edit</Link>
                      </DropdownMenuItem>
                      {quote.status === "draft" && (
                        <DropdownMenuItem
                          onClick={() => {
                            const email = prompt("Send to email:");
                            if (email) sendMutation.mutate({ quoteId: quote.id, toEmail: email });
                          }}
                        >
                          <Send className="w-3.5 h-3.5 mr-2" /> Send
                        </DropdownMenuItem>
                      )}
                      {quote.status === "sent" && (
                        <>
                          <DropdownMenuItem onClick={() => acceptMutation.mutate({ quoteId: quote.id })}>
                            Mark Accepted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => rejectMutation.mutate({ quoteId: quote.id })}>
                            Mark Rejected
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
