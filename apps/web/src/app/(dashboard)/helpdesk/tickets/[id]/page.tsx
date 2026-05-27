'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Send, Lock, Globe, CheckCircle, XCircle,
  MessageSquare, AlertCircle,
} from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo, getInitials, generateAvatarColor } from '@/lib/utils';
import { toast } from 'sonner';

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  IN_PROGRESS: 'bg-brand-500/10 text-brand-500',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  RESOLVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  CLOSED: 'bg-gray-200 text-gray-500 dark:bg-gray-800/80 dark:text-gray-500',
};

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [replyContent, setReplyContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const utils = api.useUtils();

  const { data: ticket, isLoading } = api.helpdesk.tickets.get.useQuery({ id });

  const replyMutation = api.helpdesk.tickets.reply.useMutation({
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyContent('');
      void utils.helpdesk.tickets.get.invalidate({ id });
    },
    onError: (err) => toast.error(err.message),
  });

  const resolveMutation = api.helpdesk.tickets.resolve.useMutation({
    onSuccess: () => {
      toast.success('Ticket resolved');
      void utils.helpdesk.tickets.get.invalidate({ id });
      void utils.helpdesk.tickets.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const closeMutation = api.helpdesk.tickets.close.useMutation({
    onSuccess: () => {
      toast.success('Ticket closed');
      void utils.helpdesk.tickets.get.invalidate({ id });
      void utils.helpdesk.tickets.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.helpdesk.tickets.update.useMutation({
    onSuccess: () => {
      toast.success('Ticket updated');
      void utils.helpdesk.tickets.get.invalidate({ id });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    replyMutation.mutate({ ticket_id: id, content: replyContent, is_internal: isInternal });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div className="h-40 bg-muted rounded-2xl" />
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-2xl" />)}
          </div>
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
        <Link href="/helpdesk" className="text-brand-500 hover:underline text-sm">Back to Help Desk</Link>
      </div>
    );
  }

  const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{ticket.ticket_number}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[ticket.status] ?? '')}>
              {ticket.status.replace('_', ' ')}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[ticket.priority] ?? '')}>
              {ticket.priority}
            </span>
          </div>
          <h1 className="text-xl font-bold mt-1 truncate">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original description */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                style={{ backgroundColor: generateAvatarColor(ticket.creator.name) }}
              >
                {getInitials(ticket.creator.name)}
              </div>
              <div>
                <p className="font-medium text-sm">{ticket.creator.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(ticket.created_at, 'MMM d, yyyy HH:mm')}</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Original</span>
            </div>
            {ticket.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description provided.</p>
            )}
          </div>

          {/* Replies */}
          {ticket.replies.map((reply) => (
            <div
              key={reply.id}
              className={cn(
                'border rounded-2xl p-5',
                reply.is_internal
                  ? 'bg-yellow-50/50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800'
                  : 'bg-card border-border',
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                  style={{ backgroundColor: generateAvatarColor(reply.user_id) }}
                >
                  {reply.user_id.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Agent</p>
                  <p className="text-xs text-muted-foreground">{formatDate(reply.created_at, 'MMM d, yyyy HH:mm')}</p>
                </div>
                {reply.is_internal ? (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Internal Note
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    <Globe className="w-3 h-3" /> Public Reply
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reply.content}</p>
            </div>
          ))}

          {/* Reply box */}
          {!isResolved && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Add Reply</span>
                <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  <button
                    onClick={() => setIsInternal(false)}
                    className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1', !isInternal ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <Globe className="w-3 h-3" /> Public
                  </button>
                  <button
                    onClick={() => setIsInternal(true)}
                    className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1', isInternal ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 shadow' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <Lock className="w-3 h-3" /> Internal
                  </button>
                </div>
              </div>
              <form onSubmit={handleReply}>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={5}
                  placeholder={isInternal ? 'Write an internal note (not visible to customer)…' : 'Write a reply to the customer…'}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                />
                <div className="flex justify-end mt-3">
                  <button
                    type="submit"
                    disabled={!replyContent.trim() || replyMutation.isPending}
                    className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
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
              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                <button
                  onClick={() => resolveMutation.mutate({ id })}
                  disabled={resolveMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  {resolveMutation.isPending ? 'Resolving…' : 'Mark Resolved'}
                </button>
              )}
              {ticket.status !== 'CLOSED' && (
                <button
                  onClick={() => closeMutation.mutate({ id })}
                  disabled={closeMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 border border-border hover:bg-muted disabled:opacity-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  {closeMutation.isPending ? 'Closing…' : 'Close Ticket'}
                </button>
              )}
            </div>
          </div>

          {/* Change Status */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">Update Status</h3>
            <select
              value={ticket.status}
              onChange={(e) => updateMutation.mutate({ id, status: e.target.value as 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED' })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Change Priority */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">Priority</h3>
            <select
              value={ticket.priority}
              onChange={(e) => updateMutation.mutate({ id, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Ticket Info */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Details</h3>
            <div className="space-y-2.5">
              <InfoRow label="Type" value={ticket.type.replace('_', ' ')} />
              <InfoRow label="Channel" value={ticket.channel} />
              <InfoRow label="Created" value={formatDate(ticket.created_at, 'MMM d, yyyy HH:mm')} />
              <InfoRow
                label="First Response"
                value={ticket.first_response_at ? formatDate(ticket.first_response_at, 'MMM d, yyyy HH:mm') : 'Not yet'}
              />
              {ticket.resolved_at && <InfoRow label="Resolved" value={formatDate(ticket.resolved_at, 'MMM d, yyyy HH:mm')} />}
              {ticket.due_at && (
                <InfoRow
                  label="Due"
                  value={formatDate(ticket.due_at, 'MMM d, yyyy HH:mm')}
                  valueClass={new Date(ticket.due_at) < new Date() ? 'text-red-500 font-medium' : ''}
                />
              )}
              {ticket.category && (
                <InfoRow label="Category" value={ticket.category.name} />
              )}
              {ticket.sla_policy && (
                <InfoRow label="SLA" value={ticket.sla_policy.name} />
              )}
            </div>
          </div>

          {/* Assignees */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Assignees</h3>
            </div>
            {ticket.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Unassigned</p>
            ) : (
              <div className="space-y-2">
                {ticket.assignments.map((a) => (
                  <div key={a.user.id} className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: generateAvatarColor(a.user.name) }}
                    >
                      {getInitials(a.user.name)}
                    </div>
                    <span className="text-sm">{a.user.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          {ticket.tags.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {ticket.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('font-medium text-right', valueClass)}>{value}</span>
    </div>
  );
}
