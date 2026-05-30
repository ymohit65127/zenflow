'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Loader2, Trash2, DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  labor: '#6366f1',
  materials: '#06b6d4',
  tools: '#f59e0b',
  travel: '#22c55e',
  other: '#8b5cf6',
};

const CATEGORY_LABELS: Record<string, string> = {
  labor: 'Labor',
  materials: 'Materials',
  tools: 'Tools',
  travel: 'Travel',
  other: 'Other',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = api.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: 'other' as 'labor' | 'materials' | 'travel' | 'tools' | 'other',
    description: '',
    budgetedAmount: '',
    actualAmount: '',
    entryDate: new Date().toISOString().split('T')[0],
  });

  const { data, isLoading } = api.projects.budget.list.useQuery({ projectId: id });
  const { data: categoryTotals } = api.projects.budget.getCategoryTotals.useQuery({ projectId: id });

  const create = api.projects.budget.create.useMutation({
    onSuccess: () => {
      void utils.projects.budget.list.invalidate({ projectId: id });
      void utils.projects.budget.getCategoryTotals.invalidate({ projectId: id });
      toast.success('Budget entry added');
      setShowForm(false);
      setForm({ category: 'other', description: '', budgetedAmount: '', actualAmount: '', entryDate: new Date().toISOString().split('T')[0] } as typeof form);
    },
    onError: (err) => toast.error(err.message),
  });

  const del = api.projects.budget.delete.useMutation({
    onSuccess: () => {
      void utils.projects.budget.list.invalidate({ projectId: id });
      void utils.projects.budget.getCategoryTotals.invalidate({ projectId: id });
      toast.success('Entry deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      projectId: id,
      category: form.category,
      description: form.description,
      budgetedAmount: parseFloat(form.budgetedAmount),
      actualAmount: parseFloat(form.actualAmount) || 0,
      entryDate: new Date(form.entryDate ?? new Date()),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totals = data?.totals;
  const utilizationPct = totals?.utilizationPct ?? 0;
  const isOverBudget = utilizationPct > 100;
  const isAtRisk = utilizationPct > 80 && !isOverBudget;

  const pieData = (categoryTotals ?? []).map((c) => ({
    name: CATEGORY_LABELS[c.category] ?? c.category,
    value: c.actual,
    color: CATEGORY_COLORS[c.category] ?? '#6B7280',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/projects/${id}`)} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Budget Tracker</h1>
            <p className="text-sm text-muted-foreground">{data?.entries.length ?? 0} entries</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-muted-foreground">Total Budget</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals?.totalBudgeted ?? 0)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Actual Spend</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals?.totalActual ?? 0)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            {isOverBudget ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
            <span className="text-xs text-muted-foreground">Variance</span>
          </div>
          <p className={cn('text-xl font-bold', isOverBudget ? 'text-red-500' : 'text-green-600')}>
            {formatCurrency(totals?.variance ?? 0)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={cn('w-4 h-4', isOverBudget ? 'text-red-500' : isAtRisk ? 'text-amber-500' : 'text-green-500')} />
            <span className="text-xs text-muted-foreground">Utilization</span>
          </div>
          <p className={cn('text-xl font-bold', isOverBudget ? 'text-red-500' : isAtRisk ? 'text-amber-500' : 'text-foreground')}>
            {utilizationPct}%
          </p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', isOverBudget ? 'bg-red-500' : isAtRisk ? 'bg-amber-500' : 'bg-green-500')}
              style={{ width: `${Math.min(utilizationPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-4">Spend by Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category breakdown */}
        {categoryTotals && categoryTotals.length > 0 && (
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {categoryTotals.map((cat) => {
                const utilPct = cat.budgeted > 0 ? Math.min(Math.round((cat.actual / cat.budgeted) * 100), 100) : 0;
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat.category] }} />
                        <span className="font-medium">{CATEGORY_LABELS[cat.category] ?? cat.category}</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>{formatCurrency(cat.actual)} / {formatCurrency(cat.budgeted)}</span>
                        <span className="font-medium text-foreground">{utilPct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${utilPct}%`, backgroundColor: CATEGORY_COLORS[cat.category] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add entry form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">Add Budget Entry</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                >
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Date</label>
                <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description *</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Frontend development - Week 1"
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Budgeted Amount ($) *</label>
                <input type="number" min="0" step="0.01" value={form.budgetedAmount}
                  onChange={(e) => setForm({ ...form, budgetedAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Actual Amount ($)</label>
                <input type="number" min="0" step="0.01" value={form.actualAmount}
                  onChange={(e) => setForm({ ...form, actualAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={create.isPending}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Entry
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entries table */}
      {data && data.entries.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Budgeted</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actual</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Variance</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry, i) => {
                const amount = Number(entry.amount);
                return (
                  <tr key={entry.id} className={cn('border-b border-border hover:bg-muted/30 transition-colors', i === data.entries.length - 1 && 'border-b-0')}>
                    <td className="px-4 py-3 font-medium">{entry.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[entry.category] }} />
                        <span className="text-xs">{CATEGORY_LABELS[entry.category] ?? entry.category}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(entry.entry_date)}</td>
                    <td className="px-4 py-3 text-right">{entry.is_expense ? '—' : formatCurrency(amount)}</td>
                    <td className="px-4 py-3 text-right">{entry.is_expense ? formatCurrency(amount) : '—'}</td>
                    <td className={cn('px-4 py-3 text-right font-medium', entry.is_expense ? 'text-red-500' : 'text-green-600')}>
                      {entry.is_expense ? formatCurrency(-amount) : formatCurrency(amount)}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => del.mutate({ id: entry.id })}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !showForm && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
          <DollarSign className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No budget entries yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add budget entries to track planned vs actual costs</p>
        </div>
      )}
    </div>
  );
}
