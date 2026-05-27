'use client';

import { useState } from 'react';
import { Plus, Search, CheckCircle, XCircle, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

// -- Types -------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// -- Apply Leave Dialog -------------------------------------------------------

function ApplyLeaveDialog({
  open,
  onClose,
  employees,
  leaveTypes,
}: {
  open: boolean;
  onClose: () => void;
  employees: { id: string; first_name: string; last_name: string; employee_code: string }[];
  leaveTypes: { id: string; name: string; code: string; days_allowed: unknown }[];
}) {
  const [form, setForm] = useState({
    employee_id: '',
    leave_type_id: '',
    from_date: '',
    to_date: '',
    reason: '',
  });

  const utils = api.useUtils();

  const applyMutation = api.hr.leave.apply.useMutation({
    onSuccess: () => {
      toast.success('Leave request submitted');
      void utils.hr.leave.requests.invalidate();
      onClose();
      setForm({ employee_id: '', leave_type_id: '', from_date: '', to_date: '', reason: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const computedDays = (() => {
    if (!form.from_date || !form.to_date) return 0;
    const diff = (new Date(form.to_date).getTime() - new Date(form.from_date).getTime()) / 86_400_000;
    return Math.max(0, Math.round(diff) + 1);
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.leave_type_id || !form.from_date || !form.to_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    applyMutation.mutate({
      employee_id: form.employee_id,
      leave_type_id: form.leave_type_id,
      from_date: form.from_date,
      to_date: form.to_date,
      days: computedDays,
      reason: form.reason || undefined,
    });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Apply for Leave</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Employee *</label>
            <select required value={form.employee_id} onChange={set('employee_id')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">— Select Employee —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} ({e.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Leave Type *</label>
            <select required value={form.leave_type_id} onChange={set('leave_type_id')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">— Select Leave Type —</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({String(lt.days_allowed)} days/year)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">From Date *</label>
              <input required type="date" value={form.from_date} onChange={set('from_date')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">To Date *</label>
              <input required type="date" value={form.to_date} min={form.from_date} onChange={set('to_date')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
          </div>

          {computedDays > 0 && (
            <p className="text-sm text-brand-500 font-medium">{computedDays} day{computedDays !== 1 ? 's' : ''} selected</p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Reason</label>
            <textarea value={form.reason} onChange={set('reason')} rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="Optional reason for leave…" />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={applyMutation.isPending}
              className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {applyMutation.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Reject dialog -----------------------------------------------------------

function RejectDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const utils = api.useUtils();

  const rejectMutation = api.hr.leave.reject.useMutation({
    onSuccess: () => {
      toast.success('Leave request rejected');
      void utils.hr.leave.requests.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Reject Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Rejection Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="Optional rejection reason…"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={() => rejectMutation.mutate({ id, reason: reason || undefined })}
              disabled={rejectMutation.isPending}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function LeavePage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data, isLoading } = api.hr.leave.requests.useQuery({
    status: (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED') || undefined,
    page,
    limit: 20,
  });

  const { data: employees } = api.hr.employees.list.useQuery({ limit: 200 });
  const { data: leaveTypes } = api.hr.leave.types.useQuery();

  const approveMutation = api.hr.leave.approve.useMutation({
    onSuccess: () => {
      toast.success('Leave request approved');
      void utils.hr.leave.requests.invalidate();
      void utils.hr.employees.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const counts = {
    PENDING: data?.items.filter((r) => r.status === 'PENDING').length ?? 0,
    APPROVED: data?.items.filter((r) => r.status === 'APPROVED').length ?? 0,
    REJECTED: data?.items.filter((r) => r.status === 'REJECTED').length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground mt-1">Manage employee leave requests and approvals</p>
        </div>
        <button
          onClick={() => setApplyOpen(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Pending', value: counts.PENDING, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
          { label: 'Approved', value: counts.APPROVED, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
          { label: 'Rejected', value: counts.REJECTED, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
        ].map((s) => (
          <div key={s.label} className={cn('px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2', s.color)}>
            <CalendarDays className="w-4 h-4" />
            <span>{s.value} {s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="p-16 text-center">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">No leave requests found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Leave Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">From</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">To</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Days</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.employee.first_name} {r.employee.last_name}</p>
                        <p className="text-xs text-muted-foreground">{r.employee.designation ?? r.employee.employee_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{r.leave_type.name}</span>
                        {r.leave_type.is_paid && (
                          <span className="ml-1 text-xs text-green-600 dark:text-green-400">(Paid)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.from_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.to_date)}</td>
                      <td className="px-4 py-3 font-medium">{String(r.days)}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <span className="line-clamp-2">{r.reason ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[r.status] ?? '')}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'PENDING' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => approveMutation.mutate({ id: r.id })}
                              disabled={approveMutation.isPending}
                              title="Approve"
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setRejectId(r.id)}
                              title="Reject"
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
                </span>
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

      {/* Dialogs */}
      <ApplyLeaveDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        employees={employees?.items ?? []}
        leaveTypes={leaveTypes ?? []}
      />
      {rejectId && (
        <RejectDialog id={rejectId} onClose={() => setRejectId(null)} />
      )}
    </div>
  );
}
