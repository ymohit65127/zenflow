// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Shield, Clock, Star, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PolicyForm = {
  name: string;
  description: string;
  is_default: boolean;
  first_response_hours: { low: number; medium: number; high: number; urgent: number };
  resolution_hours: { low: number; medium: number; high: number; urgent: number };
  is_active: boolean;
};

const defaultPolicy: PolicyForm = {
  name: '',
  description: '',
  is_default: false,
  first_response_hours: { low: 8, medium: 4, high: 2, urgent: 1 },
  resolution_hours: { low: 72, medium: 24, high: 8, urgent: 4 },
  is_active: true,
};

function PolicyDialog({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: string | null }) {
  const [form, setForm] = useState<PolicyForm>(defaultPolicy);
  const utils = api.useUtils();

  const createMutation = api.helpdesk.slaV2.createPolicy.useMutation({
    onSuccess: () => { toast.success('SLA policy created'); void utils.helpdesk.slaV2.listPolicies.invalidate(); onClose(); setForm(defaultPolicy); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = api.helpdesk.slaV2.updatePolicy.useMutation({
    onSuccess: () => { toast.success('SLA policy updated'); void utils.helpdesk.slaV2.listPolicies.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) { updateMutation.mutate({ id: editingId, ...form }); }
    else { createMutation.mutate(form); }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const priorities = ['low', 'medium', 'high', 'urgent'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit SLA Policy' : 'New SLA Policy'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Policy Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Standard SLA, Premium SLA…" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-sm">First Response Hours (per priority)</h3>
            <div className="grid grid-cols-4 gap-3">
              {priorities.map((p) => (
                <div key={p}>
                  <label className="block text-xs text-muted-foreground mb-1 capitalize">{p}</label>
                  <input type="number" min="0.25" step="0.25" value={form.first_response_hours[p]}
                    onChange={(e) => setForm((f) => ({ ...f, first_response_hours: { ...f.first_response_hours, [p]: parseFloat(e.target.value) } }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-sm">Resolution Hours (per priority)</h3>
            <div className="grid grid-cols-4 gap-3">
              {priorities.map((p) => (
                <div key={p}>
                  <label className="block text-xs text-muted-foreground mb-1 capitalize">{p}</label>
                  <input type="number" min="0.25" step="0.25" value={form.resolution_hours[p]}
                    onChange={(e) => setForm((f) => ({ ...f, resolution_hours: { ...f.resolution_hours, [p]: parseFloat(e.target.value) } }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} className="rounded" />
              Set as default policy
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SlaPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: policies, isLoading } = api.helpdesk.slaV2.listPolicies.useQuery();
  const { data: businessHours } = api.helpdesk.slaV2.listBusinessHours.useQuery();

  const deleteMutation = api.helpdesk.slaV2.deletePolicy.useMutation({
    onSuccess: () => { toast.success('Policy deleted'); void utils.helpdesk.slaV2.listPolicies.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const setDefaultMutation = api.helpdesk.slaV2.setDefault.useMutation({
    onSuccess: () => { toast.success('Default updated'); void utils.helpdesk.slaV2.listPolicies.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };
  const openCreate = () => { setEditingId(null); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">SLA Policies</h1>
          <p className="text-muted-foreground mt-1">Configure service level agreements and business hours</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Policy
        </button>
      </div>

      {/* Policies */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : !policies?.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No SLA policies yet</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Create First Policy
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => {
            const frHours = policy.first_response_hours as Record<string, number>;
            const resHours = policy.resolution_hours as Record<string, number>;
            return (
              <div key={policy.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{policy.name}</h3>
                        {policy.is_default && <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs font-medium"><Star className="w-3 h-3" /> Default</span>}
                        {!policy.is_active && <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">Inactive</span>}
                      </div>
                      {policy.description && <p className="text-sm text-muted-foreground mt-0.5">{policy.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!policy.is_default && (
                      <button onClick={() => setDefaultMutation.mutate({ id: policy.id })} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 border border-border rounded-lg hover:bg-muted transition-colors">
                        Set Default
                      </button>
                    )}
                    <button onClick={() => openEdit(policy.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm('Delete this SLA policy?')) deleteMutation.mutate({ id: policy.id }); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">First Response</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                        <div key={p} className="text-center">
                          <p className="text-xs text-muted-foreground capitalize">{p}</p>
                          <p className="font-semibold text-sm">{frHours[p] ?? '—'}h</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Resolution</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                        <div key={p} className="text-center">
                          <p className="text-xs text-muted-foreground capitalize">{p}</p>
                          <p className="font-semibold text-sm">{resHours[p] ?? '—'}h</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Business Hours */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Business Hours</h2>
          </div>
        </div>
        {!businessHours?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No business hours configured yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {businessHours.map((bh) => (
              <div key={bh.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{bh.name}</p>
                  <p className="text-sm text-muted-foreground">{bh.timezone}</p>
                </div>
                {!bh.is_active && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Inactive</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <PolicyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingId={editingId} />
    </div>
  );
}
