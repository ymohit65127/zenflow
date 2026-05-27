// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DollarSign, Plus, Play, Check, X, Calendar } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function NewPeriodDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const now = new Date();
  const [form, setForm] = useState({
    name: `Payroll ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    start_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    payment_date: new Date(now.getFullYear(), now.getMonth() + 1, 5).toISOString().split('T')[0],
    period_type: 'monthly' as const,
  });

  const create = api.hr.hr_payroll.createPeriod.useMutation({
    onSuccess: () => { void utils.hr.hr_payroll.listPeriods.invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">New Payroll Period</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Period Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Month</label>
              <select value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End Date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Payment Date</label>
            <input type="date" value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={create.isPending} className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
              {create.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Create Period
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const [showDialog, setShowDialog] = useState(false);
  const utils = api.useUtils();
  const { data: periods = [], isLoading } = api.hr.hr_payroll.listPeriods.useQuery();
  const process = api.hr.hr_payroll.processPayroll.useMutation({
    onSuccess: () => void utils.hr.hr_payroll.listPeriods.invalidate(),
  });
  const approve = api.hr.hr_payroll.approvePeriod.useMutation({
    onSuccess: () => void utils.hr.hr_payroll.listPeriods.invalidate(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll Periods</h1>
          <p className="text-muted-foreground mt-1">{periods.length} periods</p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Period
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : periods.length === 0 ? (
        <div className="text-center py-20">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">No payroll periods yet</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {periods.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[p.status] ?? '')}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatDate(p.start_date)} – {formatDate(p.end_date)} · Payment: {formatDate(p.payment_date)}
                  {p.employee_count != null && ` · ${p.employee_count} employees`}
                  {p.total_net != null && ` · Net: ₹${Number(p.total_net).toLocaleString('en-IN')}`}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {p.status === 'draft' && (
                  <button
                    onClick={() => { if (confirm('Run payroll computation?')) process.mutate({ period_id: p.id }); }}
                    disabled={process.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                    <Play className="w-3 h-3" /> Run
                  </button>
                )}
                {p.status === 'processing' && (
                  <button
                    onClick={() => approve.mutate({ period_id: p.id })}
                    disabled={approve.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                )}
                <Link
                  href={`/hr/payroll/${p.id}`}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDialog && <NewPeriodDialog onClose={() => setShowDialog(false)} />}
    </div>
  );
}
