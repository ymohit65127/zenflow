'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Users, UserPlus, Trash2, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TeamForm = { name: string; description: string; email: string; auto_assign: 'none' | 'round_robin' | 'load_balanced'; is_active: boolean };
const defaultTeam: TeamForm = { name: '', description: '', email: '', auto_assign: 'none', is_active: true };

function TeamDialog({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: string | null }) {
  const [form, setForm] = useState<TeamForm>(defaultTeam);
  const utils = api.useUtils();
  const createMutation = api.helpdesk.teams.create.useMutation({
    onSuccess: () => { toast.success('Team created'); void utils.helpdesk.teams.list.invalidate(); onClose(); setForm(defaultTeam); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = api.helpdesk.teams.update.useMutation({
    onSuccess: () => { toast.success('Team updated'); void utils.helpdesk.teams.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  if (!open) return null;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const set = (k: keyof TeamForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Team' : 'New Team'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (editingId) updateMutation.mutate({ id: editingId, ...form }); else createMutation.mutate(form); }} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Team Name *</label>
            <input required value={form.name} onChange={set('name')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Customer Support" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Team Email</label>
            <input type="email" value={form.email} onChange={set('email')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="support@example.com" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Auto-Assign</label>
            <select value={form.auto_assign} onChange={set('auto_assign')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="none">Manual</option>
              <option value="round_robin">Round Robin</option>
              <option value="load_balanced">Load Balanced</option>
            </select></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" /> Active
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: teams, isLoading } = api.helpdesk.teams.list.useQuery();

  const deleteMutation = api.helpdesk.teams.delete.useMutation({
    onSuccess: () => { toast.success('Team deleted'); void utils.helpdesk.teams.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };
  const openCreate = () => { setEditingId(null); setDialogOpen(true); };

  const AUTO_ASSIGN_LABELS: Record<string, string> = { none: 'Manual', round_robin: 'Round Robin', load_balanced: 'Load Balanced' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-1">Manage support teams and agent assignments</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Team
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : !teams?.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No teams yet</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Create First Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-card border border-border rounded-2xl p-5 group">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-brand-500" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(team.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm('Delete team?')) deleteMutation.mutate({ id: team.id }); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h3 className="font-semibold">{team.name}</h3>
              {team.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{team.description}</p>}
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" />
                  {team._count.members} member{team._count.members !== 1 ? 's' : ''}
                </span>
                <span className="px-2 py-0.5 bg-muted rounded-full">{AUTO_ASSIGN_LABELS[team.auto_assign] ?? 'Manual'}</span>
                {!team.is_active && <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground">Inactive</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <TeamDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingId={editingId} />
    </div>
  );
}
