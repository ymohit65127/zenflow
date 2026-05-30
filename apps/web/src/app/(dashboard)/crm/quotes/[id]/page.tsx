"use client";

import { use, useState } from "react";
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
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Package,
} from "lucide-react";
import { toast } from "sonner";

function formatCurrency(val: number | null | undefined) {
  if (!val) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

type LineItem = {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_type?: "percent" | "amount";
  discount: number;
  tax_percent: number;
  position: number;
};

function calcLineTotal(line: LineItem): number {
  const discountAmt =
    line.discount_type === "percent"
      ? line.quantity * line.unit_price * (line.discount / 100)
      : line.discount;
  const subtotal = line.quantity * line.unit_price - discountAmt;
  return subtotal * (1 + line.tax_percent / 100);
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: quote, isLoading, refetch } = api.crm.quotes.getById.useQuery({ id });
  const { data: products } = api.crm.products.list.useQuery({ isActive: true, limit: 100 });

  const [lines, setLines] = useState<LineItem[]>([]);
  const [linesLoaded, setLinesLoaded] = useState(false);
  const [linesChanged, setLinesChanged] = useState(false);

  // Initialize lines from quote when loaded
  if (quote && !linesLoaded) {
    setLines(
      quote.lines.map((l) => ({
        product_id: l.product_id ?? undefined,
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        discount_type: (l.discount_type as "percent" | "amount") ?? undefined,
        discount: Number(l.discount),
        tax_percent: Number(l.tax_percent),
        position: l.position,
      }))
    );
    setLinesLoaded(true);
  }

  const updateLinesMutation = api.crm.quotes.updateLines.useMutation({
    onSuccess: () => { toast.success("Quote lines saved"); void refetch(); setLinesChanged(false); },
    onError: (err) => toast.error(err.message),
  });

  const sendMutation = api.crm.quotes.send.useMutation({
    onSuccess: () => { toast.success("Quote sent"); void refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const acceptMutation = api.crm.quotes.markAccepted.useMutation({
    onSuccess: () => { toast.success("Quote accepted"); void refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = api.crm.quotes.markRejected.useMutation({
    onSuccess: () => { toast.success("Quote rejected"); void refetch(); },
    onError: (err) => toast.error(err.message),
  });

  function addLine() {
    const newLine: LineItem = {
      description: "",
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax_percent: 0,
      position: lines.length,
    };
    setLines([...lines, newLine]);
    setLinesChanged(true);
  }

  function updateLine(idx: number, update: Partial<LineItem>) {
    const updated = [...lines];
    updated[idx] = { ...updated[idx]!, ...update };
    setLines(updated);
    setLinesChanged(true);
  }

  function removeLine(idx: number) {
    const updated = lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, position: i }));
    setLines(updated);
    setLinesChanged(true);
  }

  function addProductLine(productId: string) {
    const product = products?.products?.find((p) => p.id === productId);
    if (!product) return;
    const newLine: LineItem = {
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: Number(product.unit_price),
      discount: 0,
      tax_percent: Number(product.tax_percent),
      position: lines.length,
    };
    setLines([...lines, newLine]);
    setLinesChanged(true);
  }

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const discountTotal = lines.reduce((sum, l) => {
    const d = l.discount_type === "percent"
      ? l.quantity * l.unit_price * (l.discount / 100)
      : l.discount;
    return sum + d;
  }, 0);
  const taxTotal = lines.reduce((sum, l) => {
    const base = l.quantity * l.unit_price - (l.discount_type === "percent" ? l.quantity * l.unit_price * (l.discount / 100) : l.discount);
    return sum + base * (l.tax_percent / 100);
  }, 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  if (isLoading) {
    return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  }

  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Quote not found</p>
        <Link href="/crm/quotes" className="text-brand-500 mt-2 block">Back to quotes</Link>
      </div>
    );
  }

  const isEditable = quote.status === "draft";

  return (
    <div className="space-y-6">
      <Link href="/crm/quotes" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Quotes
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{quote.title}</h1>
              <Badge
                className={
                  quote.status === "accepted"
                    ? "bg-green-100 text-green-700"
                    : quote.status === "rejected"
                    ? "bg-red-100 text-red-700"
                    : quote.status === "sent"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
                }
              >
                {quote.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">{quote.quote_number}</p>
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const email = prompt("Send to email:");
                  if (email) sendMutation.mutate({ quoteId: quote.id, toEmail: email });
                }}
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Send
              </Button>
            )}
            {quote.status === "sent" && (
              <>
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => acceptMutation.mutate({ quoteId: quote.id })}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500"
                  onClick={() => rejectMutation.mutate({ quoteId: quote.id })}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Line Items</h3>
          {isEditable && (
            <div className="flex gap-2">
              {products && products.products && products.products.length > 0 && (
                <Select onValueChange={addProductLine}>
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue placeholder="Add from catalog..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(Number(p.unit_price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                <th className="text-right p-3 font-medium text-muted-foreground w-20">Qty</th>
                <th className="text-right p-3 font-medium text-muted-foreground w-32">Unit Price</th>
                <th className="text-right p-3 font-medium text-muted-foreground w-24">Discount</th>
                <th className="text-right p-3 font-medium text-muted-foreground w-24">Tax %</th>
                <th className="text-right p-3 font-medium text-muted-foreground w-32">Total</th>
                {isEditable && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="p-3">
                    {isEditable ? (
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        className="h-7 text-sm"
                        placeholder="Item description"
                      />
                    ) : (
                      <p className="font-medium">{line.description}</p>
                    )}
                  </td>
                  <td className="p-3">
                    {isEditable ? (
                      <Input
                        type="number"
                        min={0.001}
                        step={0.001}
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        className="h-7 text-sm text-right"
                      />
                    ) : (
                      <span className="block text-right">{line.quantity}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {isEditable ? (
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })}
                        className="h-7 text-sm text-right"
                      />
                    ) : (
                      <span className="block text-right">{formatCurrency(line.unit_price)}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {isEditable ? (
                      <Input
                        type="number"
                        min={0}
                        value={line.discount}
                        onChange={(e) => updateLine(idx, { discount: Number(e.target.value) })}
                        className="h-7 text-sm text-right"
                      />
                    ) : (
                      <span>{line.discount}{line.discount_type === "percent" ? "%" : ""}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {isEditable ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={line.tax_percent}
                        onChange={(e) => updateLine(idx, { tax_percent: Number(e.target.value) })}
                        className="h-7 text-sm text-right"
                      />
                    ) : (
                      <span>{line.tax_percent.toFixed(0)}%</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {formatCurrency(calcLineTotal(line))}
                  </td>
                  {isEditable && (
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={isEditable ? 7 : 6} className="p-8 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No line items yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-border p-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              {taxTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-border pt-1.5">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {isEditable && linesChanged && (
          <div className="border-t border-border p-4 bg-muted/20">
            <Button
              className="bg-brand-500 hover:bg-brand-600 text-white"
              disabled={updateLinesMutation.isPending}
              onClick={() =>
                updateLinesMutation.mutate({
                  quoteId: quote.id,
                  lines: lines.map((l, idx) => ({ ...l, position: idx })),
                })
              }
            >
              {updateLinesMutation.isPending ? "Saving..." : "Save Line Items"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
