'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Loader2, Trash2, Pencil, ShieldAlert, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { RiskMatrix } from '@/components/projects/RiskMatrix';
import { cn } from '@/lib/utils';

const RISK_STATUS_COLORS: Record<string, string> = {
  identified: 'bg-blue-500/10 text-blue-600',
  monitoring: 'bg-amber-500/10 text-amber-600',
  mitigated: 'bg-green-500/10 text-green-600',
  accepted: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
};

const RISK_CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  resource: 'Resource',
  external: 'External',
  schedule: 'Schedule',
  budget: 'Budget',
  other: 'Other',
};

function getRiskScoreColor(score: number): string {
  if (score >= 9) return 'bg-red-500 text-white';
  if (score >= 6) return 'bg-orange-500 text-white';
  if (score >= 4) return 'bg-amber-500 text-white';
  return 'bg-green-500 text-white';
}

export default function RisksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = api.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'other' as 'technical' | 'resource' | 'external' | 'schedule' | 'budget' | 'other',
    probability: 'medium' as 'low' | 'medium' | 'high',
    impact: 'medium' as 'low' | 'medium' | 'high',
    status: 'identified' as 'identified' | 'mitigated' | 'accepted' | 'closed',
    mitigationPlan: '',
    contingencyPlan: '',
  });

  const { data: risks, isLoading } = api.projects.risks.list.useQuery({ projectId: id });
  const { data: orgUsers } = api.projects.getOrgUsers.useQuery();

  const create = api.projects.risks.create.useMutation({
    onSuccess: () => {
      void utils.projects.risks.list.invalidate({ projectId: id });
      toast.success('Risk added');
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const update = api.projects.risks.update.useMutation({
    onSuccess: () => {
      void utils.projects.risks.list.invalidate({ projectId: id });
      toast.success('Risk updated');
      setEditId(null);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const del = api.projects.risks.delete.useMutation({
    onSuccess: () => {
      void utils.projects.risks.list.invalidate({ projectId: id });
      toast.success('Risk deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ title: '', description: '', category: 'other', probability: 'medium', impact: 'medium', status: 'identified', mitigationPlan: '', contingencyPlan: '' } as typeof form);
  }

  function startEdit(risk: NonNullable<typeof risks>[0]) {
    const safeStatus = (['identified', 'mitigated', 'accepted', 'closed'] as const).includes(risk.status as 'identified' | 'mitigated' | 'accepted' | 'closed')
      ? risk.status as typeof form.status
      : 'identified' as typeof form.status;
    setForm({
      title: risk.title,
      description: risk.description ?? '',
      category: (risk.category as typeof form.category) ?? 'other',
      probability: risk.probability as typeof form.probability,
      impact: risk.impact as typeof form.impact,
      status: safeStatus,
      mitigationPlan: risk.mitigation_plan ?? '',
      contingencyPlan: '',
    });
    setEditId(risk.id);
    setShowForm(true);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      projectId: id,
      title: form.title,
      description: form.description || undefined,
      category: form.category,
      probability: form.probability,
      impact: form.impact,
      status: form.status,
      mitigationPlan: form.mitigationPlan || undefined,
      contingencyPlan: form.contingencyPlan || undefined,
    };
    if (editId) {
      update.mutate({ id: editId, ...payload });
    } else {
      create.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const highRisks = risks?.filter((r) => r.risk_score >= 6) ?? [];
  const openRisks = risks?.filter((r) => !['accepted', 'closed'].includes(r.status)) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/projects/${id}`)} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Risk Register</h1>
            <p className="text-sm text-muted-foreground">{risks?.length ?? 0} risks · {openRisks.length} open</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setEditId(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Risk
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{risks?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Risks</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-red-500">{highRisks.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">High Priority</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-500">{openRisks.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Open</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Matrix */}
        {risks && risks.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <RiskMatrix
              risks={risks.map((r) => ({
                id: r.id,
                title: r.title,
                probability: r.probability as 'low' | 'medium' | 'high',
                impact: r.impact as 'low' | 'medium' | 'high',
                risk_score: r.risk_score,
                status: r.status,
              }))}
            />
          </div>
        )}

        {/* Risk table */}
        <div className={cn('lg:col-span-2', risks?.length === 0 && 'lg:col-span-3')}>
          {/* Add/Edit form */}
          {showForm && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{editId ? 'Edit Risk' : 'Add Risk'}</h3>
                <button onClick={() => { setShowForm(false); setEditId(null); }} className="p-1 hover:bg-muted rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Title *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Risk title..."
                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
                      className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                      {Object.entries(RISK_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Probability</label>
                    <select value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value as typeof form.probability })}
                      className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Impact</label>
                    <select value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value as typeof form.impact })}
                      className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Mitigation Plan</label>
                  <textarea value={form.mitigationPlan} onChange={(e) => setForm({ ...form, mitigationPlan: e.target.value })}
                    rows={2} placeholder="How will you mitigate this risk?"
                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" />
                </div>
                {editId && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                      className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                      <option value="identified">Identified</option>
                      <option value="mitigated">Mitigated</option>
                      <option value="accepted">Accepted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="submit" disabled={create.isPending || update.isPending}
                    className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                    {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editId ? 'Update' : 'Add Risk'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {risks && risks.length > 0 ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {risks.map((risk, i) => (
                    <tr key={risk.id} className={cn('border-b border-border hover:bg-muted/30 transition-colors', i === risks.length - 1 && 'border-b-0')}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{risk.title}</p>
                        {risk.mitigation_plan && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{risk.mitigation_plan}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{RISK_CATEGORY_LABELS[risk.category] ?? risk.category}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold', getRiskScoreColor(risk.risk_score))}>
                          {risk.risk_score}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', RISK_STATUS_COLORS[risk.status] ?? 'bg-muted text-muted-foreground')}>
                          {risk.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(risk)} className="p-1 text-muted-foreground hover:text-brand-500 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => del.mutate({ id: risk.id })} className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !showForm && (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
              <ShieldAlert className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No risks identified yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add risks to track and manage project risks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
