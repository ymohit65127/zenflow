"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Filter,
  ChevronDown,
  Package,
  Truck,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

type POStatus = "DRAFT" | "SENT" | "CONFIRMED" | "RECEIVED" | "CANCELLED";

const STATUS_COLORS: Record<POStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/10 text-blue-600",
  CONFIRMED: "bg-violet-500/10 text-violet-600",
  RECEIVED: "bg-green-500/10 text-green-600",
  CANCELLED: "bg-muted text-muted-foreground",
};

interface POLineItem {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

function ReceiveDialog({
  poId,
  poNumber,
  onClose,
}: {
  poId: string;
  poNumber: string;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const { data: warehouses } = api.inventory.warehouses.list.useQuery();
  const [warehouseId, setWarehouseId] = useState<string>(() => warehouses?.[0]?.id ?? "");

  const mutation = api.inventory.purchaseOrders.receive.useMutation({
    onSuccess: () => {
      toast.success(`PO ${poNumber} received. Stock updated.`);
      void utils.inventory.purchaseOrders.list.invalidate();
      void utils.inventory.stock.list.invalidate();
      void utils.inventory.products.stats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Receive Order {poNumber}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a warehouse to receive this order. Stock quantities will be updated automatically.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1.5">Receive Into Warehouse</label>
            {(warehouses?.length ?? 0) === 0 ? (
              <p className="text-sm text-red-500">No warehouses found. Please create a warehouse first.</p>
            ) : (
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() => mutation.mutate({ id: poId, warehouse_id: warehouseId })}
            disabled={mutation.isPending || !warehouseId}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            <Truck className="w-4 h-4" />
            {mutation.isPending ? "Receiving…" : "Confirm Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPODialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: products } = api.inventory.products.list.useQuery({ limit: 200, offset: 0 });

  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [expectedDate, setExpectedDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<POLineItem[]>([
    { product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 0 },
  ]);

  const mutation = api.inventory.purchaseOrders.create.useMutation({
    onSuccess: (po) => {
      toast.success(`Purchase Order ${po.po_number} created`);
      void utils.inventory.purchaseOrders.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLine = (idx: number, field: keyof POLineItem, val: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        if (field === "product_id") {
          const product = products?.items.find((p) => p.id === val);
          if (product) {
            updated.description = product.name;
            updated.unit_price = Number(product.cost_price ?? 0);
            updated.tax_rate = Number(product.tax_rate ?? 0);
          }
        }
        return updated;
      })
    );
  };

  const addLine = () =>
    setLineItems((prev) => [
      ...prev,
      { product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 0 },
    ]);
  const removeLine = (idx: number) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  let subtotal = 0;
  let taxTotal = 0;
  lineItems.forEach((item) => {
    const base = item.quantity * item.unit_price;
    const tax = base * (item.tax_rate / 100);
    subtotal += base;
    taxTotal += tax;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">New Purchase Order</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Supplier Name *</label>
              <input
                type="text"
                placeholder="Supplier company name"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected Delivery</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
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
                {["USD", "EUR", "GBP", "INR", "CAD"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold">Line Items</label>
              <button onClick={addLine} className="flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600">
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <select
                      value={item.product_id}
                      onChange={(e) => updateLine(idx, "product_id", e.target.value)}
                      className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    >
                      <option value="">Select product</option>
                      {products?.items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Unit Price"
                      value={item.unit_price}
                      onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Tax %"
                      value={item.tax_rate}
                      onChange={(e) => updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end pt-2">
                    <span className="text-sm font-medium">
                      {formatCurrency(item.quantity * item.unit_price * (1 + item.tax_rate / 100), currency)}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {lineItems.length > 1 && (
                      <button onClick={() => removeLine(idx)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-56 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(taxTotal, currency)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-brand-500">{formatCurrency(subtotal + taxTotal, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() =>
              mutation.mutate({
                supplier_name: supplierName,
                order_date: orderDate,
                expected_date: expectedDate || undefined,
                currency,
                notes: notes || undefined,
                line_items: lineItems.filter((l) => l.product_id),
              })
            }
            disabled={
              mutation.isPending ||
              !supplierName.trim() ||
              lineItems.every((l) => !l.product_id)
            }
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create Purchase Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<POStatus | "">("");
  const [page, setPage] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const limit = 20;

  const utils = api.useUtils();
  const { data, isLoading } = api.inventory.purchaseOrders.list.useQuery({
    limit,
    offset: page * limit,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const updateStatusMutation = api.inventory.purchaseOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      void utils.inventory.purchaseOrders.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const receiveItem = data?.items.find((po) => po.id === receiveId);
  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showNew && <NewPODialog onClose={() => setShowNew(false)} />}
      {receiveId && receiveItem && (
        <ReceiveDialog
          poId={receiveId}
          poNumber={receiveItem.po_number}
          onClose={() => setReceiveId(null)}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground mt-1">Manage supplier orders and stock receiving</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search POs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as POStatus | ""); setPage(0); }}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading purchase orders…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No purchase orders found</p>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Purchase Order
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["PO Number", "Supplier", "Order Date", "Expected Date", "Items", "Total", "Status", "Actions"].map((h) => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((po) => (
                      <tr key={po.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-medium text-brand-500 font-mono">{po.po_number}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-sm">{po.supplier_name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(po.order_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                          {po.expected_date
                            ? new Date(po.expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                            {po._count.line_items}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium whitespace-nowrap">
                          {formatCurrency(Number(po.total), po.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                            STATUS_COLORS[po.status as POStatus] ?? "bg-muted text-muted-foreground"
                          )}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {po.status !== "RECEIVED" && po.status !== "CANCELLED" && (
                              <button
                                onClick={() => setReceiveId(po.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg transition-colors"
                              >
                                <Truck className="w-3 h-3" />
                                Receive
                              </button>
                            )}
                            {po.status === "DRAFT" && (
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: po.id, status: "SENT" })}
                                className="px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors"
                              >
                                Send
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
                    Showing {page * limit + 1}–{Math.min((page + 1) * limit, data?.total ?? 0)} of {data?.total}
                  </p>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Previous</button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Next</button>
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
