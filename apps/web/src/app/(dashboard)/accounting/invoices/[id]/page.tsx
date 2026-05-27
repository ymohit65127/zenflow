"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  CreditCard,
  Printer,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
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

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "UPI",
  "CHEQUE",
  "PAYPAL",
  "STRIPE",
  "RAZORPAY",
  "OTHER",
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function PaymentDialog({
  invoiceId,
  maxAmount,
  currency,
  onClose,
}: {
  invoiceId: string;
  maxAmount: number;
  currency: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(maxAmount.toFixed(2)));
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().split("T")[0]!);

  const utils = api.useUtils();
  const mutation = api.accounting.invoices.addPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      void utils.accounting.invoices.get.invalidate({ id: invoiceId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Record Payment</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Amount ({currency})</label>
            <input
              type="number"
              min={0.01}
              step="any"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Payment Date</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Reference <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Transaction ID, cheque number..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
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
                invoice_id: invoiceId,
                amount: parseFloat(amount) || 0,
                currency,
                method,
                reference: reference || undefined,
                notes: notes || undefined,
                paid_at: paidAt || undefined,
              })
            }
            disabled={mutation.isPending || !amount || parseFloat(amount) <= 0}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {mutation.isPending ? "Recording…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const utils = api.useUtils();
  const { data: invoice, isLoading } = api.accounting.invoices.get.useQuery({
    id: params.id,
  });

  const sendMutation = api.accounting.invoices.send.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as sent");
      void utils.accounting.invoices.get.invalidate({ id: params.id });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Invoice not found</p>
        <Link href="/accounting/invoices" className="text-brand-500 hover:underline text-sm mt-2 inline-block">
          Back to invoices
        </Link>
      </div>
    );
  }

  const total = Number(invoice.total);
  const paidAmount = Number(invoice.paid_amount);
  const outstanding = total - paidAmount;

  return (
    <>
      {showPaymentDialog && (
        <PaymentDialog
          invoiceId={invoice.id}
          maxAmount={outstanding}
          currency={invoice.currency}
          onClose={() => setShowPaymentDialog(false)}
        />
      )}

      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/accounting/invoices"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                    STATUS_COLORS[invoice.status as InvoiceStatus] ??
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {invoice.status}
                </span>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">
                {invoice.type.replace("_", " ")} • {invoice.currency}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            {invoice.status === "DRAFT" && (
              <button
                onClick={() => sendMutation.mutate({ id: invoice.id })}
                disabled={sendMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                Mark Sent
              </button>
            )}
            {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && outstanding > 0 && (
              <button
                onClick={() => setShowPaymentDialog(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </button>
            )}
          </div>
        </div>

        {/* Invoice body (printable) */}
        <div className="bg-card border border-border rounded-2xl p-8 print:shadow-none print:border-none space-y-8">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Issue Date</p>
              <p className="font-medium">
                {new Date(invoice.issue_date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            {invoice.due_date && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Due Date</p>
                <p className="font-medium">
                  {new Date(invoice.due_date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Description", "Qty", "Unit Price", "Tax %", "Disc %", "Total"].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                        h === "Description" ? "text-left" : "text-right"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.line_items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 text-sm">{item.description}</td>
                    <td className="py-3 text-sm text-right">{Number(item.quantity)}</td>
                    <td className="py-3 text-sm text-right">
                      {formatCurrency(Number(item.unit_price), invoice.currency)}
                    </td>
                    <td className="py-3 text-sm text-right">{Number(item.tax_rate)}%</td>
                    <td className="py-3 text-sm text-right">{Number(item.discount)}%</td>
                    <td className="py-3 text-sm text-right font-medium">
                      {formatCurrency(Number(item.total), invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
              </div>
              {Number(invoice.discount_total) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600">
                    -{formatCurrency(Number(invoice.discount_total), invoice.currency)}
                  </span>
                </div>
              )}
              {Number(invoice.tax_total) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(Number(invoice.tax_total), invoice.currency)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-brand-500 text-lg">
                  {formatCurrency(total, invoice.currency)}
                </span>
              </div>
              {paidAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="text-green-600">
                      -{formatCurrency(paidAmount, invoice.currency)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-semibold">
                    <span>Balance Due</span>
                    <span className={outstanding > 0 ? "text-red-500" : "text-green-600"}>
                      {formatCurrency(outstanding, invoice.currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {(invoice.notes || invoice.terms) && (
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-6">
              {invoice.notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Notes
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Terms & Conditions
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {invoice.terms}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment history */}
        {invoice.payments.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Payment History</h2>
            </div>
            <div className="divide-y divide-border">
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {payment.method.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.paid_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {payment.reference && ` • Ref: ${payment.reference}`}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">
                    +{formatCurrency(Number(payment.amount), payment.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
