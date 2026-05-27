"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

interface BillLine {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  account_id: string;
  tax_rate: string;
}

function newLine(): BillLine {
  return {
    id: Math.random().toString(36).slice(2),
    description: "",
    quantity: "1",
    unit_price: "",
    account_id: "",
    tax_rate: "0",
  };
}

export default function NewBillPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("net_30");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([newLine()]);

  const { data: vendors } = api.accounting.vendors.list.useQuery({ limit: 200, offset: 0 });
  const { data: accounts } = api.accounting.coa.list.useQuery({});

  const expenseAccounts = accounts?.filter(
    (a) => a.account_type === "expense" || a.account_type === "asset"
  );

  const createMutation = api.accounting.bills.create.useMutation({
    onSuccess: () => {
      toast.success("Bill created");
      router.push("/accounting/bills");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLine = (id: string, field: keyof BillLine, value: string) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const lineTotal = (line: BillLine) => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const tax = parseFloat(line.tax_rate) || 0;
    const sub = qty * price;
    return sub + sub * (tax / 100);
  };

  const subtotal = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unit_price) || 0;
    return s + qty * price;
  }, 0);
  const taxTotal = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unit_price) || 0;
    const tax = parseFloat(l.tax_rate) || 0;
    return s + qty * price * (tax / 100);
  }, 0);
  const grandTotal = subtotal + taxTotal;

  const handleSubmit = () => {
    if (!vendorId) { toast.error("Please select a vendor"); return; }
    const validLines = lines.filter((l) => l.description && l.account_id && parseFloat(l.unit_price) > 0);
    if (validLines.length === 0) { toast.error("Add at least one line item"); return; }

    createMutation.mutate({
      vendor_id: vendorId,
      vendor_invoice_number: vendorInvoiceNumber || undefined,
      bill_date: billDate,
      due_date: dueDate || undefined,
      payment_terms: paymentTerms as "net_30",
      notes: notes || undefined,
      lines: validLines.map((l, i) => ({
        description: l.description,
        quantity: parseFloat(l.quantity) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
        account_id: l.account_id,
        tax_rate: parseFloat(l.tax_rate) || 0,
        position: i,
      })),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/accounting/bills" className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Vendor Bill</h1>
          <p className="text-muted-foreground mt-0.5">Record a bill from your vendor</p>
        </div>
      </div>

      {/* Bill header */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Bill Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5">Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">Select vendor…</option>
              {vendors?.items.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vendor Invoice #</label>
            <input
              type="text"
              placeholder="e.g. VND-INV-001"
              value={vendorInvoiceNumber}
              onChange={(e) => setVendorInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Bill Date</label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Payment Terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              {["immediate", "net_15", "net_30", "net_45", "net_60", "net_90"].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Line Items</h2>
          <button
            onClick={() => setLines((ls) => [...ls, newLine()])}
            className="flex items-center gap-1.5 text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Description", "Account", "Qty", "Unit Price", "Tax %", "Total", ""].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                      (h === "Qty" || h === "Unit Price" || h === "Tax %" || h === "Total") && "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => (
                <tr key={line.id} className="group">
                  <td className="px-4 py-2 min-w-[180px]">
                    <input
                      type="text"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, "description", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </td>
                  <td className="px-4 py-2 min-w-[160px]">
                    <select
                      value={line.account_id}
                      onChange={(e) => updateLine(line.id, "account_id", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    >
                      <option value="">Select account…</option>
                      {expenseAccounts?.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 w-20">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                    />
                  </td>
                  <td className="px-4 py-2 w-28">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.id, "unit_price", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                    />
                  </td>
                  <td className="px-4 py-2 w-20">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={line.tax_rate}
                      onChange={(e) => updateLine(line.id, "tax_rate", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-sm tabular-nums whitespace-nowrap">
                    {formatCurrency(lineTotal(line), "INR")}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setLines((ls) => ls.filter((l) => l.id !== line.id))}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="px-4 py-3 font-medium text-sm text-muted-foreground" colSpan={4}>Subtotal</td>
                <td colSpan={2} className="px-4 py-3 text-right font-semibold text-sm tabular-nums">
                  {formatCurrency(subtotal, "INR")}
                </td>
                <td />
              </tr>
              <tr className="border-t border-border bg-muted/20">
                <td className="px-4 py-3 font-medium text-sm text-muted-foreground" colSpan={4}>Tax Total</td>
                <td colSpan={2} className="px-4 py-3 text-right font-semibold text-sm tabular-nums">
                  {formatCurrency(taxTotal, "INR")}
                </td>
                <td />
              </tr>
              <tr className="border-t-2 border-border bg-muted/10">
                <td className="px-4 py-3 font-bold text-sm" colSpan={4}>Grand Total</td>
                <td colSpan={2} className="px-4 py-3 text-right font-bold text-lg tabular-nums">
                  {formatCurrency(grandTotal, "INR")}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link href="/accounting/bills" className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {createMutation.isPending ? "Creating…" : "Create Bill"}
        </button>
      </div>
    </div>
  );
}
