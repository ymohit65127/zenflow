"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft, Save, Calculator } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
}

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD"];

const emptyLine = (): LineItem => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  discount: 0,
});

function calcLine(item: LineItem) {
  const lineSubtotal = item.quantity * item.unit_price;
  const discountAmt = lineSubtotal * (item.discount / 100);
  const afterDiscount = lineSubtotal - discountAmt;
  const taxAmt = afterDiscount * (item.tax_rate / 100);
  return afterDiscount + taxAmt;
}

function calcTotals(items: LineItem[]) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  for (const item of items) {
    const s = item.quantity * item.unit_price;
    const d = s * (item.discount / 100);
    const t = (s - d) * (item.tax_rate / 100);
    subtotal += s;
    discount += d;
    tax += t;
  }
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [type, setType] = useState<"INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE" | "PROFORMA">(
    "INVOICE"
  );
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().split("T")[0]!
  );
  const [dueDate, setDueDate] = useState(
    () => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split("T")[0]!;
    }
  );
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);

  const createMutation = api.accounting.invoices.create.useMutation({
    onSuccess: (inv) => {
      toast.success(`Invoice ${inv.invoice_number} created`);
      router.push(`/accounting/invoices/${inv.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = calcTotals(lineItems);

  const updateLine = (idx: number, field: keyof LineItem, val: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const addLine = () => setLineItems((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (lineItems.some((l) => !l.description.trim())) {
      toast.error("All line items must have a description");
      return;
    }
    createMutation.mutate({
      type,
      issue_date: issueDate,
      due_date: dueDate || undefined,
      currency,
      notes: notes || undefined,
      terms: terms || undefined,
      line_items: lineItems.map((item, idx) => ({
        ...item,
        sort_order: idx,
      })),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
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
            <h1 className="text-2xl font-bold">New Invoice</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Create a new invoice for your client
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          {createMutation.isPending ? "Saving…" : "Save Invoice"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice details */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h2 className="font-semibold text-base">Invoice Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as typeof type)
                  }
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  <option value="INVOICE">Invoice</option>
                  <option value="CREDIT_NOTE">Credit Note</option>
                  <option value="DEBIT_NOTE">Debit Note</option>
                  <option value="PROFORMA">Proforma</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Line Items</h2>
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 border-b border-border">
              <div className="col-span-4">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-1 text-right">Tax%</div>
              <div className="col-span-1 text-right">Disc%</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            {lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <input
                    type="text"
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLine(idx, "quantity", parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.tax_rate}
                    onChange={(e) =>
                      updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.discount}
                    onChange={(e) =>
                      updateLine(idx, "discount", parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                  />
                </div>
                <div className="col-span-1 text-right text-sm font-medium">
                  {formatCurrency(calcLine(item), currency)}
                </div>
                <div className="col-span-1 flex justify-end">
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLine(idx)}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={addLine}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add another item
            </button>
          </div>

          {/* Notes & Terms */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-base">Notes & Terms</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes</label>
                <textarea
                  rows={4}
                  placeholder="Additional notes for the client..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Terms & Conditions</label>
                <textarea
                  rows={4}
                  placeholder="Payment terms, late fees, etc..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Totals sidebar */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-5">
              <Calculator className="w-5 h-5 text-brand-500" />
              <h2 className="font-semibold text-base">Summary</h2>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal, currency)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium text-green-600">
                    -{formatCurrency(totals.discount, currency)}
                  </span>
                </div>
              )}
              {totals.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(totals.tax, currency)}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg text-brand-500">
                  {formatCurrency(totals.total, currency)}
                </span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="w-full mt-6 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? "Saving…" : "Save Invoice"}
            </button>

            <Link
              href="/accounting/invoices"
              className="block text-center mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
