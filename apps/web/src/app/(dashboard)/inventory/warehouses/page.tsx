"use client";

import { useState } from "react";
import {
  Warehouse,
  Plus,
  MapPin,
  ChevronRight,
  ChevronDown,
  Layers,
  X,
  Settings,
} from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Location Tree Node ───────────────────────────────────────────────────────

type LocationNode = {
  id: string;
  name: string;
  code: string;
  location_type: string;
  is_active: boolean;
  children: LocationNode[];
};

function LocationTreeNode({
  node,
  depth = 0,
}: {
  node: LocationNode;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  const typeColors: Record<string, string> = {
    zone: "bg-violet-500/10 text-violet-600",
    aisle: "bg-blue-500/10 text-blue-600",
    rack: "bg-cyan-500/10 text-cyan-600",
    bin: "bg-green-500/10 text-green-600",
    shelf: "bg-amber-500/10 text-amber-600",
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 cursor-pointer",
          depth > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setExpanded((v) => !v)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-3.5 h-3.5 shrink-0" />
        )}
        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">{node.name}</span>
        <span className="font-mono text-xs text-muted-foreground">({node.code})</span>
        <span
          className={cn(
            "ml-auto text-xs font-medium px-2 py-0.5 rounded-full capitalize",
            typeColors[node.location_type] ?? "bg-muted text-muted-foreground"
          )}
        >
          {node.location_type}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <LocationTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Warehouse Dialog ──────────────────────────────────────────────────

function CreateWarehouseDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [form, setForm] = useState({
    name: "",
    code: "",
  });

  const mutation = api.inventory.warehousesV2.create.useMutation({
    onSuccess: () => {
      toast.success("Warehouse created");
      void utils.inventory.warehousesV2.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Add Warehouse</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Warehouse Name *</label>
              <input
                type="text"
                placeholder="e.g. Main Warehouse"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Code *</label>
              <input
                type="text"
                placeholder="e.g. WH-MAIN"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono"
              />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate({ name: form.name, code: form.code })}
            disabled={mutation.isPending || !form.name || !form.code}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create Warehouse"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WarehousesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedWh, setExpandedWh] = useState<string | null>(null);

  const { data: warehouses, isLoading } = api.inventory.warehousesV2.list.useQuery();
  const { data: locationData } = api.inventory.warehousesV2.listLocations.useQuery(
    { warehouse_id: expandedWh! },
    { enabled: !!expandedWh }
  );

  return (
    <>
      {showCreate && <CreateWarehouseDialog onClose={() => setShowCreate(false)} />}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Warehouses</h1>
            <p className="text-muted-foreground mt-1">Manage warehouses and location trees</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Warehouse
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading warehouses…
          </div>
        ) : warehouses?.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
            <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No warehouses yet</p>
            <p className="text-sm mt-1">Create your first warehouse to start managing stock</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Warehouse
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {warehouses?.map((wh) => {
              const isExpanded = expandedWh === wh.id;
              return (
                <div key={wh.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-5 cursor-pointer hover:bg-muted/20"
                    onClick={() => setExpandedWh(isExpanded ? null : wh.id)}
                  >
                    <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <Warehouse className="w-5 h-5 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{wh.name}</p>
                        {!wh.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 font-mono">{wh.code}</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{wh._count.locations}</p>
                        <p className="text-xs">Locations</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{wh._count.stock_levels}</p>
                        <p className="text-xs">SKUs</p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-muted-foreground" />
                          Location Tree
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {locationData?.length ?? 0} top-level locations
                        </span>
                      </div>
                      {locationData && locationData.length > 0 ? (
                        <div className="space-y-0.5">
                          {locationData.map((loc) => (
                            <LocationTreeNode key={loc.id} node={loc as LocationNode} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No locations defined yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
