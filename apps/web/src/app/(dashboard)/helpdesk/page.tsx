// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Headphones, Clock, CheckCircle, AlertCircle, BarChart3, ArrowUpRight,
  X, Users, Inbox, Zap, BookOpen, Settings, AlertTriangle, TicketCheck, UserCheck,
} from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { SlaStatusBadge } from '@/components/helpdesk/SlaTimer';

// -- Priority / Status configs -----------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  // Legacy uppercase
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  in_progress: 'bg-brand-500/10 text-brand-500',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  closed: 'bg-gray-200 text-gray-500',
  OPEN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  IN_PROGRESS: 'bg-brand-500/10 text-brand-500',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  RESOLVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  CLOSED: 'bg-gray-200 text-gray-500',
};

// -- New Ticket Dialog -------------------------------------------------------

function NewTicketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', type: 'question' });
  const utils = api.useUtils();

  const createMutation = api.helpdesk.ticketsV2.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Ticket ${data.ticket_number} created`);
      void utils.helpdesk.ticketsV2.stats.invalidate();
      void utils.helpdesk.ticketsV2.list.invalidate();
      onClose();
      setForm({ subject: '', description: '', priority: 'medium', type: 'question' });
    },
    onError: (err) => toast.error(err.message),
  });

  if (!open) return null;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">New Ticket</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ subject: form.subject, description: form.description || undefined, priority: form.priority as 'medium', type: form.type as 'question' }); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Subject *</label>
            <input required value={form.subject} onChange={set('subject')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Brief summary of the issue…" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={4} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Priority</label>
              <select value={form.priority} onChange={set('priority')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select value={form.type} onChange={set('type')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="question">Question</option>
                <option value="incident">Incident</option>
                <option value="problem">Problem</option>
                <option value="task">Task</option>
                <option value="feature_request">Feature Request</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {createMutation.isPending ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function HelpDeskDashboard() {
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = api.helpdesk.ticketsV2.stats.useQuery();

  const { data: myTickets, isLoading: myLoading } = api.helpdesk.ticketsV2.list.useQuery({
    view: 'mine',
    limit: 10,
    page: 1,
  });

  const { data: overdueTickets } = api.helpdesk.ticketsV2.list.useQuery({
    view: 'overdue',
    limit: 5,
    page: 1,
  });

  const { data: unassignedTickets } = api.helpdesk.ticketsV2.list.useQuery({
    view: 'unassigned',
    limit: 5,
    page: 1,
  });

  const statCards = [
    { label: 'My Open Tickets', value: stats?.myTickets ?? 0, icon: TicketCheck, color: 'text-brand-500', bg: 'bg-brand-500/10', href: '/helpdesk/tickets?view=mine' },
    { label: 'Unassigned', value: stats?.unassigned ?? 0, icon: UserCheck, color: 'text-orange-600', bg: 'bg-orange-500/10', href: '/helpdesk/tickets?view=unassigned' },
    { label: 'SLA Breached', value: stats?.slaBreached ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10', href: '/helpdesk/tickets?view=overdue' },
    { label: 'Resolved Today', value: stats?.resolvedToday ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-500/10', href: '/helpdesk/tickets' },
  ];

  const navItems = [
    { label: 'All Tickets', href: '/helpdesk/tickets', icon: Headphones, desc: 'View and manage all tickets' },
    { label: 'Teams', href: '/helpdesk/teams', icon: Users, desc: 'Manage support teams' },
    { label: 'SLA Policies', href: '/helpdesk/sla', icon: Clock, desc: 'Configure SLA rules' },
    { label: 'Routing Rules', href: '/helpdesk/routing', icon: Zap, desc: 'Auto-route incoming tickets' },
    { label: 'Canned Responses', href: '/helpdesk/canned', icon: BarChart3, desc: 'Quick reply templates' },
    { label: 'Email Inboxes', href: '/helpdesk/inboxes', icon: Inbox, desc: 'Connect email accounts' },
    { label: 'Automation', href: '/helpdesk/automation', icon: Settings, desc: 'Event-driven automations' },
    { label: 'Knowledge Base', href: '/helpdesk/knowledge-base', icon: BookOpen, desc: 'Self-service articles' },
    { label: 'Reports', href: '/helpdesk/reports', icon: BarChart3, desc: 'Analytics & insights' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Help Desk</h1>
          <p className="text-muted-foreground mt-1">Customer support command center</p>
        </div>
        <button onClick={() => setNewTicketOpen(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statsLoading
          ? [...Array(4)].map((_, i) => <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse h-24" />)
          : statCards.map((s) => (
            <Link key={s.label} href={s.href} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', s.bg)}>
                  <s.icon className={cn('w-5 h-5', s.color)} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-muted-foreground text-sm mt-0.5">{s.label}</p>
            </Link>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tickets Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold">My Open Tickets</h2>
              <Link href="/helpdesk/tickets?view=mine" className="text-xs text-brand-500 hover:underline">View all</Link>
            </div>
            {myLoading ? (
              <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : !myTickets?.items.length ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {myTickets.items.map((ticket) => (
                  <Link key={ticket.id} href={`/helpdesk/tickets/${ticket.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ticket.ticket_number} · {timeAgo(ticket.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[ticket.priority] ?? '')}>{ticket.priority}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[ticket.status] ?? '')}>{ticket.status.replace('_', ' ')}</span>
                      {ticket.sla_status && ticket.sla_status !== 'ok' && <SlaStatusBadge slaStatus={ticket.sla_status} />}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Overdue / SLA Breached */}
          {(overdueTickets?.items.length ?? 0) > 0 && (
            <div className="bg-card border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h2 className="font-semibold text-red-700 dark:text-red-400">SLA Breached ({overdueTickets?.total ?? 0})</h2>
                </div>
                <Link href="/helpdesk/tickets?view=overdue" className="text-xs text-red-600 hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-border">
                {overdueTickets?.items.map((ticket) => (
                  <Link key={ticket.id} href={`/helpdesk/tickets/${ticket.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ticket.ticket_number}</p>
                    </div>
                    <SlaStatusBadge slaStatus={ticket.sla_status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold mb-4">Queue Overview</h3>
            <div className="space-y-3">
              {[
                { label: 'Open', value: stats?.open ?? 0, color: 'text-green-600' },
                { label: 'In Progress', value: stats?.inProgress ?? 0, color: 'text-brand-500' },
                { label: 'Pending', value: stats?.pending ?? 0, color: 'text-yellow-600' },
                { label: 'Unassigned', value: stats?.unassigned ?? 0, color: 'text-orange-600' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={cn('font-semibold', item.color)}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold mb-4">Quick Access</h3>
            <div className="grid grid-cols-2 gap-2">
              {navItems.slice(0, 6).map((item) => (
                <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-muted transition-colors text-center group">
                  <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-brand-500 transition-colors" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Unassigned */}
          {(unassignedTickets?.items.length ?? 0) > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-sm">Unassigned ({unassignedTickets?.total ?? 0})</h3>
                <Link href="/helpdesk/tickets?view=unassigned" className="text-xs text-brand-500 hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-border">
                {unassignedTickets?.items.slice(0, 4).map((ticket) => (
                  <Link key={ticket.id} href={`/helpdesk/tickets/${ticket.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">{ticket.ticket_number}</p>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[ticket.priority] ?? '')}>{ticket.priority}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <NewTicketDialog open={newTicketOpen} onClose={() => setNewTicketOpen(false)} />
    </div>
  );
}
