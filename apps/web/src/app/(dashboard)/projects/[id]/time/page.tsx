'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Clock, DollarSign, Loader2, Trash2, Play, Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

function formatDuration(minutes: number | null): string {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TimeLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = api.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    taskId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    description: '',
    isBillable: false,
  });

  const { data: agg, isLoading } = api.projects.timeLogs.getAggregations.useQuery({
    projectId: id,
    groupBy: 'user',
  });

  const { data: tasks } = api.projects.tasks.list.useQuery({
    projectId: id,
  });

  const { data: _runningTimerRaw } = api.projects.timeLogs.getRunning.useQuery({});
  const runningTimer = _runningTimerRaw as unknown as { id: string; start_time?: Date | string; task?: { title: string } } | null;

  const createLog = api.projects.timeLogs.create.useMutation({
    onSuccess: () => {
      void utils.projects.timeLogs.getAggregations.invalidate({ projectId: id });
      toast.success('Time logged');
      setShowForm(false);
      setForm({ taskId: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', description: '', isBillable: false });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteLog = api.projects.timeLogs.delete.useMutation({
    onSuccess: () => {
      void utils.projects.timeLogs.getAggregations.invalidate({ projectId: id });
      toast.success('Time entry deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const stopTimer = api.projects.timeLogs.stop.useMutation({
    onSuccess: () => {
      void utils.projects.timeLogs.getRunning.invalidate();
      void utils.projects.timeLogs.getAggregations.invalidate({ projectId: id });
      toast.success('Timer stopped');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.taskId) { toast.error('Select a task'); return; }
    const startTime = new Date(`${form.date}T${form.startTime}:00`);
    const endTime = new Date(`${form.date}T${form.endTime}:00`);
    if (endTime <= startTime) { toast.error('End time must be after start time'); return; }
    createLog.mutate({ taskId: form.taskId, startTime, endTime, description: form.description || undefined, isBillable: form.isBillable });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/projects/${id}`)} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Time Tracking</h1>
            <p className="text-sm text-muted-foreground">{agg?.entryCount ?? 0} entries</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Log Time
        </button>
      </div>

      {/* Running timer banner */}
      {runningTimer && (
        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Timer running: {runningTimer?.task?.title ?? ''}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                Started {formatDateTime(runningTimer?.start_time ?? new Date())}
              </p>
            </div>
          </div>
          <button
            onClick={() => stopTimer.mutate({ timeLogId: runningTimer.id })}
            className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            {stopTimer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            Stop
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-muted-foreground">Total Hours</span>
          </div>
          <p className="text-2xl font-bold">{(agg?.totalHours ?? 0).toFixed(1)}h</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Billable Hours</span>
          </div>
          <p className="text-2xl font-bold">{(agg?.billableHours ?? 0).toFixed(1)}h</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Entries</span>
          </div>
          <p className="text-2xl font-bold">{agg?.entryCount ?? 0}</p>
        </div>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">New Time Entry</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Task *</label>
              <select
                value={form.taskId}
                onChange={(e) => setForm({ ...form, taskId: e.target.value })}
                required
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value="">Select a task...</option>
                {tasks?.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Start</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">End</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What did you work on?"
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isBillable} onChange={(e) => setForm({ ...form, isBillable: e.target.checked })}
                  className="rounded" />
                <span className="text-sm">Billable</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={createLog.isPending}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                {createLog.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
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

      {/* Time log entries */}
      {agg && agg.logs.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billable</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {agg.logs.map((log, i) => (
                <tr
                  key={log.id}
                  className={cn(
                    'border-b border-border hover:bg-muted/30 transition-colors',
                    i === agg.logs.length - 1 && 'border-b-0'
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{(log.task as { title: string }).title}</span>
                    {log.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: '#6366f1' }}
                      >
                        {getInitials((log.user as { name: string }).name)}
                      </div>
                      <span className="text-xs">{(log.user as { name: string }).name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.start_time ? formatDateTime(log.start_time) : formatDateTime(log.logged_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{formatDuration(log.duration_minutes)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {log.is_billable ? (
                      <span className="text-xs bg-green-500/10 text-green-600 rounded-full px-2 py-0.5">
                        Billable
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteLog.mutate({ id: log.id })}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !showForm && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
          <Clock className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No time entries yet</p>
          <p className="text-sm text-muted-foreground mt-1">Log time against tasks to see it here</p>
        </div>
      )}
    </div>
  );
}
