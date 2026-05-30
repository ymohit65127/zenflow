"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, CheckCircle2, X, ArrowRight, Landmark, AlertCircle } from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

function ReconciliationContent() {
  const searchParams = useSearchParams();
  const preselectedAccountId = searchParams.get("account_id") ?? "";

  const [selectedAccountId, setSelectedAccountId] = useState(preselectedAccountId);
  const [selectedBankTxId, setSelectedBankTxId] = useState<string | null>(null);
  const [selectedJeLineId, setSelectedJeLineId] = useState<string | null>(null);

  const { data: bankAccounts } = api.accounting.bank.listAccounts.useQuery({});

  const { data: summary } = api.accounting.reconciliation.getSummary.useQuery(
    { bank_account_id: selectedAccountId },
    { enabled: !!selectedAccountId }
  );

  const { data: unmatched, refetch: refetchUnmatched } = api.accounting.reconciliation.getUnmatched.useQuery(
    { bank_account_id: selectedAccountId },
    { enabled: !!selectedAccountId }
  );

  const utils = api.useUtils();

  const matchMutation = api.accounting.reconciliation.match.useMutation({
    onSuccess: () => {
      toast.success("Matched successfully");
      setSelectedBankTxId(null);
      setSelectedJeLineId(null);
      void refetchUnmatched();
      void utils.accounting.reconciliation.getSummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const ignoreMutation = api.accounting.reconciliation.ignore.useMutation({
    onSuccess: () => {
      toast.success("Transaction ignored");
      void refetchUnmatched();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleMatch = () => {
    if (!selectedBankTxId || !selectedJeLineId) {
      toast.error("Select one bank transaction and one journal line to match");
      return;
    }
    matchMutation.mutate({
      bank_transaction_id: selectedBankTxId,
      journal_entry_line_id: selectedJeLineId,
    });
  };

  const canMatch = selectedBankTxId && selectedJeLineId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
          <p className="text-muted-foreground mt-1">Match bank transactions to journal entries</p>
        </div>
      </div>

      {/* Account selector */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="block text-sm font-medium mb-2">Select Bank Account</label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">Choose an account…</option>
          {bankAccounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {formatCurrency(Number(a.current_balance), a.currency)}
            </option>
          ))}
        </select>
      </div>

      {selectedAccountId && summary && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">{summary.total_transactions}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Transactions</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-amber-500">{summary.unmatched_count}</p>
              <p className="text-sm text-muted-foreground mt-1">Unmatched</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-500">{summary.matched_count}</p>
              <p className="text-sm text-muted-foreground mt-1">Matched</p>
            </div>
          </div>

          {/* Match action bar */}
          {(selectedBankTxId || selectedJeLineId) && (
            <div className="flex items-center gap-4 p-4 bg-brand-500/5 border border-brand-500/20 rounded-xl">
              <div className="flex-1 text-sm">
                <span className="font-medium">
                  {selectedBankTxId ? "1 bank transaction" : "No bank tx"} selected
                </span>
                <span className="text-muted-foreground mx-2">+</span>
                <span className="font-medium">
                  {selectedJeLineId ? "1 journal line" : "No journal line"} selected
                </span>
              </div>
              <button
                onClick={handleMatch}
                disabled={!canMatch || matchMutation.isPending}
                className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                {matchMutation.isPending ? "Matching…" : "Match"}
              </button>
              <button
                onClick={() => { setSelectedBankTxId(null); setSelectedJeLineId(null); }}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank transactions */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-brand-500" />
                  Bank Transactions
                  <span className="ml-auto text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                    {unmatched?.bank_transactions.length ?? 0} unmatched
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {unmatched?.bank_transactions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
                    <p className="text-sm">All transactions matched</p>
                  </div>
                ) : (
                  unmatched?.bank_transactions.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() =>
                        setSelectedBankTxId((prev) => (prev === tx.id ? null : tx.id))
                      }
                      className={cn(
                        "w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors",
                        selectedBankTxId === tx.id && "bg-brand-500/5 border-l-2 border-brand-500"
                      )}
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          tx.type === "credit" ? "bg-green-500" : "bg-red-500"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description ?? tx.reference ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            tx.type === "credit" ? "text-green-500" : "text-red-500"
                          )}
                        >
                          {tx.type === "credit" ? "+" : "-"}
                          {formatCurrency(Number(tx.amount), "INR")}
                        </p>
                      </div>
                      {selectedBankTxId === tx.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); ignoreMutation.mutate({ bank_transaction_id: tx.id }); }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Ignore
                        </button>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Journal lines */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-brand-500" />
                  Unreconciled Journal Lines
                  <span className="ml-auto text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                    {unmatched?.journal_lines.length ?? 0} lines
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {unmatched?.journal_lines.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
                    <p className="text-sm">No unreconciled lines</p>
                  </div>
                ) : (
                  unmatched?.journal_lines.map((jel) => (
                    <button
                      key={jel.id}
                      onClick={() =>
                        setSelectedJeLineId((prev) => (prev === jel.id ? null : jel.id))
                      }
                      className={cn(
                        "w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors",
                        selectedJeLineId === jel.id && "bg-brand-500/5 border-l-2 border-brand-500"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {jel.journal_entry.entry_number}
                          {jel.description && ` — ${jel.description}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(jel.journal_entry.entry_date)} · {jel.account?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        {Number(jel.debit_amount) > 0 && (
                          <p className="text-sm font-semibold tabular-nums text-green-500">
                            DR {formatCurrency(Number(jel.debit_amount), "INR")}
                          </p>
                        )}
                        {Number(jel.credit_amount) > 0 && (
                          <p className="text-sm font-semibold tabular-nums text-red-500">
                            CR {formatCurrency(Number(jel.credit_amount), "INR")}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Select one item from each column then click <strong>Match</strong> to reconcile. The
              bank transaction and journal line will both be marked as reconciled.
            </p>
          </div>
        </>
      )}

      {!selectedAccountId && (
        <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-2xl">
          <Landmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Select a bank account to start reconciling</p>
        </div>
      )}
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-foreground">Loading…</div>}>
      <ReconciliationContent />
    </Suspense>
  );
}
