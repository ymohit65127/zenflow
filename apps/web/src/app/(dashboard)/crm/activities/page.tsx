'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Activity, Plus, Search, X, CheckCircle2,
  Phone, Mail, CalendarCheck, Mic2, FileText,
  ListTodo, TrendingUp, Clock, Filter,
} from 'lucide-react';

type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE' | 'DEMO' | 'FOLLOW_UP';
type ActivityStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const ACTIVITY_TYPE_META: Record<ActivityType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  CALL:      { label: 'Call',       icon: Phone,        color: 'text-brand-600',  bg: 'bg-brand-500/10' },
  EMAIL:     { label: 'Email',      icon: Mail,         color: 'text-cyan-600',   bg: 'bg-cyan-500/10' },
  MEETING:   { label: 'Meeting',    icon: CalendarCheck, color: 'text-violet-600', bg: 'bg-violet-500/10' },
  TASK:      { label: 'Task',       icon: ListTodo,     color: 'text-amber-600',  bg: 'bg-amber-500/10' },
  NOTE:      { label: 'Note',       icon: FileText,     color: 'text-green-600',  bg: 'bg-green-500/10' },
  DEMO:      { label: 'Demo',       icon: Mic2,         color: 'text-pink-600',   bg: 'bg-pink-500/10' },
  FOLLOW_UP: { label: 'Follow Up',  icon: TrendingUp,   color: 'text-orange-600', bg: 'bg-orange-500/10' },
};

const STATUS_STYLES: Record<ActivityStatus, string> = {
  PLANNED:     'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  IN_PROGRESS: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  COMPLETED:   'bg-green-500/10 text-green-600 dark:text-green-400',
  CANCELLED:   'bg-muted text-muted-foreground',
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW:    'text-muted-foreground',
  MEDIUM: 'text-amber-600',
  HIGH:   'text-orange-600',
  URGENT: 'text-red-600',
};

interface ActivityFormState {
  type: ActivityType;
  subject: string;
  description: string;
  status: ActivityStatus;
  priority: Priority;
  due_at: string;
  contact_id: string;
  lead_id: string;
  deal_id: string;
}

const emptyForm: ActivityFormState = {
  type: 'CALL',
  subject: '',
  description: '',
  status: 'PLANNED',
  priority: 'MEDIUM',
  due_at: '',
  contact_id: '',
  lead_id: '',
  deal_id: '',
};

function ActivityFormDialog({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<ActivityFormState>(emptyForm);
  const utils = api.useUtils();

  const { data: contacts } = api.crm.contacts.list.useQuery({ limit: 100 });
  const { data: leads } = api.crm.leads.list.useQuery({ limit: 100 });
  const { data: deals } = api.crm.deals.list.useQuery({ limit: 100 });

  const create = api.crm.activities.create.useMutation({
    onSuccess: () => { toast.success('Activity logged'); void utils.crm.activities.list.invalidate(); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const set = (k: keyof ActivityFormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      ...form,
      due_at: form.due_at || undefined,
      contact_id: form.contact_id || undefined,
      lead_id: form.lead_id || undefined,
      deal_id: form.deal_id || undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-semibold text-lg">Log Activity</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                {(Object.keys(ACTIVITY_TYPE_META) as ActivityType[]).map((t) => (
                  <option key={t} value={t}>{ACTIVITY_TYPE_META[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Subject <span className="text-red-500">*</span></label>
            <input required value={form.subject} onChange={(e) => set('subject', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="e.g. Follow-up call with Acme Corp" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="What happened or needs to be done..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as ActivityStatus)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Due Date</label>
              <input type="datetime-local" value={form.due_at} onChange={(e) => set('due_at', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Linked Contact</label>
            <select value={form.contact_id} onChange={(e) => set('contact_id', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">No contact</option>
              {contacts?.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ''} {c.company ? `(${c.company})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Linked Deal</label>
            <select value={form.deal_id} onChange={(e) => set('deal_id', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">No deal</option>
              {deals?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {create.isPending ? 'Saving...' : 'Log Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ActivityType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | ''>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = api.useUtils();

  const { data: activities, isLoading } = api.crm.activities.list.useQuery({
    limit: 100,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
  });

  const complete = api.crm.activities.complete.useMutation({
    onSuccess: () => { toast.success('Activity marked as completed'); void utils.crm.activities.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = activities?.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.subject.toLowerCase().includes(q) ||
      (a.contact ? `${a.contact.first_name} ${a.contact.last_name ?? ''}`.toLowerCase().includes(q) : false) ||
      (a.deal?.name.toLowerCase().includes(q) ?? false)
    );
  }) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activities</h1>
          <p className="text-muted-foreground mt-1">Track calls, meetings, tasks, and follow-ups</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Log Activity
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-0 border-b border-border">
        {[
          { href: '/crm', label: 'Overview' },
          { href: '/crm/contacts', label: 'Contacts' },
          { href: '/crm/leads', label: 'Leads' },
          { href: '/crm/deals', label: 'Deals' },
          { href: '/crm/activities', label: 'Activities', active: true },
        ].map((link) => (
          <Link key={link.href} href={link.href}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              link.active ? 'border-brand-500 text-brand-500' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border')}>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} type="search"
            placeholder="Search activities..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ActivityType | '')}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-36">
          <option value="">All Types</option>
          {(Object.keys(ACTIVITY_TYPE_META) as ActivityType[]).map((t) => (
            <option key={t} value={t}>{ACTIVITY_TYPE_META[t].label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ActivityStatus | '')}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-40">
          <option value="">All Statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Activity type quick filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('')}
          className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
            !typeFilter ? 'bg-brand-500 text-white border-brand-500' : 'border-border text-muted-foreground hover:border-brand-500/50 hover:text-foreground')}
        >
          All
        </button>
        {(Object.keys(ACTIVITY_TYPE_META) as ActivityType[]).map((t) => {
          const meta = ACTIVITY_TYPE_META[t];
          const Icon = meta.icon;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t === typeFilter ? '' : t)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                typeFilter === t ? `${meta.bg} ${meta.color} border-transparent` : 'border-border text-muted-foreground hover:border-brand-500/50 hover:text-foreground')}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Activity list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-6 py-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
                <div className="h-6 w-20 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-base mb-1">No activities found</p>
            <p className="text-sm">
              {search || typeFilter || statusFilter
                ? 'Try adjusting your filters.'
                : 'Log your first activity to get started.'}
            </p>
            {!search && !typeFilter && !statusFilter && (
              <button
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Log Activity
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((activity) => {
              const meta = ACTIVITY_TYPE_META[activity.type];
              const Icon = meta.icon;
              const isOverdue = activity.due_at && activity.status === 'PLANNED' && new Date(activity.due_at) < new Date();
              return (
                <div key={activity.id} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors group">
                  {/* Type icon */}
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', meta.bg)}>
                    <Icon className={cn('w-4 h-4', meta.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="font-medium text-sm">{activity.subject}</p>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[activity.status])}>
                        {activity.status.replace(/_/g, ' ')}
                      </span>
                      <span className={cn('text-xs font-medium', PRIORITY_STYLES[activity.priority])}>
                        {activity.priority}
                      </span>
                    </div>

                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {activity.contact && (
                        <span className="flex items-center gap-1">
                          {activity.contact.first_name} {activity.contact.last_name ?? ''}
                        </span>
                      )}
                      {activity.deal && (
                        <span className="flex items-center gap-1 text-brand-500">
                          {activity.deal.name}
                        </span>
                      )}
                      {activity.due_at && (
                        <span className={cn('flex items-center gap-1', isOverdue ? 'text-red-500' : '')}>
                          <Clock className="w-3 h-3" />
                          {isOverdue ? 'Overdue: ' : ''}{formatDate(activity.due_at, 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      <span>{timeAgo(activity.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {activity.status !== 'COMPLETED' && activity.status !== 'CANCELLED' && (
                      <button
                        onClick={() => complete.mutate({ id: activity.id })}
                        disabled={complete.isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:border-green-500 hover:bg-green-500/5 hover:text-green-600 text-xs font-medium text-muted-foreground transition-all disabled:opacity-50"
                        title="Mark as completed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ActivityFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setDialogOpen(false)}
      />
    </div>
  );
}
