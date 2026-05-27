// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Mail, Pencil, Trash2, ToggleLeft, ToggleRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type InboxForm = { name: string; email_address: string; provider: 'gmail' | 'outlook' | 'other'; default_priority: 'low' | 'medium' | 'high' | 'urgent'; team_id: string; is_active: boolean };
const defaultForm: InboxForm = { name: '', email_address: '', provider: 'other', default_priority: 'medium', team_id: '', is_active: true };

function InboxDialog({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: string | null }) {
  const [form, setForm] = useState<InboxForm>(defaultForm);
  const utils = api.useUtils();
  const { data: teams } = api.helpdesk.teams.list.useQuery();
  const createMutation = api.helpdesk.emailInbox.create.useMutation({
    onSuccess: () => { toast.success('Inbox connected'); void utils.helpdesk.emailInbox.list.invalidate(); onClose(); setForm(defaultForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = api.helpdesk.emailInbox.update.useMutation({
    onSuccess: () => { toast.success('Inbox updated'); void utils.helpdesk.emailInbox.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  if (!open) return null;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const set = (k: keyof InboxForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Inbox' : 'Connect Email Inbox'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const payload = { ...form, team_id: form.team_id || undefined }; if (editingId) updateMutation.mutate({ id: editingId, ...payload }); else createMutation.mutate(payload); }} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Display Name *</label>
            <input required value={form.name} onChange={set('name')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Support Inbox" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Email Address *</label>
            <input required type="email" value={form.email_address} onChange={set('email_address')} disabled={!!editingId}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-60" placeholder="support@yourdomain.com" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1.5">Provider</label>
              <select value={form.provider} onChange={set('provider')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="other">Other (IMAP)</option>
              </select></div>
            <div><label className="block text-sm font-medium mb-1.5">Default Priority</label>
              <select value={form.default_priority} onChange={set('default_priority')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select></div>
          </div>
          <div><label className="block text-sm font-medium mb-1.5">Assign to Team</label>
            <select value={form.team_id} onChange={set('team_id')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">— No team —</option>
              {teams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" /> Active
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {isPending ? 'Saving…' : editingId ? 'Save' : 'Connect Inbox'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PROVIDER_ICONS: Record<string, string> = { gmail: '📧', outlook: '📬', other: '📮' };

export default function InboxesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: inboxes, isLoading } = api.helpdesk.emailInbox.list.useQuery();

  const deleteMutation = api.helpdesk.emailInbox.delete.useMutation({
    onSuccess: () => { toast.success('Inbox disconnected'); void utils.helpdesk.emailInbox.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = api.helpdesk.emailInbox.toggleActive.useMutation({
    onSuccess: () => void utils.helpdesk.emailInbox.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };
  const openCreate = () => { setEditingId(null); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Email Inboxes</h1>
          <p className="text-muted-foreground mt-1">Connect email accounts to receive tickets</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Connect Inbox
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : !inboxes?.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Mail className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No email inboxes connected</p>
          <p className="text-sm text-muted-foreground mt-1">Connect Gmail, Outlook, or a custom IMAP account</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Connect First Inbox</button>
        </div>
      ) : (
        <div className="space-y-3">
          {inboxes.map((inbox) => (
            <div key={inbox.id} className={cn('bg-card border border-border rounded-2xl p-5 group', !inbox.is_active && 'opacity-60')}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
                  {PROVIDER_ICONS[inbox.provider] ?? '📮'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{inbox.name}</p>
                    {inbox.is_active ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Inactive</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{inbox.email_address}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {inbox.team && <span>Team: {inbox.team.name}</span>}
                    <span className="capitalize">Priority: {inbox.default_priority}</span>
                    {inbox.last_synced_at && <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {new Date(inbox.last_synced_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleMutation.mutate({ id: inbox.id, is_active: !inbox.is_active })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                    {inbox.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(inbox.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm('Disconnect inbox?')) deleteMutation.mutate({ id: inbox.id }); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <InboxDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingId={editingId} />
    </div>
  );
}
