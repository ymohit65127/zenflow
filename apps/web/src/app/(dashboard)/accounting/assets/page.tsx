"use client";

import { useState } from "react";
import { Plus, Search, Package, X, Calendar, TrendingDown } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

function AddAssetDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: accounts } = api.accounting.coa.list.useQuery({});
  const { data: vendors } = api.accounting.vendors.list.useQuery({ limit: 100, offset: 0 });

  const [name, setName] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [assetCategory, setAssetCategory] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [purchaseValue, setPurchaseValue] = useState("");
  const [salvageValue, setSalvageValue] = useState("0");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60");
  const [depreciationMethod, setDepreciationMethod] = useState("straight_line");
  const [assetAccountId, setAssetAccountId] = useState("");
  const [accumDepAccountId, setAccumDepAccountId] = useState("");
  const [depExpAccountId, setDepExpAccountId] = useState("");
  const [vendorId, setVendorId] = useState("");

  const assetAccounts = accounts?.filter((a) => a.account_type === "asset");
  const contraAssetAccounts = accounts?.filter((a) => a.account_type === "contra_asset");
  const expenseAccounts = accounts?.filter((a) => a.account_type === "expense");

  const mutation = api.accounting.assets.create.useMutation({
    onSuccess: () => {
      toast.success("Fixed asset created with depreciation schedule");
      void utils.accounting.assets.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Add Fixed Asset</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Asset Name</label>
              <input type="text" placeholder="e.g. Dell Laptop XPS-15" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Asset Code</label>
              <input type="text" placeholder="e.g. IT-LAPTOP-001" value={assetCode} onChange={(e) => setAssetCode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Category</label>
              <input type="text" placeholder="e.g. IT Equipment" value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Purchase Date</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Purchase Value (INR)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Salvage Value (INR)</label>
              <input type="number" min="0" step="0.01" value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Useful Life (months)</label>
              <input type="number" min="1" step="1" value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Depreciation Method</label>
              <select value={depreciationMethod} onChange={(e) => setDepreciationMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
                <option value="sum_of_years">Sum of Years</option>
              </select>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">GL Accounts</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">Asset Account</label>
                <select value={assetAccountId} onChange={(e) => setAssetAccountId(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                  <option value="">Select…</option>
                  {assetAccounts?.map((a) => (<option key={a.id} value={a.id}>{a.code} — {a.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Accum. Depreciation</label>
                <select value={accumDepAccountId} onChange={(e) => setAccumDepAccountId(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                  <option value="">Select…</option>
                  {contraAssetAccounts?.map((a) => (<option key={a.id} value={a.id}>{a.code} — {a.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Dep. Expense</label>
                <select value={depExpAccountId} onChange={(e) => setDepExpAccountId(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                  <option value="">Select…</option>
                  {expenseAccounts?.map((a) => (<option key={a.id} value={a.id}>{a.code} — {a.name}</option>))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vendor (optional)</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">None</option>
              {vendors?.items.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={() => mutation.mutate({
              name, asset_code: assetCode || undefined, asset_category: assetCategory || undefined,
              purchase_date: purchaseDate, purchase_value: parseFloat(purchaseValue) || 0,
              salvage_value: parseFloat(salvageValue) || 0,
              useful_life_months: parseInt(usefulLifeMonths) || 60,
              depreciation_method: depreciationMethod as "straight_line",
              asset_account_id: assetAccountId, accumulated_depreciation_account_id: accumDepAccountId,
              depreciation_expense_account_id: depExpAccountId, vendor_id: vendorId || undefined,
            })}
            disabled={mutation.isPending || !name || !purchaseValue || !assetAccountId || !accumDepAccountId || !depExpAccountId}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {mutation.isPending ? "Creating…" : "Create Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FixedAssetsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const limit = 20;

  const { data, isLoading } = api.accounting.assets.list.useQuery({
    limit, offset: page * limit, search: search || undefined,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);
  const totalValue = data?.items.reduce((s, a) => s + Number(a.purchase_value), 0) ?? 0;
  const totalBookValue = data?.items.reduce((s, a) => s + Number(a.current_book_value ?? a.purchase_value), 0) ?? 0;

  return (
    <>
      {showAdd && <AddAssetDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fixed Assets Register</h1>
            <p className="text-muted-foreground mt-1">Track assets and depreciation schedules</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
            <p className="text-xl font-bold text-brand-500">{data?.total ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
            <p className="text-xl font-bold">{formatCurrency(totalValue, "INR")}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Net Book Value</p>
            <p className="text-xl font-bold text-green-500">{formatCurrency(totalBookValue, "INR")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" placeholder="Search assets..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />Loading…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No fixed assets</p>
              <p className="text-sm mt-1">Add your first asset to start tracking depreciation</p>
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Add Asset
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Asset", "Category", "Purchase Date", "Cost", "Book Value", "Useful Life", "Status"].map((h) => (
                        <th key={h} className={cn("text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap", (h === "Cost" || h === "Book Value") && "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.items.map((asset) => {
                      const dep = 1 - Number(asset.current_book_value ?? asset.purchase_value) / Number(asset.purchase_value);
                      return (
                        <tr key={asset.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Package className="w-4 h-4 text-orange-500" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{asset.name}</p>
                                {asset.asset_code && <p className="text-xs text-muted-foreground font-mono">{asset.asset_code}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{asset.asset_category ?? "—"}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDate(asset.purchase_date)}</div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-sm tabular-nums">{formatCurrency(Number(asset.purchase_value), "INR")}</td>
                          <td className="px-6 py-4 text-right">
                            <div>
                              <p className="font-medium text-sm tabular-nums">{formatCurrency(Number(asset.current_book_value ?? asset.purchase_value), "INR")}</p>
                              <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.round(dep * 100)}%` }} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{Math.round(dep * 100)}% depreciated</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1"><TrendingDown className="w-3 h-3" />{asset.useful_life_months} months</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", asset.disposed_at ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600")}>
                              {asset.disposed_at ? "Disposed" : "Active"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">Showing {page * limit + 1}–{Math.min((page + 1) * limit, data?.total ?? 0)} of {data?.total}</p>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted">Previous</button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted">Next</button>
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
