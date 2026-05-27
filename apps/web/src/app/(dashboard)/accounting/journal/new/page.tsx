"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

interface JournalLine {
  id: string;
  account_id: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
}

function newLine(): JournalLine {
  return {
    id: Math.random().toString(36).slice(2),
    account_id: "",
    description: "",
    debit_amount: "",
    credit_amount: "",
  };
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([newLine(), newLine()]);
  const [postOnSave, setPostOnSave] = useState(false);

  const { data: accounts } = api.accounting.coa.list.useQuery({});

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;
  const diff = totalDebit - totalCredit;

  const utils = api.useUtils();

  const createMutation = api.accounting.journal.create.useMutation({
    onSuccess: async (entry) => {
      if (postOnSave) {
        try {
          await postMutation.mutateAsync({ id: entry.id });
        } catch {
          // post error already toasted
        }
      } else {
        toast.success("Journal entry saved as draft");
        void utils.accounting.journal.list.invalidate();
        router.push("/accounting/journal");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const postMutation = api.accounting.journal.post.useMutation({
    onSuccess: () => {
      toast.success("Journal entry posted");
      void utils.accounting.journal.list.invalidate();
      router.push("/accounting/journal");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLine = (id: string, field: keyof JournalLine, value: string) => {
    setLines((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // Ensure only one of debit/credit is set
        if (field === "debit_amount" && value) updated.credit_amount = "";
        if (field === "credit_amount" && value) updated.debit_amount = "";
        return updated;
      })
    );
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      toast.error("Minimum 2 lines required");
      return;
    }
    setLines((ls) => ls.filter((l) => l.id !== id));
  };

  const handleSave = (shouldPost: boolean) => {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    const validLines = lines.filter(
      (l) => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0)
    );
    if (validLines.length < 2) {
      toast.error("At least 2 lines with amounts required");
      return;
    }
    setPostOnSave(shouldPost);
    createMutation.mutate({
      entry_date: entryDate,
      description,
      reference: reference || undefined,
      lines: validLines.map((l) => ({
        account_id: l.account_id,
        description: l.description || undefined,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
      })),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link
          href="/accounting/journal"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Journal Entry</h1>
          <p className="text-muted-foreground mt-0.5">Manual double-entry bookkeeping</p>
        </div>
      </div>

      {/* Header fields */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Entry Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              type="text"
              placeholder="e.g. Monthly rent payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Reference <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. RENT-2026-05"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Entry Lines</h2>
          <button
            onClick={() => setLines((ls) => [...ls, newLine()])}
            className="flex items-center gap-1.5 text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Account", "Description", "Debit", "Credit", ""].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                      (h === "Debit" || h === "Credit") && "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => (
                <tr key={line.id} className="group">
                  <td className="px-4 py-2 min-w-[200px]">
                    <select
                      value={line.account_id}
                      onChange={(e) => updateLine(line.id, "account_id", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    >
                      <option value="">Select account…</option>
                      {accounts?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 min-w-[180px]">
                    <input
                      type="text"
                      placeholder="Line description"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, "description", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </td>
                  <td className="px-4 py-2 min-w-[120px]">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={line.debit_amount}
                      onChange={(e) => updateLine(line.id, "debit_amount", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                    />
                  </td>
                  <td className="px-4 py-2 min-w-[120px]">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={line.credit_amount}
                      onChange={(e) => updateLine(line.id, "credit_amount", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-right"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeLine(line.id)}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="px-4 py-3 font-semibold text-sm" colSpan={2}>
                  Totals
                </td>
                <td className="px-4 py-3 text-right font-semibold text-sm tabular-nums">
                  {formatCurrency(totalDebit, "INR")}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-sm tabular-nums">
                  {formatCurrency(totalCredit, "INR")}
                </td>
                <td className="px-4 py-3">
                  {isBalanced ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!isBalanced && totalDebit > 0 && (
          <div className="px-6 py-3 bg-red-500/5 border-t border-red-500/20 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Entry is not balanced. Difference:{" "}
            <strong>{formatCurrency(Math.abs(diff), "INR")}</strong>{" "}
            {diff > 0 ? "(more debits)" : "(more credits)"}
          </div>
        )}
        {isBalanced && (
          <div className="px-6 py-3 bg-green-500/5 border-t border-green-500/20 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Entry is balanced — debits equal credits
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/accounting/journal"
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={() => handleSave(false)}
          disabled={createMutation.isPending || postMutation.isPending}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          Save as Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={!isBalanced || createMutation.isPending || postMutation.isPending}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          {createMutation.isPending || postMutation.isPending ? "Saving…" : "Save & Post"}
        </button>
      </div>
    </div>
  );
}
