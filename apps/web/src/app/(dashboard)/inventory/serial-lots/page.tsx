"use client";

import { useState } from "react";
import {
  Hash,
  Layers,
  Search,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type SerialStatus = "in_stock" | "sold" | "returned" | "damaged" | "expired";
const SERIAL_STATUS_COLORS: Record<SerialStatus, string> = {
  in_stock: "bg-green-500/10 text-green-600",
  sold: "bg-blue-500/10 text-blue-600",
  returned: "bg-amber-500/10 text-amber-600",
  damaged: "bg-red-500/10 text-red-600",
  expired: "bg-gray-500/10 text-gray-600",
};

export default function SerialLotsPage() {
  const [tab, setTab] = useState<"serials" | "lots">("serials");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SerialStatus | "">("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data: serialData, isLoading: serialLoading } = api.inventory.serialLot.listSerials.useQuery(
    { search: search || undefined, status: (statusFilter || undefined) as SerialStatus | undefined, limit, offset: page * limit },
    { enabled: tab === "serials" }
  );

  const { data: lotData, isLoading: lotLoading } = api.inventory.serialLot.listLots.useQuery(
    { limit, offset: page * limit },
    { enabled: tab === "lots" }
  );

  const totalPages = tab === "serials"
    ? Math.ceil((serialData?.total ?? 0) / limit)
    : Math.ceil((lotData?.total ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Serial Numbers & Lots</h1>
          <p className="text-muted-foreground mt-1">Track individual items and batch records</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {[
          { key: "serials" as const, label: "Serial Numbers", Icon: Hash },
          { key: "lots" as const, label: "Lots / Batches", Icon: Layers },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(0); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab === "serials" && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search serial number..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["", "in_stock", "sold", "returned", "damaged", "expired"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s as SerialStatus | ""); setPage(0); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium capitalize",
                  statusFilter === s ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {tab === "serials" ? (
          serialLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading serials…
            </div>
          ) : serialData?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Hash className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No serial numbers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Serial #", "Product", "Status", "Purchased", "Expires", "Notes"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {serialData?.items.map((s) => {
                    const status = s.status as SerialStatus;
                    const isExpired = s.expires_at && new Date(s.expires_at) < new Date();
                    return (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3 font-mono text-sm font-semibold">{s.serial_number}</td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium">{s.product.name}</p>
                          <p className="text-xs text-muted-foreground">{s.product.sku}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize", SERIAL_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground")}>
                            {s.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {s.purchased_at ? format(new Date(s.purchased_at), "MMM dd, yyyy") : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {s.expires_at ? (
                            <span className={cn(isExpired ? "text-red-500 font-medium" : "text-muted-foreground")}>
                              {format(new Date(s.expires_at), "MMM dd, yyyy")}
                              {isExpired && " (Expired)"}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{s.notes ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // Lots table
          lotLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading lots…
            </div>
          ) : lotData?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No lots found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Lot #", "Product", "Quantity", "Manufactured", "Expiry", "Notes"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lotData?.items.map((lot) => {
                    const daysToExpiry = lot.expiry_date
                      ? Math.floor((new Date(lot.expiry_date).getTime() - Date.now()) / 86400000)
                      : null;
                    const isExpired = daysToExpiry !== null && daysToExpiry < 0;
                    const isExpiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30;

                    return (
                      <tr key={lot.id} className={cn("hover:bg-muted/20", isExpired && "bg-red-500/5")}>
                        <td className="px-5 py-3 font-mono text-sm font-semibold">{lot.lot_number}</td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium">{lot.product.name}</p>
                          <p className="text-xs text-muted-foreground">{lot.product.sku}</p>
                        </td>
                        <td className="px-5 py-3 text-sm font-medium">
                          {Number(lot.quantity)}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {lot.manufacture_date ? format(new Date(lot.manufacture_date), "MMM dd, yyyy") : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {lot.expiry_date ? (
                            <span className={cn(
                              isExpired ? "text-red-600 font-medium" : isExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground"
                            )}>
                              {isExpiringSoon && !isExpired && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                              {format(new Date(lot.expiry_date), "MMM dd, yyyy")}
                              {isExpired && " (Expired)"}
                              {isExpiringSoon && !isExpired && ` (${daysToExpiry}d)`}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{lot.notes ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Previous</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
