// @ts-nocheck
'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, ChevronRight, Star, X, Check } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  self_review: 'bg-blue-100 text-blue-700',
  manager_review: 'bg-yellow-100 text-yellow-700',
  calibration: 'bg-purple-100 text-purple-700',
  shared: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
};

type Review = {
  id: string;
  status: string;
  self_rating: unknown;
  manager_rating: unknown;
  final_rating: unknown;
  rating_label: string | null;
  employee: { id: string; first_name: string; last_name: string; employee_code: string };
  reviewer: { id: string; first_name: string; last_name: string };
};

function AddReviewDialog({
  cycleId,
  onClose,
}: {
  cycleId: string;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const { data: employees = [] } = api.hr.employees.list.useQuery({ limit: 100 });
  const [form, setForm] = useState({ employee_id: '', reviewer_id: '' });

  const create = api.hr.hr_performance.createReview.useMutation({
    onSuccess: () => { void utils.hr.hr_performance.listReviews.invalidate({ cycle_id: cycleId }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Add Review</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form, review_cycle_id: cycleId, review_type: 'annual' }); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Employee *</label>
            <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
              <option value="">Select employee</option>
              {employees.items?.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Reviewer *</label>
            <select value={form.reviewer_id} onChange={(e) => setForm((f) => ({ ...f, reviewer_id: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
              <option value="">Select reviewer</option>
              {employees.items?.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={create.isPending} className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
              {create.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RatingStars({ rating }: { rating: unknown }) {
  const val = Number(rating ?? 0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${val >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{val > 0 ? val.toFixed(1) : '—'}</span>
    </div>
  );
}

export default function ReviewCyclePage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = use(params);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tab, setTab] = useState<'reviews' | 'calibration'>('reviews');
  const utils = api.useUtils();

  const { data: cycle } = api.hr.hr_performance.getCycle.useQuery({ id: cycleId });
  const { data: reviews = [], isLoading } = api.hr.hr_performance.listReviews.useQuery({ cycle_id: cycleId });
  const { data: calibData = [] } = api.hr.hr_performance.calibrationData.useQuery({ cycle_id: cycleId });

  const advance = api.hr.hr_performance.advanceCycleStatus.useMutation({
    onSuccess: () => void utils.hr.hr_performance.getCycle.invalidate({ id: cycleId }),
  });

  const completed = reviews.filter((r) => r.status === 'completed').length;

  const scatterData = calibData.map((r) => ({
    x: Number(r.manager_rating ?? 0),
    y: Number(r.final_rating ?? 0),
    name: `${r.employee.first_name} ${r.employee.last_name}`,
  }));

  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/hr/performance" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{cycle?.name ?? 'Loading...'}</h1>
          {cycle && (
            <p className="text-muted-foreground mt-0.5 capitalize">
              {cycle.status.replace('_', ' ')} · {completed}/{reviews.length} completed
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-1.5 border border-border hover:bg-muted px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Review
          </button>
          {cycle && cycle.status !== 'completed' && (
            <button
              onClick={() => advance.mutate({ cycle_id: cycleId })}
              disabled={advance.isPending}
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Advance Status
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {(['reviews', 'calibration'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t ? 'border-brand-500 text-brand-500' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'calibration' ? 'Calibration Chart' : 'Reviews'}
          </button>
        ))}
      </div>

      {tab === 'reviews' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}</div>
          ) : (reviews as Review[]).length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No reviews yet. Add employees to begin.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Reviewer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Self Rating</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Manager Rating</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Final</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(reviews as Review[]).map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{r.employee.first_name} {r.employee.last_name}</p>
                        <p className="text-xs text-muted-foreground">{r.employee.employee_code}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {r.reviewer.first_name} {r.reviewer.last_name}
                      </td>
                      <td className="px-5 py-3"><RatingStars rating={r.self_rating} /></td>
                      <td className="px-5 py-3"><RatingStars rating={r.manager_rating} /></td>
                      <td className="px-5 py-3">
                        {r.final_rating ? (
                          <div>
                            <RatingStars rating={r.final_rating} />
                            {r.rating_label && <p className="text-xs text-muted-foreground mt-0.5">{r.rating_label}</p>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[r.status] ?? '')}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'calibration' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Performance vs Potential (Calibration)</h2>
          {scatterData.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No final ratings to display yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="x" name="Manager Rating" domain={[0, 5]} label={{ value: 'Manager Rating', position: 'insideBottom', offset: -10 }} />
                <YAxis dataKey="y" name="Final Rating" domain={[0, 5]} label={{ value: 'Final Rating', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={({ payload }) => {
                  if (payload?.[0]) {
                    const d = payload[0].payload as { name: string; x: number; y: number };
                    return (
                      <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                        <p className="font-semibold">{d.name}</p>
                        <p>Manager: {d.x}</p>
                        <p>Final: {d.y}</p>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Scatter data={scatterData}>
                  {scatterData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {showAddDialog && <AddReviewDialog cycleId={cycleId} onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}
