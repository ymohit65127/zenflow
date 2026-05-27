'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Headphones, Clock, CheckCircle, AlertCircle, BarChart3, ArrowUpRight, X } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

// -- Priority config ---------------------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-blue-500',
  LOW: 'bg-gray-400',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  IN_PROGRESS: 'bg-brand-500/10 text-brand-500',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  RESOLVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  CLOSED: 'bg-gray-200 text-gray-500 dark:bg-gray-800/80 dark:text-gray-500',
};

// -- New Ticket Dialog -------------------------------------------------------

function NewTicketDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string; color: string | null }[];
}) {
  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    type: 'QUESTION' as 'QUESTION' | 'PROBLEM' | 'FEATURE_REQUEST' | 'BUG' | 'OTHER',
    category_id: '',
  });

  const utils = api.useUtils();

  const createMutation = api.helpdesk.tickets.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Ticket ${data.ticket_number} created`);
      void utils.helpdesk.tickets.list.invalidate();
      void utils.helpdesk.tickets.stats.invalidate();
      onClose();
      setForm({ subject: '', description: '', priority: 'MEDIUM', type: 'QUESTION', category_id: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      subject: form.subject,
      description: form.description || undefined,
      priority: form.priority,
      type: form.type,
      category_id: form.category_id || undefined,
    });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">New Ticket</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Subject *</label>
            <input
              required
              value={form.subject}
              onChange={set('subject')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="Brief summary of the issue…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="Describe the issue in detail…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Priority</label>
              <select value={form.priority} onChange={set('priority')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select value={form.type} onChange={set('type')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="QUESTION">Question</option>
                <option value="PROBLEM">Problem</option>
                <option value="BUG">Bug</option>
                <option value="FEATURE_REQUEST">Feature Request</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>
            <select value={form.category_id} onChange={set('category_id')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">— Uncategorised —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending}
              className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {createMutation.isPending ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Ticket Row --------------------------------------------------------------

type TicketItem = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  type: string;
  created_at: Date;
  category: { id: string; name: string; color: string | null } | null;
  creator: { id: string; name: string; avatar_url: string | null };
  assignments: { user: { id: string; name: string; avatar_url: string | null } }[];
  _count: { replies: number };
};

function TicketRow({ ticket }: { ticket: TicketItem }) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <Link href={`/helpdesk/tickets/${ticket.id}`} className="hover:text-brand-500 transition-colors">
          <p className="font-medium line-clamp-1">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ticket.ticket_number}</p>
        </Link>
      </td>
      <td className="px-4 py-3">
        {ticket.category ? (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: ticket.category.color ? `${ticket.category.color}20` : undefined,
              color: ticket.category.color ?? undefined,
            }}
          >
            {ticket.category.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1', PRIORITY_COLORS[ticket.priority] ?? '')}>
          <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[ticket.priority] ?? '')} />
          {ticket.priority}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[ticket.status] ?? '')}>
          {ticket.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{ticket.creator.name}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {ticket.assignments.length > 0
          ? ticket.assignments.map((a) => a.user.name).join(', ')
          : <span className="text-muted-foreground/60 italic">Unassigned</span>}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{ticket._count.replies}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground" title={formatDate(ticket.created_at, 'MMM d, yyyy HH:mm')}>
        {timeAgo(ticket.created_at)}
      </td>
      <td className="px-4 py-3">
        <Link href={`/helpdesk/tickets/${ticket.id}`}
          className="text-xs text-brand-500 hover:underline">
          View
        </Link>
      </td>
    </tr>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function HelpDeskPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [newTicketOpen, setNewTicketOpen] = useState(false);

  const { data, isLoading } = api.helpdesk.tickets.list.useQuery({
    search: search || undefined,
    status: (statusFilter as 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED') || undefined,
    priority: (priorityFilter as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || undefined,
    category_id: categoryFilter || undefined,
    page,
    limit: 20,
  });

  const { data: stats, isLoading: statsLoading } = api.helpdesk.tickets.stats.useQuery();
  const { data: categories } = api.helpdesk.categories.list.useQuery();

  const statCards = [
    { label: 'Open', value: stats?.open ?? 0, icon: Headphones, color: 'text-green-600', bg: 'bg-green-500/10' },
    { label: 'In Progress', value: stats?.inProgress ?? 0, icon: Clock, color: 'text-brand-500', bg: 'bg-brand-500/10' },
    { label: 'Resolved Today', value: stats?.resolvedToday ?? 0, icon: CheckCircle, color: 'text-cyan-600', bg: 'bg-cyan-500/10' },
    {
      label: 'Avg Response (7d)',
      value: `${stats?.avgResponseTimeHours ?? 0}h`,
      icon: BarChart3,
      color: 'text-violet-600',
      bg: 'bg-violet-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Help Desk</h1>
          <p className="text-muted-foreground mt-1">Manage support tickets and customer service queues</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/helpdesk/knowledge-base"
            className="flex items-center gap-1.5 border border-border hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Knowledge Base
          </Link>
          <button
            onClick={() => setNewTicketOpen(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsLoading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-8 bg-muted rounded w-1/3" />
              </div>
            ))
          : statCards.map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', s.bg)}>
                    <s.icon className={cn('w-5 h-5', s.color)} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-muted-foreground text-sm mt-0.5">{s.label}</p>
              </div>
            ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tickets…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Categories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tickets table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="p-16 text-center">
            <Headphones className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">No tickets found</p>
            <button
              onClick={() => setNewTicketOpen(true)}
              className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Create First Ticket
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Subject</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Created By</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Assignee</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Replies</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>{(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                    ←
                  </button>
                  <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NewTicketDialog
        open={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
        categories={categories ?? []}
      />
    </div>
  );
}
