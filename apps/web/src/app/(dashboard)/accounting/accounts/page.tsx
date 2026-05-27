"use client";

import { useState } from "react";
import { Plus, BookOpen, X } from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

const TYPE_COLORS: Record<AccountType, string> = {
  ASSET: "bg-cyan-500/10 text-cyan-600",
  LIABILITY: "bg-red-500/10 text-red-600",
  EQUITY: "bg-violet-500/10 text-violet-600",
  REVENUE: "bg-green-500/10 text-green-600",
  EXPENSE: "bg-amber-500/10 text-amber-600",
};

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

function AddAccountDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("ASSET");
  const [description, setDescription] = useState("");

  const mutation = api.accounting.chartOfAccounts.create.useMutation({
    onSuccess: () => {
      toast.success("Account created");
      void utils.accounting.chartOfAccounts.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
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
              <label className="block text-sm font-medium mb-1.5">Account Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Account Name</label>
            <input
              type="text"
              placeholder="e.g. Cash and Cash Equivalents"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
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
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate({ code, name, type, description: description || undefined })}
            disabled={mutation.isPending || !code.trim() || !name.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {mutation.isPending ? "Creating…" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChartOfAccountsPage() {
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: accounts, isLoading } = api.accounting.chartOfAccounts.list.useQuery({
    type: typeFilter || undefined,
  });

  const grouped = ACCOUNT_TYPES.reduce<Record<AccountType, typeof accounts>>((acc, t) => {
    acc[t] = accounts?.filter((a) => a.type === t) ?? [];
    return acc;
  }, {} as Record<AccountType, typeof accounts>);

  return (
    <>
      {showAdd && <AddAccountDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Chart of Accounts</h1>
            <p className="text-muted-foreground mt-1">Manage your accounting structure</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              typeFilter === "" ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                typeFilter === t ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accounts?.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No accounts yet</p>
            <p className="text-sm mt-1">Add your first account to build your chart of accounts</p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ACCOUNT_TYPES.filter((t) => !typeFilter || t === typeFilter).map((type) => {
              const typeAccounts = grouped[type] ?? [];
              if (typeAccounts.length === 0) return null;
              return (
                <div key={type} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-6 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                        TYPE_COLORS[type]
                      )}
                    >
                      {type}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({typeAccounts.length})
                    </span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {["Code", "Account Name", "Description", "Status"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {typeAccounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3 font-mono text-sm text-brand-500">{acc.code}</td>
                          <td className="px-6 py-3 font-medium text-sm">{acc.name}</td>
                          <td className="px-6 py-3 text-sm text-muted-foreground max-w-xs truncate">
                            {acc.description ?? "—"}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                acc.is_active
                                  ? "bg-green-500/10 text-green-600"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {acc.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
