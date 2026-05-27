'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft, Users, Calendar, Clock, TrendingUp, X, Download,
  Eye, CheckCircle2, XCircle, Clock3, Filter, ChevronDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

type SubmissionRow = {
  id: string;
  data: Record<string, unknown>;
  submitted_at: Date;
  is_complete: boolean;
  ip_address: string | null;
  approval_status?: ApprovalStatus | null;
  approval_remarks?: string | null;
  user: { id: string; name: string; email: string } | null;
};

type ApprovalLogEntry = {
  id: string;
  step_position: number;
  approver_id: string;
  action: 'approved' | 'rejected' | 'reassigned';
  remarks: string | null;
  created_at: Date;
};

// ─── Approval status badge ─────────────────────────────────────────────────

function ApprovalBadge({ status }: { status?: ApprovalStatus | null }) {
  if (!status) return null;
  const map: Record<ApprovalStatus, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
    pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600', icon: Clock3 },
    approved: { label: 'Approved', className: 'bg-green-500/10 text-green-600', icon: CheckCircle2 },
    rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-600', icon: XCircle },
  };
  const { label, className, icon: Icon } = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', className)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Approval timeline ────────────────────────────────────────────────────────

function ApprovalTimeline({ submissionId }: { submissionId: string }) {
  const timelineQuery = api.forms.approvals.timeline.useQuery({ submissionId });
  const logs = (timelineQuery.data ?? []) as ApprovalLogEntry[];

  if (timelineQuery.isLoading) {
    return <div className="h-8 bg-muted rounded-xl animate-pulse" />;
  }
  if (logs.length === 0) {
    return <p className="text-xs text-muted-foreground">No approval actions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-2.5">
          <div className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
            log.action === 'approved' ? 'bg-green-500/10 text-green-500' :
            log.action === 'rejected' ? 'bg-red-500/10 text-red-500' :
            'bg-amber-500/10 text-amber-500'
          )}>
            {log.action === 'approved' ? <CheckCircle2 className="w-3 h-3" /> :
             log.action === 'rejected' ? <XCircle className="w-3 h-3" /> :
             <Clock3 className="w-3 h-3" />}
          </div>
          <div>
            <p className="text-xs font-medium capitalize">
              Step {log.step_position}: {log.action}
            </p>
            {log.remarks && <p className="text-xs text-muted-foreground">{log.remarks}</p>}
            <p className="text-xs text-muted-foreground">{formatDate(log.created_at, 'MMM d, HH:mm')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FormSubmissionsClient({ formId }: { formId: string }) {
  const router = useRouter();
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(null);
  const [page, setPage] = useState(0);
  const [approvalFilter, setApprovalFilter] = useState<'all' | ApprovalStatus>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const PAGE_SIZE = 25;

  const formQuery = api.forms.get.useQuery({ id: formId });
  const statsQuery = api.forms.submissions.stats.useQuery({ form_id: formId });
  const submissionsQuery = api.forms.submissions.list.useQuery({
    form_id: formId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const approveMutation = api.forms.approvals.approve.useMutation({
    onSuccess: () => {
      toast.success('Submission approved');
      void submissionsQuery.refetch();
      setSelectedIds(new Set());
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = api.forms.approvals.reject.useMutation({
    onSuccess: () => {
      toast.success('Submission rejected');
      void submissionsQuery.refetch();
      setSelectedIds(new Set());
      setShowRejectInput(false);
      setRejectRemarks('');
    },
    onError: (e) => toast.error(e.message),
  });

  const form = formQuery.data;
  const stats = statsQuery.data;
  const allSubmissions = (submissionsQuery.data ?? []) as SubmissionRow[];

  // Client-side filter by approval status
  const submissions = approvalFilter === 'all'
    ? allSubmissions
    : allSubmissions.filter((s) => s.approval_status === approvalFilter);

  const fields = form?.fields ?? [];

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === submissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(submissions.map((s) => s.id)));
    }
  }

  function handleBulkApprove() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => approveMutation.mutate({ submissionId: id }));
  }

  function handleBulkReject() {
    if (!rejectRemarks.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    const ids = Array.from(selectedIds);
    ids.forEach((id) => rejectMutation.mutate({ submissionId: id, remarks: rejectRemarks }));
  }

  function handleExportCSV() {
    // Build CSV from current submissions data
    const headers = ['#', 'Submitted By', 'Email', 'Approval Status', 'Submitted At',
      ...fields.slice(0, 10).map((f: Record<string, unknown>) => String(f.label))];
    const rows = submissions.map((sub, i) => [
      String(page * PAGE_SIZE + i + 1),
      sub.user?.name ?? 'Anonymous',
      sub.user?.email ?? '',
      sub.approval_status ?? '',
      formatDate(sub.submitted_at, 'yyyy-MM-dd HH:mm'),
      ...fields.slice(0, 10).map((f: Record<string, unknown>) => {
        const val = sub.data[f.field_key as string];
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) return (val as string[]).join('; ');
        return String(val);
      }),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${formId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  }

  return (
    <div className="space-y-6">
      {/* Detail modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
              <div>
                <h2 className="font-semibold">Submission Details</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(selectedSubmission.submitted_at, 'MMM d, yyyy HH:mm')}
                  {selectedSubmission.ip_address && ` · ${selectedSubmission.ip_address}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Submitter */}
              {selectedSubmission.user && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-semibold text-sm">
                    {selectedSubmission.user.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedSubmission.user.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedSubmission.user.email}</p>
                  </div>
                </div>
              )}

              {/* Approval status */}
              {selectedSubmission.approval_status && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Approval:</span>
                  <ApprovalBadge status={selectedSubmission.approval_status} />
                  {selectedSubmission.approval_remarks && (
                    <span className="text-xs text-muted-foreground">— {selectedSubmission.approval_remarks}</span>
                  )}
                </div>
              )}

              {/* Approval timeline */}
              {selectedSubmission.approval_status && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Timeline</p>
                  <ApprovalTimeline submissionId={selectedSubmission.id} />
                </div>
              )}

              {/* Field values */}
              {fields.map((field: Record<string, unknown>) => {
                const val = selectedSubmission.data[field.field_key as string];
                return (
                  <div key={field.id as string}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {String(field.label)}
                    </p>
                    <div className="bg-muted/50 rounded-xl p-3 text-sm">
                      {val === undefined || val === null || val === ''
                        ? <span className="text-muted-foreground italic">No response</span>
                        : Array.isArray(val)
                          ? (val as string[]).join(', ')
                          : String(val)
                      }
                    </div>
                  </div>
                );
              })}
              {fields.length === 0 && (
                <div className="space-y-3">
                  {Object.entries(selectedSubmission.data).map(([key, val]) => (
                    <div key={key}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{key}</p>
                      <div className="bg-muted/50 rounded-xl p-3 text-sm">
                        {val === null ? <span className="italic text-muted-foreground">null</span> : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Approval actions in modal */}
            {selectedSubmission.approval_status === 'pending' && (
              <div className="p-4 border-t border-border flex-shrink-0 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      approveMutation.mutate({ submissionId: selectedSubmission.id });
                      setSelectedSubmission(null);
                    }}
                    className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectInput((v) => !v)}
                    className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
                {showRejectInput && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={rejectRemarks}
                      onChange={(e) => setRejectRemarks(e.target.value)}
                      placeholder="Rejection reason (required)"
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/40"
                    />
                    <button
                      onClick={() => {
                        rejectMutation.mutate({ submissionId: selectedSubmission.id, remarks: rejectRemarks });
                        setSelectedSubmission(null);
                      }}
                      disabled={!rejectRemarks.trim()}
                      className="w-full py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                )}
              </div>
            )}
            {!selectedSubmission.approval_status && (
              <div className="p-4 border-t border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn('w-4 h-4', selectedSubmission.is_complete ? 'text-green-500' : 'text-amber-500')} />
                  <span className="text-xs text-muted-foreground">
                    {selectedSubmission.is_complete ? 'Complete submission' : 'Partial submission'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/forms')}
            className="w-9 h-9 rounded-xl border border-border hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{form?.title ?? 'Form Submissions'}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">All responses collected for this form</p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
          ))
        ) : (
          <>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center mb-2">
                <Users className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Submissions</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2">
                <Calendar className="w-4 h-4 text-cyan-500" />
              </div>
              <p className="text-2xl font-bold">{stats?.today ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Today</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
                <Clock className="w-4 h-4 text-violet-500" />
              </div>
              <p className="text-2xl font-bold">{stats?.thisWeek ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">This Week</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{stats?.completionRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Completion Rate</p>
            </div>
          </>
        )}
      </div>

      {/* Toolbar: filter + bulk actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Approval status filter */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
          >
            <Filter className="w-4 h-4" />
            {approvalFilter === 'all' ? 'All Submissions' : `${approvalFilter.charAt(0).toUpperCase() + approvalFilter.slice(1)}`}
            <ChevronDown className="w-3.5 h-3.5 ml-1" />
          </button>
          {showFilterMenu && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 py-1 min-w-40">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setApprovalFilter(f); setShowFilterMenu(false); }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors',
                    approvalFilter === f && 'font-medium text-brand-600'
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {approvalFilter === f && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <button
              onClick={handleBulkApprove}
              disabled={approveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve All
            </button>
            <button
              onClick={() => setShowRejectInput((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject All
            </button>
          </div>
        )}
      </div>

      {/* Bulk reject input */}
      {showRejectInput && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-400/30 rounded-xl">
          <input
            type="text"
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            placeholder="Rejection reason (required)"
            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/40"
          />
          <button
            onClick={handleBulkReject}
            disabled={!rejectRemarks.trim() || rejectMutation.isPending}
            className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            Confirm
          </button>
          <button onClick={() => { setShowRejectInput(false); setRejectRemarks(''); }} className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-sm transition-colors">
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Responses</h2>
          <span className="text-sm text-muted-foreground">{submissions.length} shown</span>
        </div>

        {submissionsQuery.isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">
              {approvalFilter === 'all' ? 'No submissions yet' : `No ${approvalFilter} submissions`}
            </p>
            {approvalFilter === 'all' && (
              <p className="text-sm text-muted-foreground mt-1">Share your form to start collecting responses.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/30">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === submissions.length && submissions.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-brand-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted By</th>
                  {fields.slice(0, 3).map((field: Record<string, unknown>) => (
                    <th key={field.id as string} className="px-4 py-3 text-left font-medium max-w-40 truncate">
                      {String(field.label)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium">Submitted At</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Approval</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((sub, index) => (
                  <tr
                    key={sub.id}
                    className={cn(
                      'hover:bg-muted/20 transition-colors cursor-pointer',
                      selectedIds.has(sub.id) && 'bg-brand-500/5'
                    )}
                    onClick={() => setSelectedSubmission(sub)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(sub.id)}
                        onChange={() => toggleSelect(sub.id)}
                        className="w-3.5 h-3.5 accent-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {page * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sub.user ? (
                        <div>
                          <p className="font-medium">{sub.user.name}</p>
                          <p className="text-xs text-muted-foreground">{sub.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Anonymous</span>
                      )}
                    </td>
                    {fields.slice(0, 3).map((field: Record<string, unknown>) => {
                      const val = sub.data[field.field_key as string];
                      return (
                        <td key={field.id as string} className="px-4 py-3 text-sm max-w-40">
                          <span className="truncate block">
                            {val === undefined || val === null || val === ''
                              ? <span className="text-muted-foreground italic">—</span>
                              : Array.isArray(val)
                                ? (val as string[]).join(', ')
                                : String(val)
                            }
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(sub.submitted_at, 'MMM d, HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        sub.is_complete ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                      )}>
                        {sub.is_complete ? 'Complete' : 'Partial'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ApprovalBadge status={sub.approval_status} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedSubmission(sub)}
                          className="w-7 h-7 rounded-lg hover:bg-brand-500/10 hover:text-brand-500 flex items-center justify-center transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {sub.approval_status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate({ submissionId: sub.id })}
                              disabled={approveMutation.isPending}
                              className="w-7 h-7 rounded-lg hover:bg-green-500/10 hover:text-green-500 flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSubmission(sub);
                                setShowRejectInput(true);
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(stats?.total ?? 0) > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, stats?.total ?? 0)} of {stats?.total ?? 0}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= (stats?.total ?? 0)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
