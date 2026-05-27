// @ts-nocheck
'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Send, Lock, Globe, CheckCircle, XCircle, MessageSquare, AlertCircle,
  Clock, Merge, Scissors, Star, Timer, RefreshCw, MoreHorizontal,
} from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo, getInitials, generateAvatarColor } from '@/lib/utils';
import { toast } from 'sonner';
import { SlaTimer, SlaStatusBadge } from '@/components/helpdesk/SlaTimer';

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

// -- Time Log Dialog ----------------------------------------------------------

function TimeLogDialog({ ticketId, open, onClose }: { ticketId: string; open: boolean; onClose: () => void }) {
  const [minutes, setMinutes] = useState('30');
  const [note, setNote] = useState('');
  const [billable, setBillable] = useState(false);
  const utils = api.useUtils();

  const logMutation = api.helpdesk.ticketsV2.logTime.useMutation({
    onSuccess: () => { toast.success('Time logged'); void utils.helpdesk.ticketsV2.get.invalidate({ id: ticketId }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
        <h3 className="font-semibold text-lg">Log Time</h3>
        <div>
          <label className="block text-sm font-medium mb-1.5">Minutes *</label>
          <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded" />
          Billable
        </label>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={() => logMutation.mutate({ ticket_id: ticketId, minutes: parseInt(minutes, 10), is_billable: billable, note: note || undefined })}
            disabled={logMutation.isPending || !minutes}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
            {logMutation.isPending ? 'Logging…' : 'Log Time'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Merge Dialog ------------------------------------------------------------

function MergeDialog({ sourceId, ticketNumber, open, onClose }: { sourceId: string; ticketNumber: string; open: boolean; onClose: () => void }) {
  const [targetId, setTargetId] = useState('');
  const utils = api.useUtils();

  const { data: search } = api.helpdesk.ticketsV2.list.useQuery({ search: targetId, limit: 5, page: 1 }, { enabled: targetId.length > 2 });

  const mergeMutation = api.helpdesk.ticketsV2.merge.useMutation({
    onSuccess: () => { toast.success('Tickets merged'); void utils.helpdesk.ticketsV2.get.invalidate({ id: sourceId }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4">
        <h3 className="font-semibold text-lg">Merge {ticketNumber}</h3>
        <p className="text-sm text-muted-foreground">This ticket will be merged into the target ticket. All replies will be moved.</p>
        <div>
          <label className="block text-sm font-medium mb-1.5">Search target ticket</label>
          <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Search by subject or TKT number…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        {search?.items.filter((t) => t.id !== sourceId).slice(0, 5).map((t) => (
          <button key={t.id} onClick={() => mergeMutation.mutate({ source_id: sourceId, target_id: t.id })}
            disabled={mergeMutation.isPending}
            className="w-full text-left flex items-center justify-between px-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">
            <div>
              <p className="font-medium text-sm">{t.subject}</p>
              <p className="text-xs text-muted-foreground">{t.ticket_number}</p>
            </div>
            <Merge className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// -- Ticket Detail Page -------------------------------------------------------

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [replyContent, setReplyContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [timeLogOpen, setTimeLogOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const utils = api.useUtils();

  const { data: ticket, isLoading } = api.helpdesk.ticketsV2.get.useQuery({ id });

  const replyMutation = api.helpdesk.ticketsV2.reply.useMutation({
    onSuccess: () => { toast.success('Reply sent'); setReplyContent(''); void utils.helpdesk.ticketsV2.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const resolveMutation = api.helpdesk.ticketsV2.resolve.useMutation({
    onSuccess: () => { toast.success('Ticket resolved'); void utils.helpdesk.ticketsV2.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const closeMutation = api.helpdesk.ticketsV2.close.useMutation({
    onSuccess: () => { toast.success('Ticket closed'); void utils.helpdesk.ticketsV2.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const reopenMutation = api.helpdesk.ticketsV2.reopen.useMutation({
    onSuccess: () => { toast.success('Ticket reopened'); void utils.helpdesk.ticketsV2.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = api.helpdesk.ticketsV2.update.useMutation({
    onSuccess: () => { toast.success('Updated'); void utils.helpdesk.ticketsV2.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl" />)}</div>
          <div className="h-96 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-medium">Ticket not found</p>
        <Link href="/helpdesk/tickets" className="text-brand-500 hover:underline text-sm">Back to Tickets</Link>
      </div>
    );
  }

  const isClosed = ['resolved', 'closed'].includes(ticket.status);
  const totalTimeHours = ticket.time_tracked_minutes ? `${Math.floor(ticket.time_tracked_minutes / 60)}h ${ticket.time_tracked_minutes % 60}m` : '0m';

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/helpdesk/tickets" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{ticket.ticket_number}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[ticket.status] ?? '')}>{ticket.status.replace('_', ' ')}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', PRIORITY_COLORS[ticket.priority] ?? '')}>{ticket.priority}</span>
            {ticket.sla_status && ticket.sla_status !== 'ok' && <SlaStatusBadge slaStatus={ticket.sla_status} />}
          </div>
          <h1 className="text-xl font-bold mt-1 truncate">{ticket.subject}</h1>
        </div>
        {/* Actions menu */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMergeOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors">
            <Merge className="w-3.5 h-3.5" /> Merge
          </button>
          <button onClick={() => setTimeLogOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors">
            <Timer className="w-3.5 h-3.5" /> Log Time
          </button>
        </div>
      </div>

      {/* SLA Timers */}
      {(ticket.first_response_due_at ?? ticket.resolution_due_at) && (
        <div className="flex items-center gap-3 flex-wrap">
          {ticket.first_response_due_at && (
            <SlaTimer dueAt={ticket.first_response_due_at} completedAt={ticket.first_responded_at} label="First Response" />
          )}
          {ticket.resolution_due_at && (
            <SlaTimer dueAt={ticket.resolution_due_at} completedAt={ticket.resolved_at} label="Resolution" />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main thread */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original description */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: generateAvatarColor(ticket.requester_name ?? ticket.requester_email ?? 'U') }}>
                {getInitials(ticket.requester_name ?? ticket.requester_email ?? 'U')}
              </div>
              <div>
                <p className="font-medium text-sm">{ticket.requester_name ?? ticket.requester_email ?? 'Customer'}</p>
                <p className="text-xs text-muted-foreground">{formatDate(ticket.created_at, 'MMM d, yyyy HH:mm')}</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">{ticket.channel}</span>
            </div>
            {ticket.description
              ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
              : <p className="text-sm text-muted-foreground italic">No description provided.</p>}
          </div>

          {/* Replies */}
          {ticket.replies.map((reply) => (
            <div key={reply.id} className={cn('border rounded-2xl p-5',
              reply.reply_type === 'note' || !reply.is_public
                ? 'bg-yellow-50/50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800'
                : reply.reply_type === 'system'
                  ? 'bg-muted/30 border-border'
                  : 'bg-card border-border')}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: generateAvatarColor(reply.created_by ?? reply.from_email ?? 'A') }}>
                  {getInitials(reply.from_name ?? 'A')}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{reply.from_name ?? (reply.created_by ? 'Agent' : 'Customer')}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(reply.created_at, 'MMM d, yyyy HH:mm')}</p>
                </div>
                {reply.reply_type === 'note' ? (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Internal Note
                  </span>
                ) : reply.reply_type === 'system' ? (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">System</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reply.body}</p>
            </div>
          ))}

          {/* CSAT rating */}
          {ticket.satisfaction_rating && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-medium text-sm">Customer Satisfaction</span>
              </div>
              <div className="flex items-center gap-2">
                {[1,2,3,4,5].map((star) => (
                  <Star key={star} className={cn('w-5 h-5', star <= Math.round((ticket.satisfaction_rating ?? 0) / 2) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground')} />
                ))}
                <span className="text-sm font-medium">{ticket.satisfaction_rating}/10</span>
              </div>
              {ticket.satisfaction_comment && <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{ticket.satisfaction_comment}&rdquo;</p>}
            </div>
          )}

          {/* Reply box */}
          {!isClosed && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Add Reply</span>
                <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  <button onClick={() => setIsInternal(false)}
                    className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1', !isInternal ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}>
                    <Globe className="w-3 h-3" /> Public
                  </button>
                  <button onClick={() => setIsInternal(true)}
                    className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1', isInternal ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 shadow' : 'text-muted-foreground')}>
                    <Lock className="w-3 h-3" /> Note
                  </button>
                </div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (!replyContent.trim()) return; replyMutation.mutate({ ticket_id: id, body: replyContent, reply_type: isInternal ? 'note' : 'reply', is_public: !isInternal }); }}>
                <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={5}
                  placeholder={isInternal ? 'Write an internal note…' : 'Write a reply to the customer…'}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" />
                <div className="flex justify-end mt-3">
                  <button type="submit" disabled={!replyContent.trim() || replyMutation.isPending}
                    className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    <Send className="w-4 h-4" />
                    {replyMutation.isPending ? 'Sending…' : isInternal ? 'Add Note' : 'Send Reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">Actions</h3>
            <div className="space-y-2">
              {!isClosed && (
                <button onClick={() => resolveMutation.mutate({ id })} disabled={resolveMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  {resolveMutation.isPending ? 'Resolving…' : 'Mark Resolved'}
                </button>
              )}
              {!isClosed && (
                <button onClick={() => closeMutation.mutate({ id })} disabled={closeMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 border border-border hover:bg-muted disabled:opacity-50 px-3 py-2 rounded-lg text-sm font-medium">
                  <XCircle className="w-4 h-4" />
                  {closeMutation.isPending ? 'Closing…' : 'Close Ticket'}
                </button>
              )}
              {isClosed && (
                <button onClick={() => reopenMutation.mutate({ id })} disabled={reopenMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 border border-border hover:bg-muted disabled:opacity-50 px-3 py-2 rounded-lg text-sm font-medium">
                  <RefreshCw className="w-4 h-4" />
                  {reopenMutation.isPending ? 'Reopening…' : 'Reopen Ticket'}
                </button>
              )}
            </div>
          </div>

          {/* Update Status */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">Status & Priority</h3>
            <div className="space-y-2">
              <select value={ticket.status} onChange={(e) => updateMutation.mutate({ id, status: e.target.value as never })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                {['open', 'in_progress', 'pending', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <select value={ticket.priority} onChange={(e) => updateMutation.mutate({ id, priority: e.target.value as never })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
            <h3 className="font-semibold text-sm">Details</h3>
            {[
              { label: 'Type', value: ticket.type.replace('_', ' ') },
              { label: 'Channel', value: ticket.channel },
              { label: 'Created', value: formatDate(ticket.created_at, 'MMM d, yyyy HH:mm') },
              { label: 'First Response', value: ticket.first_responded_at ? formatDate(ticket.first_responded_at, 'MMM d, yyyy HH:mm') : 'Not yet' },
              ...(ticket.resolved_at ? [{ label: 'Resolved', value: formatDate(ticket.resolved_at, 'MMM d, yyyy HH:mm') }] : []),
              ...(ticket.category ? [{ label: 'Category', value: ticket.category.name }] : []),
              ...(ticket.team ? [{ label: 'Team', value: ticket.team.name }] : []),
              ...(ticket.sla_policy ? [{ label: 'SLA Policy', value: ticket.sla_policy.name }] : []),
              { label: 'Reopen Count', value: String(ticket.reopen_count) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="font-medium text-right capitalize">{value}</span>
              </div>
            ))}
          </div>

          {/* Time Tracking */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Time Tracked</h3>
              <button onClick={() => setTimeLogOpen(true)} className="text-xs text-brand-500 hover:underline">+ Log</button>
            </div>
            <p className="text-2xl font-bold">{totalTimeHours}</p>
            {ticket.time_logs.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {ticket.time_logs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex justify-between text-xs text-muted-foreground">
                    <span>{log.note ?? 'Work'}</span>
                    <span>{log.minutes}m · {timeAgo(log.logged_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Merged / Related tickets */}
          {(ticket.merged_tickets.length > 0 || ticket.child_tickets.length > 0) && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">Related Tickets</h3>
              {ticket.merged_tickets.map((t) => (
                <Link key={t.id} href={`/helpdesk/tickets/${t.id}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1">
                  <Merge className="w-3.5 h-3.5" />
                  <span>{t.ticket_number}</span>
                  <span className="truncate">{t.subject}</span>
                </Link>
              ))}
              {ticket.child_tickets.map((t) => (
                <Link key={t.id} href={`/helpdesk/tickets/${t.id}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1">
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{t.ticket_number}</span>
                  <span className="truncate">{t.subject}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Tags */}
          {ticket.tags.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {ticket.tags.map((tag) => <span key={tag} className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{tag}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      <TimeLogDialog ticketId={id} open={timeLogOpen} onClose={() => setTimeLogOpen(false)} />
      <MergeDialog sourceId={id} ticketNumber={ticket.ticket_number} open={mergeOpen} onClose={() => setMergeOpen(false)} />
    </div>
  );
}
