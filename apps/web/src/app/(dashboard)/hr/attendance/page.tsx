'use client';

import { useState } from 'react';
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HALF_DAY: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ON_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HOLIDAY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WEEKEND: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_DOT: Record<string, string> = {
  PRESENT: 'bg-green-500',
  ABSENT: 'bg-red-500',
  HALF_DAY: 'bg-yellow-500',
  ON_LEAVE: 'bg-blue-500',
  HOLIDAY: 'bg-purple-500',
  WEEKEND: 'bg-gray-400',
};

// -- Mark Attendance Dialog ---------------------------------------------------

function MarkDialog({
  open,
  onClose,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  employees: { id: string; first_name: string; last_name: string; employee_code: string }[];
}) {
  const [form, setForm] = useState({
    employee_id: '',
    action: 'CHECK_IN' as 'CHECK_IN' | 'CHECK_OUT',
    status: 'PRESENT' as 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND',
    notes: '',
  });

  const utils = api.useUtils();

  const markMutation = api.hr.attendance.markToday.useMutation({
    onSuccess: () => {
      toast.success(`${form.action === 'CHECK_IN' ? 'Check-in' : 'Check-out'} marked successfully`);
      void utils.hr.attendance.list.invalidate();
      onClose();
      setForm({ employee_id: '', action: 'CHECK_IN', status: 'PRESENT', notes: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) { toast.error('Select an employee'); return; }
    markMutation.mutate(form);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Mark Attendance</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Employee *</label>
            <select
              required
              value={form.employee_id}
              onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">— Select Employee —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} ({e.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Action</label>
            <div className="flex gap-3">
              {(['CHECK_IN', 'CHECK_OUT'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, action: a }))}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                    form.action === a
                      ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {a === 'CHECK_IN' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  {a === 'CHECK_IN' ? 'Check In' : 'Check Out'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="PRESENT">Present</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="ABSENT">Absent</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="WEEKEND">Weekend</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="Optional notes…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={markMutation.isPending}
              className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {markMutation.isPending ? 'Marking…' : 'Mark Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function AttendancePage() {
  const [page, setPage] = useState(1);
  const [empFilter, setEmpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [markOpen, setMarkOpen] = useState(false);

  const { data, isLoading } = api.hr.attendance.list.useQuery({
    employee_id: empFilter || undefined,
    status: (statusFilter as 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND') || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    page,
    limit: 50,
  });

  const { data: employees } = api.hr.employees.list.useQuery({ limit: 200 });

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Aggregate stats for today
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecords = data?.items.filter((r) => new Date(r.date).toISOString().slice(0, 10) === todayStr) ?? [];
  const presentToday = todayRecords.filter((r) => r.status === 'PRESENT').length;
  const absentToday = todayRecords.filter((r) => r.status === 'ABSENT').length;
  const onLeaveToday = todayRecords.filter((r) => r.status === 'ON_LEAVE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground mt-1">{today}</p>
        </div>
        <button
          onClick={() => setMarkOpen(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Clock className="w-4 h-4" /> Mark Attendance
        </button>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Present Today", value: presentToday, color: 'text-green-600', bg: 'bg-green-500/10' },
          { label: "Absent Today", value: absentToday, color: 'text-red-600', bg: 'bg-red-500/10' },
          { label: "On Leave Today", value: onLeaveToday, color: 'text-blue-600', bg: 'bg-blue-500/10' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', s.bg)}>
              <Clock className={cn('w-5 h-5', s.color)} />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={empFilter}
          onChange={(e) => { setEmpFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All Employees</option>
          {employees?.items.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name} ({e.employee_code})
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All Statuses</option>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="HALF_DAY">Half Day</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="HOLIDAY">Holiday</option>
          <option value="WEEKEND">Weekend</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          title="From date"
        />
        <input
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          title="To date"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="p-16 text-center">
            <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">No attendance records found</p>
            <p className="text-sm text-muted-foreground mt-1">Adjust filters or mark today&apos;s attendance</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Check In</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Check Out</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Hours Worked</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.employee.first_name} {r.employee.last_name}</p>
                        <p className="text-xs text-muted-foreground">{r.employee.employee_code}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.check_in ? (
                          <span className="flex items-center gap-1">
                            <LogIn className="w-3.5 h-3.5 text-green-500" />
                            {formatDate(r.check_in, 'HH:mm')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.check_out ? (
                          <span className="flex items-center gap-1">
                            <LogOut className="w-3.5 h-3.5 text-orange-500" />
                            {formatDate(r.check_out, 'HH:mm')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {r.hours_worked ? `${String(r.hours_worked)}h` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1', STATUS_COLORS[r.status] ?? '')}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[r.status] ?? '')} />
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <span className="line-clamp-1">{(r as { notes?: string | null }).notes ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>{(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of {data.total}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MarkDialog
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        employees={employees?.items ?? []}
      />
    </div>
  );
}
