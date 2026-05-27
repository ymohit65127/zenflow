// @ts-nocheck
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Loader2, Trash2, CheckCircle2, Circle, AlertTriangle, Flag, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<string, { icon: React.ElementType; className: string; label: string }> = {
  pending: { icon: Circle, className: 'text-amber-500', label: 'Pending' },
  achieved: { icon: CheckCircle2, className: 'text-green-500', label: 'Achieved' },
  missed: { icon: AlertTriangle, className: 'text-red-500', label: 'Missed' },
};

const COLOR_OPTIONS = [
  '#F59E0B', '#6366f1', '#22c55e', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899',
];

export default function MilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = api.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    dueDate: '',
    description: '',
    color: '#F59E0B',
    notifyOnDue: true,
  });

  const { data: milestones, isLoading } = api.projects.milestones.list.useQuery({ projectId: id });
  const { data: phases } = api.projects.phases.list.useQuery({ projectId: id });

  const create = api.projects.milestones.create.useMutation({
    onSuccess: () => {
      void utils.projects.milestones.list.invalidate({ projectId: id });
      toast.success('Milestone created');
      setShowForm(false);
      setForm({ name: '', dueDate: '', description: '', color: '#F59E0B', notifyOnDue: true });
    },
    onError: (err) => toast.error(err.message),
  });

  const achieve = api.projects.milestones.achieve.useMutation({
    onSuccess: () => {
      void utils.projects.milestones.list.invalidate({ projectId: id });
      toast.success('Milestone achieved!');
    },
    onError: (err) => toast.error(err.message),
  });

  const del = api.projects.milestones.delete.useMutation({
    onSuccess: () => {
      void utils.projects.milestones.list.invalidate({ projectId: id });
      toast.success('Milestone deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dueDate) { toast.error('Select a due date'); return; }
    create.mutate({
      projectId: id,
      name: form.name,
      dueDate: new Date(form.dueDate),
      description: form.description || undefined,
      color: form.color,
      notifyOnDue: form.notifyOnDue,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const today = new Date();
  const achieved = milestones?.filter((m) => m.status === 'achieved') ?? [];
  const pending = milestones?.filter((m) => m.status === 'pending') ?? [];
  const overdue = pending.filter((m) => new Date(m.due_date) < today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/projects/${id}`)} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Milestones</h1>
            <p className="text-sm text-muted-foreground">
              {milestones?.length ?? 0} total · {achieved.length} achieved
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Milestone
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-green-500">{achieved.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Achieved</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-500">{pending.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-red-500">{overdue.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Overdue</p>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New Milestone</h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Beta Release"
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Due Date *</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Color</label>
                <div className="flex gap-2 mt-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={cn('w-6 h-6 rounded-full border-2 transition-all', form.color === c ? 'border-foreground scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder="Milestone description..."
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={create.isPending}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Milestone
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Milestone list */}
      {milestones && milestones.length > 0 ? (
        <div className="space-y-3">
          {milestones.map((milestone) => {
            const dueDate = new Date(milestone.due_date);
            const isPast = dueDate < today;
            const isOverdue = isPast && milestone.status === 'pending';
            const statusInfo = STATUS_STYLES[milestone.status] ?? STATUS_STYLES.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={milestone.id}
                className={cn(
                  'bg-card border border-border rounded-2xl p-4 flex items-start gap-4',
                  isOverdue && 'border-red-500/30 bg-red-500/5',
                  milestone.status === 'achieved' && 'border-green-500/20 bg-green-500/5'
                )}
              >
                {/* Color indicator + diamond */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                  <div
                    className="w-4 h-4 rotate-45"
                    style={{ backgroundColor: milestone.color }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{milestone.name}</span>
                    <div className={cn('flex items-center gap-1 text-xs', statusInfo.className)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </div>
                    {isOverdue && (
                      <span className="text-xs text-red-500 font-medium">Overdue</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Due: {formatDate(dueDate)}</span>
                    {milestone.achieved_at && (
                      <span className="text-green-600">Achieved: {formatDate(milestone.achieved_at)}</span>
                    )}
                    {milestone.phase && (
                      <span>Phase: {(milestone.phase as { name: string }).name}</span>
                    )}
                    <span>{(milestone._count as { tasks: number }).tasks} tasks</span>
                  </div>

                  {milestone.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{milestone.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {milestone.status === 'pending' && (
                    <button
                      onClick={() => achieve.mutate({ id: milestone.id })}
                      disabled={achieve.isPending}
                      className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {achieve.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Achieve
                    </button>
                  )}
                  <button
                    onClick={() => del.mutate({ id: milestone.id })}
                    className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !showForm && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
          <Flag className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No milestones yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add milestones to track key project deliverables</p>
        </div>
      )}
    </div>
  );
}
