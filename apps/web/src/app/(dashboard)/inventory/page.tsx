"use client";

import Link from "next/link";
import {
  Package,
  AlertTriangle,
  PackageX,
  Warehouse,
  Plus,
  ArrowUpRight,
  ShoppingCart,
  BarChart3,
  Layers,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";

function StockBadge({ qty, reorderPoint }: { qty: number; reorderPoint: number | null }) {
  if (qty <= 0)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
        Out of stock
      </span>
    );
  if (reorderPoint !== null && qty <= reorderPoint)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
        <AlertTriangle className="w-3 h-3" />
        Low stock
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
      In stock
    </span>
  );
}

export default function InventoryPage() {
  const { data: statsData } = api.inventory.products.stats.useQuery();
  const { data: productsData } = api.inventory.products.list.useQuery({
    limit: 12,
    offset: 0,
  });
  const tabs = [
    { label: "Products", href: "/inventory/products", icon: Package },
    { label: "Purchase Orders", href: "/inventory/purchase-orders", icon: ShoppingCart },
    { label: "Stock", href: "/inventory/stock", icon: BarChart3 },
  ];

  const statCards = [
    {
      label: "Total Products",
      value: String(statsData?.total ?? 0),
      icon: Layers,
      color: "text-brand-500",
      bg: "bg-brand-500/10",
    },
    {
      label: "Low Stock Alerts",
      value: String(statsData?.lowStock ?? 0),
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Out of Stock",
      value: String(statsData?.outOfStock ?? 0),
      icon: PackageX,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Total Stock Value",
      value: formatCurrency(statsData?.totalStockValue ?? 0),
      icon: Warehouse,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-1">
            Products, stock levels, and purchase orders
          </p>
        </div>
        <Link
          href="/inventory/products"
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}
              >
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Sub-nav tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab, i) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              i === 0
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Product grid */}
      {productsData?.items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No products yet</p>
          <p className="text-sm mt-1">Add your first product to start tracking inventory</p>
          <Link
            href="/inventory/products"
            className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {productsData?.items.map((product) => {
            const totalQty = product.stock_items.reduce(
              (sum, s) => sum + Number(s.quantity),
              0
            );
            const minReorder = product.stock_items.reduce(
              (min, s) => (s.reorder_point !== null ? Math.min(min, Number(s.reorder_point)) : min),
              Infinity
            );
            const reorderPoint = minReorder === Infinity ? null : minReorder;

            return (
              <Link
                key={product.id}
                href={`/inventory/products`}
                className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/50 transition-all group"
              >
                {/* Image placeholder */}
                <div className="w-full h-28 bg-muted rounded-xl mb-4 flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground/40" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                      <p className="font-semibold text-sm truncate group-hover:text-brand-500 transition-colors">
                        {product.name}
                      </p>
                    </div>
                    {product.categories?.[0]?.category && (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600">
                        {product.categories[0].category.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      {product.sale_price !== null ? (
                        <p className="font-semibold text-brand-500">
                          {formatCurrency(Number(product.sale_price))}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No price set</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Stock</p>
                      <p
                        className={cn(
                          "font-bold text-sm",
                          totalQty <= 0
                            ? "text-red-500"
                            : reorderPoint !== null && totalQty <= reorderPoint
                            ? "text-amber-500"
                            : "text-green-600"
                        )}
                      >
                        {totalQty}
                      </p>
                    </div>
                  </div>

                  <StockBadge qty={totalQty} reorderPoint={reorderPoint} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {(productsData?.total ?? 0) > 12 && (
        <div className="text-center">
          <Link
            href="/inventory/products"
            className="text-sm text-brand-500 hover:underline"
          >
            View all {productsData?.total} products →
          </Link>
        </div>
      )}
    </div>
  );
}
