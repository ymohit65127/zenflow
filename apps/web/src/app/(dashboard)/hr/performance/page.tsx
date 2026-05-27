'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Target, Plus, ChevronRight, X, Check } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';

const CYCLE_STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-gray-100 text-gray-600',
  self_review: 'bg-blue-100 text-blue-700',
  manager_review: 'bg-yellow-100 text-yellow-700',
  calibration: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
};

type Cycle = {
  id: string;
  name: string;
  review_type: string;
  self_review_start: Date;
  self_review_end: Date;
  manager_review_start: Date;
  manager_review_end: Date;
  status: string;
  _count: { reviews: number };
};

function NewCycleDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const now = new Date();
  const [form, setForm] = useState({
    name: '',
    review_type: 'annual' as const,
    self_review_start: '',
    self_review_end: '',
    manager_review_start: '',
    manager_review_end: '',
    calibration_date: '',
  });

  const create = api.hr.hr_performance.createCycle.useMutation({
    onSuccess: () => { void utils.hr.hr_performance.listCycles.invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">New Review Cycle</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Cycle Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Annual Review 2026" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Review Type</label>
            <select value={form.review_type} onChange={(e) => setForm((f) => ({ ...f, review_type: e.target.value as typeof f.review_type }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
              {['annual', 'semi_annual', 'quarterly', 'probation', 'three_sixty'].map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Self Review Start *</label>
              <input type="date" value={form.self_review_start} onChange={(e) => setForm((f) => ({ ...f, self_review_start: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Self Review End *</label>
              <input type="date" value={form.self_review_end} onChange={(e) => setForm((f) => ({ ...f, self_review_end: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Manager Review Start *</label>
              <input type="date" value={form.manager_review_start} onChange={(e) => setForm((f) => ({ ...f, manager_review_start: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Manager Review End *</label>
              <input type="date" value={form.manager_review_end} onChange={(e) => setForm((f) => ({ ...f, manager_review_end: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Calibration Date</label>
            <input type="date" value={form.calibration_date} onChange={(e) => setForm((f) => ({ ...f, calibration_date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={create.isPending} className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
              {create.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Create Cycle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [showDialog, setShowDialog] = useState(false);
  const { data: cycles = [], isLoading } = api.hr.hr_performance.listCycles.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Reviews</h1>
          <p className="text-muted-foreground mt-1">{cycles.length} review cycles</p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Cycle
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-20">
          <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">No review cycles yet</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {cycles.map((cycle) => (
            <Link
              key={cycle.id}
              href={`/hr/performance/${cycle.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{cycle.name}</h3>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', CYCLE_STATUS_COLORS[cycle.status] ?? '')}>
                    {cycle.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                  {cycle.review_type.replace('_', ' ')} · Self Review: {formatDate(cycle.self_review_start)} – {formatDate(cycle.self_review_end)} · {cycle._count.reviews} reviews
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {showDialog && <NewCycleDialog onClose={() => setShowDialog(false)} />}
    </div>
  );
}
