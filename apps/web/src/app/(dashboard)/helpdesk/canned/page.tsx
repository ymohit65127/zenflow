'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Search, MessageSquare, Pencil, Trash2, Hash } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CannedForm = { name: string; shortcut: string; content: string; is_shared: boolean };
const defaultForm: CannedForm = { name: '', shortcut: '', content: '', is_shared: true };

function CannedDialog({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: string | null }) {
  const [form, setForm] = useState<CannedForm>(defaultForm);
  const utils = api.useUtils();
  const createMutation = api.helpdesk.canned.create.useMutation({
    onSuccess: () => { toast.success('Canned response created'); void utils.helpdesk.canned.list.invalidate(); onClose(); setForm(defaultForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = api.helpdesk.canned.update.useMutation({
    onSuccess: () => { toast.success('Updated'); void utils.helpdesk.canned.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  if (!open) return null;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const set = (k: keyof CannedForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Response' : 'New Canned Response'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (editingId) updateMutation.mutate({ id: editingId, ...form }); else createMutation.mutate(form); }} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Name *</label>
            <input required value={form.name} onChange={set('name')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Thank you for reaching out" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Shortcut *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
              <input required value={form.shortcut} onChange={set('shortcut')} className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="thanks" />
            </div></div>
          <div><label className="block text-sm font-medium mb-1.5">Content *</label>
            <textarea required value={form.content} onChange={set('content')} rows={6} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" placeholder="Write your canned response here…" /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_shared} onChange={(e) => setForm((f) => ({ ...f, is_shared: e.target.checked }))} className="rounded" /> Share with all agents
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {isPending ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CannedPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const utils = api.useUtils();
  const { data: responses, isLoading } = api.helpdesk.canned.list.useQuery({ category: categoryFilter || undefined });
  const { data: categories } = api.helpdesk.canned.listCategories.useQuery();

  const deleteMutation = api.helpdesk.canned.delete.useMutation({
    onSuccess: () => { toast.success('Deleted'); void utils.helpdesk.canned.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = responses?.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.shortcut ?? '').toLowerCase().includes(search.toLowerCase()));

  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };
  const openCreate = () => { setEditingId(null); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Canned Responses</h1>
          <p className="text-muted-foreground mt-1">Quick reply templates for common questions</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Response
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search responses…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Categories</option>
          {categories?.map((c) => <option key={c} value={c ?? ''}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : !filtered?.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">{search ? 'No responses match your search' : 'No canned responses yet'}</p>
          {!search && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Create First Response</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-5 group hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                      <Hash className="w-3 h-3" />{r.shortcut ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(r.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate({ id: r.id }); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{r.content}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span></span>
                {!r.is_shared && <span className="px-2 py-0.5 bg-muted rounded">Private</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <CannedDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingId={editingId} />
    </div>
  );
}
