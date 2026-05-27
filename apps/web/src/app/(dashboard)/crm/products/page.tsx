// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";

function formatCurrency(val: number | null | undefined) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(val);
}

function ProductFormDialog({
  product,
  onSaved,
  trigger,
}: {
  product?: {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    unit_price: unknown;
    currency: string;
    tax_rate: unknown;
    unit: string | null;
    category: string | null;
    is_active: boolean;
  };
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    code: product?.code ?? "",
    description: product?.description ?? "",
    unit_price: product ? Number(product.unit_price) : 0,
    currency: product?.currency ?? "USD",
    tax_rate: product ? Number(product.tax_rate) : 0,
    unit: product?.unit ?? "",
    category: product?.category ?? "",
    is_active: product?.is_active ?? true,
  });

  const createMutation = api.crm.products.create.useMutation({
    onSuccess: () => { toast.success("Product created"); setOpen(false); onSaved(); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.crm.products.update.useMutation({
    onSuccess: () => { toast.success("Product updated"); setOpen(false); onSaved(); },
    onError: (err) => toast.error(err.message),
  });

  const isEditing = !!product;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Annual License"
              />
            </div>
            <div>
              <Label>Code / SKU</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="LIC-001"
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Annual software license per seat"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Unit Price *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                maxLength={3}
                className="uppercase"
              />
            </div>
            <div>
              <Label>Tax Rate (0–1)</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="seat, license, hour"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Software"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
          <Button
            className="w-full bg-brand-500 hover:bg-brand-600 text-white"
            disabled={!form.name || (isEditing ? updateMutation.isPending : createMutation.isPending)}
            onClick={() => {
              const data = {
                name: form.name,
                code: form.code || undefined,
                description: form.description || undefined,
                unit_price: form.unit_price,
                currency: form.currency,
                tax_rate: form.tax_rate,
                unit: form.unit || undefined,
                category: form.category || undefined,
                is_active: form.is_active,
              };
              if (isEditing) {
                updateMutation.mutate({ id: product.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
          >
            {isEditing ? "Save Changes" : "Add Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const { data, isLoading, refetch } = api.crm.products.list.useQuery({
    search: search || undefined,
    isActive: activeFilter,
    limit: 100,
  });

  const deleteMutation = api.crm.products.delete.useMutation({
    onSuccess: () => { toast.success("Product deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.crm.products.update.useMutation({
    onSuccess: () => { toast.success("Updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const products = data?.products ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-500" />
            Product Catalog
          </h1>
          <p className="text-muted-foreground mt-1">{products.length} products</p>
        </div>
        <ProductFormDialog
          onSaved={() => refetch()}
          trigger={
            <Button className="bg-brand-500 hover:bg-brand-600 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Product
            </Button>
          }
        />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={activeFilter === undefined ? "all" : activeFilter ? "active" : "inactive"}
          onValueChange={(v) => {
            if (v === "all") setActiveFilter(undefined);
            else if (v === "active") setActiveFilter(true);
            else setActiveFilter(false);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No products yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add products to use them in quotes</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.unit && (
                        <p className="text-xs text-muted-foreground">per {product.unit}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.code ? (
                      <span className="font-mono text-xs text-muted-foreground">{product.code}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.category ? (
                      <Badge variant="outline">{product.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(product.unit_price))}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {(Number(product.tax_rate) * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => updateMutation.mutate({ id: product.id, data: { is_active: !product.is_active } })}
                    >
                      {product.is_active ? (
                        <Badge className="bg-green-100 text-green-700 cursor-pointer">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground cursor-pointer">Inactive</Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ProductFormDialog
                        product={product}
                        onSaved={() => refetch()}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm("Delete this product?")) {
                            deleteMutation.mutate({ id: product.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
