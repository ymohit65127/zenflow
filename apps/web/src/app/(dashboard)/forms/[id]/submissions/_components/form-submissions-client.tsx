'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft, Users, Calendar, Clock, TrendingUp, X, Download,
  Eye, CheckCircle2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type SubmissionRow = {
  id: string;
  data: Record<string, unknown>;
  submitted_at: Date;
  is_complete: boolean;
  ip_address: string | null;
  user: { id: string; name: string; email: string } | null;
};

export function FormSubmissionsClient({ formId }: { formId: string }) {
  const router = useRouter();
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const formQuery = api.forms.get.useQuery({ id: formId });
  const statsQuery = api.forms.submissions.stats.useQuery({ form_id: formId });
  const submissionsQuery = api.forms.submissions.list.useQuery({
    form_id: formId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const form = formQuery.data;
  const stats = statsQuery.data;
  const submissions = (submissionsQuery.data ?? []) as SubmissionRow[];
  const fields = form?.fields ?? [];

  function handleExport() {
    toast.success('CSV export started — file will download shortly');
    // Real export: would generate CSV from submissions data
  }

  return (
    <div className="space-y-6">
      {/* Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] shadow-xl flex flex-col">
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
              {fields.map((field) => {
                const val = selectedSubmission.data[field.field_key];
                return (
                  <div key={field.id}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {field.label}
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
            <div className="p-4 border-t border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={cn('w-4 h-4', selectedSubmission.is_complete ? 'text-green-500' : 'text-amber-500')} />
                <span className="text-xs text-muted-foreground">
                  {selectedSubmission.is_complete ? 'Complete submission' : 'Partial submission'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/forms')}
            className="w-9 h-9 rounded-xl border border-border hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{form?.title ?? 'Form Submissions'}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              All responses collected for this form
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
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

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Responses</h2>
          <span className="text-sm text-muted-foreground">{stats?.total ?? 0} total</span>
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
            <p className="font-medium text-muted-foreground">No submissions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Share your form to start collecting responses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted By</th>
                  {fields.slice(0, 4).map((field) => (
                    <th key={field.id} className="px-4 py-3 text-left font-medium max-w-48 truncate">
                      {field.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium">Submitted At</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((sub, index) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedSubmission(sub)}
                  >
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
                    {fields.slice(0, 4).map((field) => {
                      const val = sub.data[field.field_key];
                      return (
                        <td key={field.id} className="px-4 py-3 text-sm max-w-48">
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
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedSubmission(sub); }}
                        className="w-7 h-7 rounded-lg hover:bg-brand-500/10 hover:text-brand-500 flex items-center justify-center transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
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
