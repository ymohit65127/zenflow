'use client';

import { useState } from 'react';
import { Clock, Plus, Edit, Trash2, X, Check, Moon, Sun } from 'lucide-react';
import { api } from '@/trpc/react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Shift = {
  id: string;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  half_day_threshold_minutes: number;
  break_duration_minutes: number;
  is_night_shift: boolean;
  overtime_after_minutes: number;
  weekly_off_days: number[];
  is_active: boolean;
  _count: { assignments: number };
};

function ShiftFormDialog({
  shift,
  onClose,
}: {
  shift: Shift | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState({
    name: shift?.name ?? '',
    color: shift?.color ?? '#6366f1',
    start_time: shift?.start_time ?? '09:00',
    end_time: shift?.end_time ?? '18:00',
    grace_period_minutes: shift?.grace_period_minutes ?? 15,
    half_day_threshold_minutes: shift?.half_day_threshold_minutes ?? 240,
    break_duration_minutes: shift?.break_duration_minutes ?? 60,
    is_night_shift: shift?.is_night_shift ?? false,
    overtime_after_minutes: shift?.overtime_after_minutes ?? 480,
    weekly_off_days: shift?.weekly_off_days ?? [0, 6],
  });

  const create = api.hr.hr_shifts.create.useMutation({
    onSuccess: () => { void utils.hr.hr_shifts.list.invalidate(); onClose(); },
  });
  const update = api.hr.hr_shifts.update.useMutation({
    onSuccess: () => { void utils.hr.hr_shifts.list.invalidate(); onClose(); },
  });

  const isPending = create.isPending || update.isPending;

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      weekly_off_days: f.weekly_off_days.includes(d)
        ? f.weekly_off_days.filter((x) => x !== d)
        : [...f.weekly_off_days, d],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (shift) {
      update.mutate({ id: shift.id, ...form });
    } else {
      create.mutate(form);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">{shift ? 'Edit Shift' : 'New Shift'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Morning Shift"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                required
              />
            </div>
            <div className="w-20">
              <label className="block text-sm font-medium mb-1.5">Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-full h-[38px] px-1 py-1 bg-background border border-border rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Time *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End Time *</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Grace (min)</label>
              <input
                type="number"
                min={0}
                value={form.grace_period_minutes}
                onChange={(e) => setForm((f) => ({ ...f, grace_period_minutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Break (min)</label>
              <input
                type="number"
                min={0}
                value={form.break_duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, break_duration_minutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">OT After (min)</label>
              <input
                type="number"
                min={0}
                value={form.overtime_after_minutes}
                onChange={(e) => setForm((f) => ({ ...f, overtime_after_minutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Weekly Off Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.weekly_off_days.includes(i)
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-background border-border text-muted-foreground hover:border-brand-400'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_night_shift}
              onChange={(e) => setForm((f) => ({ ...f, is_night_shift: e.target.checked }))}
              className="rounded border-border"
            />
            <span className="text-sm font-medium">Night Shift</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {shift ? 'Save Changes' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const utils = api.useUtils();

  const { data: shifts = [], isLoading } = api.hr.hr_shifts.list.useQuery();
  const deleteMutation = api.hr.hr_shifts.delete.useMutation({
    onSuccess: () => void utils.hr.hr_shifts.list.invalidate(),
  });

  function openEdit(s: Shift) { setEditingShift(s); setShowDialog(true); }
  function openCreate() { setEditingShift(null); setShowDialog(true); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shift Manager</h1>
          <p className="text-muted-foreground mt-1">{shifts.length} shifts configured</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Shift
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">No shifts configured</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Create First Shift
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: shift.color }}
                  />
                  <h3 className="font-semibold">{shift.name}</h3>
                  {shift.is_night_shift && <Moon className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(shift)} className="p-1 rounded hover:bg-muted transition-colors">
                    <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Deactivate this shift?')) deleteMutation.mutate({ id: shift.id }); }}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                <Sun className="w-3.5 h-3.5" />
                <span className="font-mono">{shift.start_time}</span>
                <span>–</span>
                <span className="font-mono">{shift.end_time}</span>
              </div>

              <div className="flex gap-1 mb-3">
                {DAYS.map((d, i) => (
                  <span
                    key={d}
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      shift.weekly_off_days.includes(i)
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Grace: {shift.grace_period_minutes}m · Break: {shift.break_duration_minutes}m</p>
                <p className="text-brand-500 font-medium">{shift._count.assignments} employees assigned</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDialog && (
        <ShiftFormDialog shift={editingShift} onClose={() => setShowDialog(false)} />
      )}
    </div>
  );
}
