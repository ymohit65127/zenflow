"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Landmark, X, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

function AddBankAccountDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountType, setAccountType] = useState("current");
  const [openingBalance, setOpeningBalance] = useState("0");

  const { data: accounts } = api.accounting.coa.list.useQuery({});
  const [glAccountId, setGlAccountId] = useState("");

  const mutation = api.accounting.bank.createAccount.useMutation({
    onSuccess: () => {
      toast.success("Bank account added");
      void utils.accounting.bank.listAccounts.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Add Bank Account</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Account Name</label>
            <input
              type="text"
              placeholder="e.g. HDFC Current Account"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {["savings", "current", "overdraft", "fixed_deposit", "credit_card"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Account Number</label>
              <input
                type="text"
                placeholder="XXXX XXXX XXXX"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">IFSC Code</label>
              <input
                type="text"
                placeholder="HDFC0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Opening Balance (INR)</label>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">GL Account (optional)</label>
              <select
                value={glAccountId}
                onChange={(e) => setGlAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">None</option>
                {accounts?.filter((a) => a.account_type === "asset").map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={() =>
              mutation.mutate({
                name,
                account_number: accountNumber || undefined,
                bank_name: bankName || undefined,
                ifsc_code: ifscCode || undefined,
                account_type: accountType as "current",
                opening_balance: parseFloat(openingBalance) || 0,
                gl_account_id: glAccountId || undefined,
              })
            }
            disabled={mutation.isPending || !name.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {mutation.isPending ? "Adding…" : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BankAccountsPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: accounts, isLoading } = api.accounting.bank.listAccounts.useQuery({});

  const totalBalance = accounts?.reduce((s, a) => s + Number(a.current_balance), 0) ?? 0;

  return (
    <>
      {showAdd && <AddBankAccountDialog onClose={() => setShowAdd(false)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bank Accounts</h1>
            <p className="text-muted-foreground mt-1">Manage bank accounts and transactions</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {/* Total balance */}
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl p-6 text-white">
          <p className="text-sm text-white/70 mb-1">Total Bank Balance</p>
          <p className="text-4xl font-bold">{formatCurrency(totalBalance, "INR")}</p>
          <p className="text-sm text-white/70 mt-2">{accounts?.length ?? 0} accounts</p>
        </div>

        {/* Account cards */}
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading accounts…
          </div>
        ) : accounts?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-2xl">
            <Landmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No bank accounts yet</p>
            <p className="text-sm mt-1">Add your first bank account</p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts?.map((account) => (
              <div key={account.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-brand-500" />
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      account.is_active
                        ? "bg-green-500/10 text-green-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {account.account_type.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>

                <h3 className="font-semibold">{account.name}</h3>
                {account.bank_name && (
                  <p className="text-sm text-muted-foreground mt-0.5">{account.bank_name}</p>
                )}
                {account.account_number && (
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    •••• {account.account_number.slice(-4)}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-2xl font-bold mt-0.5">
                    {formatCurrency(Number(account.current_balance), account.currency)}
                  </p>
                  {account.last_reconciled_date && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Last reconciled: {formatDate(account.last_reconciled_date)}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/accounting/reconciliation?account_id=${account.id}`}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-brand-500/10 text-brand-500 rounded-lg hover:bg-brand-500/20 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reconcile
                  </Link>
                  <div className="flex gap-1 text-xs">
                    <span className="flex items-center gap-0.5 text-green-500 bg-green-500/10 px-2 py-1.5 rounded-lg">
                      <TrendingUp className="w-3 h-3" />
                      {account._count.transactions}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
