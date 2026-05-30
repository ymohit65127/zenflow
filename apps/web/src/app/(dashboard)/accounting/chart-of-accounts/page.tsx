"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  BookOpen,
  X,
  AlertCircle,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "contra_asset"
  | "contra_liability";

const TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-blue-500/10 text-blue-600",
  liability: "bg-red-500/10 text-red-600",
  equity: "bg-purple-500/10 text-purple-600",
  revenue: "bg-green-500/10 text-green-600",
  expense: "bg-orange-500/10 text-orange-600",
  contra_asset: "bg-sky-500/10 text-sky-600",
  contra_liability: "bg-rose-500/10 text-rose-600",
};

const ACCOUNT_TYPES: AccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "contra_asset",
  "contra_liability",
];

function AddAccountDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("asset");
  const [normalBalance, setNormalBalance] = useState<"debit" | "credit">("debit");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  const { data: accounts } = api.accounting.coa.list.useQuery({});

  const mutation = api.accounting.coa.create.useMutation({
    onSuccess: () => {
      toast.success("Account created");
      void utils.accounting.coa.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">New Account</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Account Code</label>
              <input
                type="text"
                placeholder="e.g. 1001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Account Name</label>
              <input
                type="text"
                placeholder="e.g. Cash on Hand"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => {
                  const t = e.target.value as AccountType;
                  setAccountType(t);
                  setNormalBalance(
                    t === "asset" || t === "expense" || t === "contra_liability"
                      ? "debit"
                      : "credit"
                  );
                }}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Normal Balance</label>
              <select
                value={normalBalance}
                onChange={(e) => setNormalBalance(e.target.value as "debit" | "credit")}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Parent Account</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">None (Root)</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              mutation.mutate({
                code,
                name,
                account_type: accountType,
                normal_balance: normalBalance,
                parent_account_id: parentId || undefined,
                description: description || undefined,
                opening_balance: parseFloat(openingBalance) || 0,
              })
            }
            disabled={mutation.isPending || !code.trim() || !name.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {mutation.isPending ? "Creating…" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  current_balance: number | string;
  is_active: boolean;
  is_system: boolean;
  parent_account_id: string | null;
  level: number;
};

function AccountRow({ account, depth = 0 }: { account: Account; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data: allAccounts } = api.accounting.coa.list.useQuery({});
  const children = allAccounts?.filter((a) => a.parent_account_id === account.id) ?? [];

  return (
    <>
      <tr className="hover:bg-muted/20 transition-colors group">
        <td className="px-6 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
            {children.length > 0 ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="font-mono text-sm text-muted-foreground">{account.code}</span>
          </div>
        </td>
        <td className="px-6 py-3">
          <span className="font-medium text-sm">{account.name}</span>
          {account.is_system && (
            <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              system
            </span>
          )}
        </td>
        <td className="px-6 py-3">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
              TYPE_COLORS[account.account_type as AccountType] ?? "bg-muted text-muted-foreground"
            )}
          >
            {account.account_type.replace(/_/g, " ")}
          </span>
        </td>
        <td className="px-6 py-3 text-right font-medium text-sm tabular-nums">
          {formatCurrency(Number(account.current_balance), "INR")}
        </td>
        <td className="px-6 py-3">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
              account.is_active
                ? "bg-green-500/10 text-green-600"
                : "bg-muted text-muted-foreground"
            )}
          >
            {account.is_active ? "Active" : "Inactive"}
          </span>
        </td>
      </tr>
      {expanded &&
        children.map((child) => (
          <AccountRow
            key={child.id}
            account={child as unknown as Account}
            depth={depth + 1}
          />
        ))}
    </>
  );
}

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: accounts, isLoading } = api.accounting.coa.list.useQuery({});

  const rootAccounts = (accounts ?? []).filter(
    (a) =>
      a.parent_account_id === null &&
      (typeFilter ? a.account_type === typeFilter : true) &&
      (search
        ? a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.code.toLowerCase().includes(search.toLowerCase())
        : true)
  );

  const totalsByType = (accounts ?? []).reduce(
    (acc, a) => {
      const t = a.account_type as AccountType;
      acc[t] = (acc[t] ?? 0) + Number(a.current_balance);
      return acc;
    },
    {} as Record<AccountType, number>
  );

  return (
    <>
      {showAdd && <AddAccountDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Chart of Accounts</h1>
            <p className="text-muted-foreground mt-1">
              {accounts?.length ?? 0} accounts across your organization
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["asset", "Assets", "bg-blue-500/10 text-blue-600"],
              ["liability", "Liabilities", "bg-red-500/10 text-red-600"],
              ["equity", "Equity", "bg-purple-500/10 text-purple-600"],
              ["revenue", "Revenue", "bg-green-500/10 text-green-600"],
            ] as [AccountType, string, string][]
          ).map(([type, label, cls]) => (
            <div key={type} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1">{label}</p>
              <p className={cn("text-xl font-bold", cls.split(" ")[1])}>
                {formatCurrency(totalsByType[type] ?? 0, "INR")}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AccountType | "")}
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="">All Types</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ").toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading accounts…
            </div>
          ) : rootAccounts.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No accounts found</p>
              <p className="text-sm mt-1">Create your first account to get started</p>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Account
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Code", "Name", "Type", "Balance", "Status"].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                          h === "Balance" && "text-right"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rootAccounts.map((acc) => (
                    <AccountRow key={acc.id} account={acc as unknown as Account} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            System accounts are automatically created and cannot be deleted. Account balances are
            updated atomically when journal entries are posted.
          </p>
        </div>
      </div>
    </>
  );
}
