'use client';

import { useState } from 'react';
import { X, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

interface TimeLogDialogProps {
  taskId: string;
  taskTitle: string;
  projectId: string;
  onClose: () => void;
}

export function TimeLogDialog({ taskId, taskTitle, projectId, onClose }: TimeLogDialogProps) {
  const utils = api.useUtils();
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    description: '',
    isBillable: false,
  });

  const create = api.projects.timeLogs.create.useMutation({
    onSuccess: () => {
      void utils.projects.timeLogs.list.invalidate({ projectId });
      void utils.projects.timeLogs.list.invalidate({ taskId });
      toast.success('Time logged');
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startTime = new Date(`${form.date}T${form.startTime}:00`);
    const endTime = new Date(`${form.date}T${form.endTime}:00`);

    if (endTime <= startTime) {
      toast.error('End time must be after start time');
      return;
    }

    create.mutate({
      taskId,
      startTime,
      endTime,
      description: form.description || undefined,
      isBillable: form.isBillable,
    });
  };

  const durationMinutes = (() => {
    const start = new Date(`2000-01-01T${form.startTime}:00`);
    const end = new Date(`2000-01-01T${form.endTime}:00`);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60);
    return diff > 0 ? diff : 0;
  })();

  const durationLabel =
    durationMinutes > 0
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
      : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-500" />
            <h2 className="font-semibold text-base">Log Time</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task name */}
        <div className="px-6 pt-4">
          <p className="text-xs text-muted-foreground">Task</p>
          <p className="text-sm font-medium truncate">{taskTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                required
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                required
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>

          {/* Duration display */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Duration: <span className="font-medium text-foreground">{durationLabel}</span></span>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What did you work on?"
              rows={2}
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>

          {/* Billable toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, isBillable: !form.isBillable })}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                form.isBillable ? 'bg-brand-500' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                  form.isBillable ? 'translate-x-4.5' : 'translate-x-0.5'
                )}
              />
            </button>
            <span className="text-sm">Billable</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || durationMinutes <= 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Log Time
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
