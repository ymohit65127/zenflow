// @ts-nocheck
"use client";
// @ts-nocheck

import { use, useState } from "react";
import { ArrowLeft, PlayCircle, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ProdStatus = "draft" | "confirmed" | "in_progress" | "completed" | "cancelled";

const STATUS_STEPS: Record<ProdStatus, number> = {
  draft: 0,
  confirmed: 1,
  in_progress: 2,
  completed: 3,
  cancelled: -1,
};

export default function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = api.useUtils();
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const { data: order, isLoading } = api.inventory.production.get.useQuery({ id });

  const confirmMutation = api.inventory.production.confirm.useMutation({
    onSuccess: () => { toast.success("Order confirmed — components reserved"); void utils.inventory.production.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const startMutation = api.inventory.production.start.useMutation({
    onSuccess: () => { toast.success("Production started"); void utils.inventory.production.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const completeMutation = api.inventory.production.complete.useMutation({
    onSuccess: () => { toast.success("Production completed!"); void utils.inventory.production.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = api.inventory.production.cancel.useMutation({
    onSuccess: () => { toast.success("Order cancelled"); void utils.inventory.production.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="p-10 text-center text-muted-foreground">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  if (!order) return <div className="p-10 text-center text-muted-foreground">Order not found</div>;

  const status = order.status as ProdStatus;
  const step = STATUS_STEPS[status];

  const scaleFactor = Number(order.quantity) / Number(order.bom.quantity);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory/production" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{order.order_number}</h1>
          <p className="text-muted-foreground mt-0.5">
            {order.product.name} · Qty: {Number(order.quantity)} · {order.warehouse.name}
          </p>
        </div>
        <span className={cn("px-3 py-1.5 rounded-full text-sm font-medium capitalize", {
          "bg-muted text-muted-foreground": status === "draft",
          "bg-blue-500/10 text-blue-600": status === "confirmed",
          "bg-amber-500/10 text-amber-600": status === "in_progress",
          "bg-green-500/10 text-green-600": status === "completed",
          "bg-red-500/10 text-red-600": status === "cancelled",
        })}>
          {status.replace("_", " ")}
        </span>
      </div>

      {/* Workflow Steps */}
      {status !== "cancelled" && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            {["Draft", "Confirm", "Start", "Complete"].map((label, i) => (
              <div key={label} className="flex flex-col items-center flex-1 relative">
                {i > 0 && (
                  <div className={cn("absolute left-0 top-4 h-0.5 w-full -translate-y-1/2 -z-10", step >= i ? "bg-brand-500" : "bg-border")} />
                )}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10",
                  step > i ? "bg-brand-500 text-white" : step === i ? "bg-brand-500/20 text-brand-500 border-2 border-brand-500" : "bg-muted text-muted-foreground"
                )}>
                  {step > i ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <p className={cn("text-xs mt-1.5 font-medium", step >= i ? "text-foreground" : "text-muted-foreground")}>{label}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-3 mt-6">
            {status === "draft" && (
              <button onClick={() => confirmMutation.mutate({ id })} disabled={confirmMutation.isPending}
                className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
                <ClipboardCheck className="w-4 h-4" />
                {confirmMutation.isPending ? "Confirming…" : "Confirm & Reserve Materials"}
              </button>
            )}
            {status === "confirmed" && (
              <button onClick={() => startMutation.mutate({ id })} disabled={startMutation.isPending}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
                <PlayCircle className="w-4 h-4" />
                {startMutation.isPending ? "Starting…" : "Start Production"}
              </button>
            )}
            {status === "in_progress" && (
              <button onClick={() => completeMutation.mutate({ id })} disabled={completeMutation.isPending}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {completeMutation.isPending ? "Completing…" : "Complete Production"}
              </button>
            )}
            {["draft", "confirmed", "in_progress"].includes(status) && (
              <button onClick={() => setConfirmCancelOpen(true)} disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-60 text-red-500 px-4 py-2.5 rounded-lg text-sm font-medium">
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* BOM Components needed */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Materials Required</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Based on BOM: {order.bom.name} v{order.bom.version}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Component", "Per Output", "Required Total", "Scrap %", "Unit"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.bom.lines.map((line) => {
                const scrapFactor = 1 + Number(line.scrap_percent) / 100;
                const totalRequired = Number(line.quantity) * scaleFactor * scrapFactor;
                return (
                  <tr key={line.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <p className="font-medium text-sm">{line.component_product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{line.component_product.sku}</p>
                    </td>
                    <td className="px-5 py-3 text-sm">{Number(line.quantity)}</td>
                    <td className="px-5 py-3 text-sm font-semibold">{totalRequired.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm">
                      {Number(line.scrap_percent) > 0 ? <span className="text-amber-600">{Number(line.scrap_percent)}%</span> : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {line.unit ?? String(line.component_product.unit_of_measure)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Timeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: "Created", value: format(new Date(order.created_at), "MMM dd, yyyy") },
            { label: "Scheduled Start", value: order.scheduled_start ? format(new Date(order.scheduled_start), "MMM dd, yyyy") : "—" },
            { label: "Actual Start", value: order.actual_start ? format(new Date(order.actual_start), "MMM dd, yyyy HH:mm") : "—" },
            { label: "Completed", value: order.actual_end ? format(new Date(order.actual_end), "MMM dd, yyyy HH:mm") : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="font-medium">{value}</p>
            </div>
          ))}
        </div>
        {order.notes && (
          <div className="mt-4 p-3 bg-muted/20 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}
      </div>
    <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmCancelOpen(false)}>Back</Button>
          <Button variant="destructive" onClick={() => { cancelMutation.mutate({ id }); setConfirmCancelOpen(false); }}>Cancel Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}
