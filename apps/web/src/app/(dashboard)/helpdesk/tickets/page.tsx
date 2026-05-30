'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, X, CheckSquare, UserCheck, Tag, XCircle } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { SlaStatusBadge, SlaTimer } from '@/components/helpdesk/SlaTimer';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  in_progress: 'bg-brand-500/10 text-brand-500',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  closed: 'bg-gray-200 text-gray-500',
};

const VIEW_LABELS: Record<string, string> = {
  mine: 'My Tickets',
  unassigned: 'Unassigned',
  all_open: 'All Open',
  overdue: 'SLA Breached',
  team: 'Team View',
};

export default function TicketsPage() {
  const searchParams = useSearchParams();
  const initialView = searchParams.get('view') ?? '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [view, setView] = useState(initialView);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);

  useEffect(() => { setShowBulkBar(selectedIds.size > 0); }, [selectedIds]);

  const utils = api.useUtils();

  const { data, isLoading } = api.helpdesk.ticketsV2.list.useQuery({
    page,
    limit: 25,
    search: search || undefined,
    status: statusFilter as never || undefined,
    priority: priorityFilter as never || undefined,
    sla_status: slaFilter as never || undefined,
    view: view as never || undefined,
  });

  const bulkCloseMutation = api.helpdesk.ticketsV2.bulkClose.useMutation({
    onSuccess: (r) => { toast.success(`${r.updated} tickets closed`); setSelectedIds(new Set()); void utils.helpdesk.ticketsV2.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!data?.items) return;
    if (selectedIds.size === data.items.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(data.items.map((t) => t.id))); }
  };

  const views = [
    { value: '', label: 'All Tickets' },
    { value: 'mine', label: 'My Tickets' },
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'all_open', label: 'All Open' },
    { value: 'overdue', label: 'SLA Breached' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{view ? (VIEW_LABELS[view] ?? 'Tickets') : 'All Tickets'}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data ? `${data.total} ticket${data.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <Link href="/helpdesk/tickets/new" className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Ticket
        </Link>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        {views.map((v) => (
          <button key={v.value} onClick={() => { setView(v.value); setPage(1); }}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', view === v.value ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search tickets, #TKT, email…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Statuses</option>
          {['open', 'in_progress', 'pending', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Priorities</option>
          {['urgent', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={slaFilter} onChange={(e) => { setSlaFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All SLA</option>
          <option value="ok">On Track</option>
          <option value="warning">Warning</option>
          <option value="breached_first">FRT Breached</option>
          <option value="breached_resolution">Resolution Breached</option>
        </select>
        {(search || statusFilter || priorityFilter || slaFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setSlaFilter(''); setPage(1); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-border rounded-lg">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {showBulkBar && (
        <div className="flex items-center gap-3 bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-400">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => bulkCloseMutation.mutate({ ids: Array.from(selectedIds) })}
            disabled={bulkCloseMutation.isPending}
            className="flex items-center gap-1.5 text-xs bg-background border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
            <XCircle className="w-3.5 h-3.5" /> Close All
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : !data?.items.length ? (
          <div className="p-16 text-center">
            <Filter className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">No tickets found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or view</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" checked={selectedIds.size === data.items.length && data.items.length > 0}
                        onChange={selectAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Subject</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">SLA</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Team</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Replies</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((ticket) => (
                    <tr key={ticket.id} className={cn('border-b border-border hover:bg-muted/20 transition-colors', selectedIds.has(ticket.id) && 'bg-brand-500/5')}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(ticket.id)} onChange={() => toggleSelect(ticket.id)} className="rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/helpdesk/tickets/${ticket.id}`} className="hover:text-brand-500 transition-colors">
                          <p className="font-medium line-clamp-1">{ticket.subject}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground font-mono">{ticket.ticket_number}</span>
                            {ticket.requester_email && <span className="text-xs text-muted-foreground hidden md:block">· {ticket.requester_email}</span>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', PRIORITY_COLORS[ticket.priority] ?? '')}>{ticket.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[ticket.status] ?? '')}>{ticket.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        {ticket.sla_status && ticket.sla_status !== 'completed' ? (
                          <SlaStatusBadge slaStatus={ticket.sla_status} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.team?.name ?? <span className="italic opacity-60">No team</span>}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{ticket._count.replies}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{timeAgo(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>{(page - 1) * 25 + 1}–{Math.min(page * 25, data.total)} of {data.total}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">←</button>
                  <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
