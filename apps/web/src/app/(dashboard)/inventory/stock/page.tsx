"use client";

import { useState } from "react";
import {
  BarChart3,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  X,
  PackageX,
  Warehouse,
} from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function AdjustStockDialog({
  stockItem,
  onClose,
}: {
  stockItem: {
    id: string;
    product_id: string;
    warehouse_id: string;
    quantity: string | number;
    product: { name: string; sku: string };
    warehouse: { name: string };
  };
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [adjustType, setAdjustType] = useState<"add" | "subtract" | "set">("add");
  const [quantity, setQuantity] = useState("");

  const mutation = api.inventory.stock.adjust.useMutation({
    onSuccess: () => {
      toast.success("Stock adjusted");
      void utils.inventory.stock.list.invalidate();
      void utils.inventory.products.stats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const currentQty = Number(stockItem.quantity);
  const newQty = () => {
    const q = parseFloat(quantity) || 0;
    if (adjustType === "set") return q;
    if (adjustType === "add") return currentQty + q;
    return Math.max(0, currentQty - q);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold">Adjust Stock</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stockItem.product.name} — {stockItem.warehouse.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-muted/40 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Current Stock</p>
            <p className="text-3xl font-bold">{currentQty}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Adjustment Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["add", "subtract", "set"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setAdjustType(type)}
                  className={cn(
                    "py-2 rounded-lg text-sm font-medium capitalize transition-colors",
                    adjustType === type
                      ? type === "add"
                        ? "bg-green-500 text-white"
                        : type === "subtract"
                        ? "bg-red-500 text-white"
                        : "bg-brand-500 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              {adjustType === "set" ? "New Quantity" : "Quantity"}
            </label>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {quantity && (
            <div className="bg-muted/40 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">New Stock</p>
              <p className={cn(
                "text-3xl font-bold",
                newQty() <= 0 ? "text-red-500" : newQty() < currentQty ? "text-amber-500" : "text-green-600"
              )}>
                {newQty()}
              </p>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() =>
              mutation.mutate({
                product_id: stockItem.product_id,
                warehouse_id: stockItem.warehouse_id,
                adjustment_type: adjustType,
                quantity: parseFloat(quantity) || 0,
              })
            }
            disabled={mutation.isPending || !quantity || parseFloat(quantity) < 0}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Adjusting…" : "Apply Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StockPage() {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [adjustItem, setAdjustItem] = useState<{
    id: string;
    product_id: string;
    warehouse_id: string;
    quantity: string | number;
    product: { name: string; sku: string };
    warehouse: { name: string };
  } | null>(null);
  const limit = 30;

  const { data: stockData, isLoading } = api.inventory.stock.list.useQuery({
    limit,
    offset: page * limit,
    warehouse_id: warehouseFilter || undefined,
    low_stock_only: lowStockOnly || undefined,
  });

  const { data: warehouses } = api.inventory.warehouses.list.useQuery();

  const filteredItems = stockData?.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.product.name.toLowerCase().includes(q) ||
      item.product.sku.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {adjustItem && (
        <AdjustStockDialog
          stockItem={adjustItem}
          onClose={() => setAdjustItem(null)}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Stock Management</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and adjust inventory levels across warehouses
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          {(warehouses?.length ?? 0) > 1 && (
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={warehouseFilter}
                onChange={(e) => { setWarehouseFilter(e.target.value); setPage(0); }}
                className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
              >
                <option value="">All Warehouses</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => setLowStockOnly((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
              lowStockOnly
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            Low Stock Only
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading stock…
            </div>
          ) : (filteredItems?.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No stock records found</p>
              <p className="text-sm mt-1">
                {search || warehouseFilter || lowStockOnly
                  ? "Try adjusting your filters"
                  : "Add products and set up warehouses to track stock"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Product", "SKU", "Warehouse", "On Hand", "Reserved", "Available", "Reorder Point", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems?.map((item) => {
                    const qty = Number(item.quantity);
                    const reserved = Number(item.reserved_qty);
                    const available = qty - reserved;
                    const reorderPoint = item.reorder_point !== null ? Number(item.reorder_point) : null;
                    const isLow = reorderPoint !== null && qty <= reorderPoint;
                    const isOut = qty <= 0;

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "hover:bg-muted/20 transition-colors group",
                          isOut && "bg-red-500/5",
                          isLow && !isOut && "bg-amber-500/5"
                        )}
                      >
                        <td className="px-5 py-4 font-medium text-sm">{item.product.name}</td>
                        <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{item.product.sku}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                            <Warehouse className="w-3 h-3" />
                            {item.warehouse.name}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "font-bold text-sm",
                            isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-foreground"
                          )}>
                            {qty}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm">{reserved}</td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "font-medium text-sm",
                            available <= 0 ? "text-red-500" : "text-foreground"
                          )}>
                            {available}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {reorderPoint ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                              <PackageX className="w-3 h-3" />
                              Out of stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                              In stock
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setAdjustItem({ ...item, quantity: Number(item.quantity) })}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 rounded-lg transition-colors"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
