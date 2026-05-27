'use client';

import { useState } from 'react';
import { CalendarDays, Check, X, AlertCircle, Filter } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  withdrawn: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

type LeaveRequest = {
  id: string;
  status: string;
  start_date: Date;
  end_date: Date;
  total_days: unknown;
  reason: string | null;
  employee: { id: string; first_name: string; last_name: string; employee_code: string };
  leave_type: { id: string; name: string; code: string; color: string; paid_leave: boolean };
};

function RejectDialog({
  requestId,
  onClose,
}: {
  requestId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const utils = api.useUtils();
  const reject = api.hr.hr_leave_requests.reject.useMutation({
    onSuccess: () => { void utils.hr.hr_leave_requests.list.invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Reject Leave Request</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection..."
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
          />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            <button
              onClick={() => reject.mutate({ id: requestId, reason })}
              disabled={!reason.trim() || reject.isPending}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaveRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const utils = api.useUtils();

  const { data, isLoading } = api.hr.hr_leave_requests.list.useQuery({
    page,
    limit: 20,
    ...(statusFilter ? { status: statusFilter as 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn' } : {}),
  });

  const approve = api.hr.hr_leave_requests.approve.useMutation({
    onSuccess: () => void utils.hr.hr_leave_requests.list.invalidate(),
  });

  const items: LeaveRequest[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const STATUSES = ['', 'pending', 'approved', 'rejected', 'cancelled'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">{total} requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex border border-border rounded-lg overflow-hidden">
            {STATUSES.map((s) => (
              <button
                key={s || 'all'}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  statusFilter === s
                    ? 'bg-brand-500 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <p className="font-semibold text-muted-foreground">No leave requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Employee</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Leave Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Duration</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Days</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Reason</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium">{r.employee.first_name} {r.employee.last_name}</p>
                      <p className="text-xs text-muted-foreground">{r.employee.employee_code}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.leave_type.color }} />
                        <span>{r.leave_type.name}</span>
                        {!r.leave_type.paid_leave && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-1 rounded">Unpaid</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm">{String(r.total_days)}</td>
                    <td className="px-5 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[r.status] ?? '')}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate">{r.reason ?? '—'}</td>
                    <td className="px-5 py-3">
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => approve.mutate({ id: r.id })}
                            disabled={approve.isPending}
                            title="Approve"
                            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRejectingId(r.id)}
                            title="Reject"
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-muted">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-muted">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Pending count banner */}
      {items.filter((r) => r.status === 'pending').length > 0 && statusFilter === '' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            <span className="font-semibold">{items.filter((r) => r.status === 'pending').length}</span> pending requests require attention
          </p>
        </div>
      )}

      {rejectingId && <RejectDialog requestId={rejectingId} onClose={() => setRejectingId(null)} />}
    </div>
  );
}
