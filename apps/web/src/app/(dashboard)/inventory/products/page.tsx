"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Edit2,
  Trash2,
  Filter,
  ChevronDown,
  X,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ProductType = "PHYSICAL" | "DIGITAL" | "SERVICE" | "BUNDLE";

const TYPE_COLORS: Record<ProductType, string> = {
  PHYSICAL: "bg-cyan-500/10 text-cyan-600",
  DIGITAL: "bg-violet-500/10 text-violet-600",
  SERVICE: "bg-brand-500/10 text-brand-500",
  BUNDLE: "bg-amber-500/10 text-amber-600",
};

interface ProductFormData {
  sku: string;
  name: string;
  description: string;
  type: ProductType;
  unit: string;
  cost_price: string;
  sale_price: string;
  tax_rate: string;
  track_inventory: boolean;
  is_active: boolean;
  category_ids: string[];
}

const defaultForm = (): ProductFormData => ({
  sku: "",
  name: "",
  description: "",
  type: "PHYSICAL",
  unit: "pcs",
  cost_price: "",
  sale_price: "",
  tax_rate: "0",
  track_inventory: true,
  is_active: true,
  category_ids: [],
});

function ProductDialog({
  product,
  onClose,
}: {
  product?: { id: string } & Partial<ProductFormData>;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<ProductFormData>(() => ({
    ...defaultForm(),
    ...(product
      ? {
          sku: product.sku ?? "",
          name: product.name ?? "",
          description: product.description ?? "",
          type: product.type ?? "PHYSICAL",
          unit: product.unit ?? "pcs",
          cost_price: product.cost_price ?? "",
          sale_price: product.sale_price ?? "",
          tax_rate: product.tax_rate ?? "0",
          track_inventory: product.track_inventory ?? true,
          is_active: product.is_active ?? true,
          category_ids: product.category_ids ?? [],
        }
      : {}),
  }));

  const { data: categories } = api.inventory.categories.list.useQuery();

  const createMutation = api.inventory.products.create.useMutation({
    onSuccess: () => {
      toast.success("Product created");
      void utils.inventory.products.list.invalidate();
      void utils.inventory.products.stats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = api.inventory.products.update.useMutation({
    onSuccess: () => {
      toast.success("Product updated");
      void utils.inventory.products.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    const data = {
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      unit: form.unit,
      cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
      sale_price: form.sale_price ? parseFloat(form.sale_price) : undefined,
      tax_rate: parseFloat(form.tax_rate) || 0,
      track_inventory: form.track_inventory,
      is_active: form.is_active,
      category_ids: form.category_ids,
    };
    if (product?.id) {
      updateMutation.mutate({ id: product.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const setField = <K extends keyof ProductFormData>(key: K, val: ProductFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (key === "name" && !product?.id) {
      setForm((prev) => ({ ...prev, name: val as string, sku: (val as string).toUpperCase().replace(/\s+/g, "-").slice(0, 20) }));
    }
  };

  const toggleCategory = (id: string) => {
    setForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(id)
        ? prev.category_ids.filter((c) => c !== id)
        : [...prev.category_ids, id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">
            {product?.id ? "Edit Product" : "Add Product"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Product Name *</label>
              <input
                type="text"
                placeholder="e.g. Laptop Pro 15"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">SKU *</label>
              <input
                type="text"
                placeholder="e.g. LAPTOP-PRO-15"
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              rows={2}
              placeholder="Product description..."
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setField("type", e.target.value as ProductType)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="PHYSICAL">Physical</option>
                <option value="DIGITAL">Digital</option>
                <option value="SERVICE">Service</option>
                <option value="BUNDLE">Bundle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setField("unit", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {["pcs", "kg", "g", "lbs", "oz", "l", "ml", "m", "cm", "hrs", "days", "license", "seat"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tax Rate %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.tax_rate}
                onChange={(e) => setField("tax_rate", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Cost Price</label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0.00"
                value={form.cost_price}
                onChange={(e) => setField("cost_price", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Sale Price</label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0.00"
                value={form.sale_price}
                onChange={(e) => setField("sale_price", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>

          {/* Categories */}
          {(categories?.length ?? 0) > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Categories</label>
              <div className="flex flex-wrap gap-2">
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                      form.category_ids.includes(cat.id)
                        ? "bg-brand-500 text-white border-brand-500"
                        : "border-border text-muted-foreground hover:border-brand-500/50"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setField("track_inventory", !form.track_inventory)}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  form.track_inventory ? "bg-brand-500" : "bg-muted"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    form.track_inventory ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </div>
              <span className="text-sm font-medium">Track Inventory</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setField("is_active", !form.is_active)}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  form.is_active ? "bg-brand-500" : "bg-muted"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    form.is_active ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </div>
              <span className="text-sm font-medium">Active</span>
            </label>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !form.name.trim() || !form.sku.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {isPending ? "Saving…" : product?.id ? "Update Product" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProductType | "">("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>("");
  const limit = 25;

  const utils = api.useUtils();
  const { data, isLoading } = api.inventory.products.list.useQuery({
    limit,
    offset: page * limit,
    search: search || undefined,
    type: typeFilter || undefined,
  });

  const deleteMutation = api.inventory.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Product deleted");
      void utils.inventory.products.list.invalidate();
      void utils.inventory.products.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <>
      {showAdd && <ProductDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            <p className="text-muted-foreground mt-1">Manage your product catalog</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as ProductType | ""); setPage(0); }}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="PHYSICAL">Physical</option>
              <option value="DIGITAL">Digital</option>
              <option value="SERVICE">Service</option>
              <option value="BUNDLE">Bundle</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading products…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No products found</p>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["SKU", "Product Name", "Category", "Type", "Cost", "Sale Price", "Stock", "Status", "Actions"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((product) => {
                      const totalQty = product.stock_items.reduce(
                        (sum, s) => sum + Number(s.quantity), 0
                      );
                      const minReorder = product.stock_items.reduce(
                        (min, s) => s.reorder_point !== null ? Math.min(min, Number(s.reorder_point)) : min,
                        Infinity
                      );
                      const reorderPoint = minReorder === Infinity ? null : minReorder;
                      const isLow = reorderPoint !== null && totalQty <= reorderPoint;
                      const isOut = totalQty <= 0;

                      return (
                        <tr key={product.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{product.sku}</td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-sm">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {product.categories?.[0]?.category ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600">
                                {product.categories[0].category.name}
                              </span>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                              TYPE_COLORS[product.type as ProductType]
                            )}>
                              {product.type}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {product.cost_price !== null ? formatCurrency(Number(product.cost_price)) : "—"}
                          </td>
                          <td className="px-5 py-4 text-sm font-medium">
                            {product.sale_price !== null ? formatCurrency(Number(product.sale_price)) : "—"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              {(isLow || isOut) && (
                                <AlertTriangle className={cn("w-3.5 h-3.5", isOut ? "text-red-500" : "text-amber-500")} />
                              )}
                              <span className={cn(
                                "font-medium text-sm",
                                isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-foreground"
                              )}>
                                {totalQty}
                              </span>
                              <span className="text-xs text-muted-foreground">{product.unit}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                              product.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                            )}>
                              {product.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setConfirmDeleteId(product.id); setConfirmDeleteName(product.name); }}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) { setConfirmDeleteId(null); setConfirmDeleteName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDeleteName}?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDeleteId(null); setConfirmDeleteName(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmDeleteId) { deleteMutation.mutate({ id: confirmDeleteId }); setConfirmDeleteId(null); setConfirmDeleteName(""); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
