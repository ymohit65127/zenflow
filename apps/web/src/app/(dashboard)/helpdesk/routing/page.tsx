// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Zap, GripVertical, Pencil, Trash2, ToggleLeft, ToggleRight, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Condition = { field: string; operator: string; value: string };
type Action = { action: string; value: string };
type RuleForm = { name: string; priority: number; conditions: Condition[]; actions: Action[]; is_active: boolean };

const defaultRule: RuleForm = {
  name: '',
  priority: 0,
  conditions: [{ field: 'channel', operator: 'is', value: '' }],
  actions: [{ action: 'assign_team', value: '' }],
  is_active: true,
};

const CONDITION_FIELDS = ['channel', 'priority', 'subject', 'email_domain', 'category_id', 'requester_email', 'tags'];
const CONDITION_OPERATORS = ['is', 'is_not', 'contains', 'matches', 'starts_with'];
const ACTION_TYPES = ['assign_team', 'assign_agent', 'set_priority', 'set_category', 'add_tag', 'set_sla'];

function RuleDialog({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: string | null }) {
  const [form, setForm] = useState<RuleForm>(defaultRule);
  const utils = api.useUtils();
  const createMutation = api.helpdesk.routing.createRule.useMutation({
    onSuccess: () => { toast.success('Rule created'); void utils.helpdesk.routing.listRules.invalidate(); onClose(); setForm(defaultRule); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = api.helpdesk.routing.updateRule.useMutation({
    onSuccess: () => { toast.success('Rule updated'); void utils.helpdesk.routing.listRules.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const addCondition = () => setForm((f) => ({ ...f, conditions: [...f.conditions, { field: 'channel', operator: 'is', value: '' }] }));
  const removeCondition = (i: number) => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition = (i: number, k: keyof Condition, v: string) => setForm((f) => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [k]: v } : c) }));

  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { action: 'assign_team', value: '' }] }));
  const removeAction = (i: number) => setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction = (i: number, k: keyof Action, v: string) => setForm((f) => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, [k]: v } : a) }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Rule' : 'New Routing Rule'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const payload = { ...form, conditions: form.conditions.map((c) => ({ ...c, value: c.value })), actions: form.actions.map((a) => ({ ...a, value: a.value })) }; if (editingId) updateMutation.mutate({ id: editingId, ...payload }); else createMutation.mutate(payload as never); }} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium mb-1.5">Rule Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Route billing tickets to finance team" /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Conditions (ALL must match)</h3>
              <button type="button" onClick={addCondition} className="text-xs text-brand-500 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            <div className="space-y-2">
              {form.conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={cond.field} onChange={(e) => updateCondition(i, 'field', e.target.value)}
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 flex-1">
                    {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
                  </select>
                  <select value={cond.operator} onChange={(e) => updateCondition(i, 'operator', e.target.value)}
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 flex-1">
                    {CONDITION_OPERATORS.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                  </select>
                  <input value={cond.value} onChange={(e) => updateCondition(i, 'value', e.target.value)} placeholder="value"
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 flex-1" />
                  <button type="button" onClick={() => removeCondition(i)} className="p-1.5 text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Actions</h3>
              <button type="button" onClick={addAction} className="text-xs text-brand-500 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            <div className="space-y-2">
              {form.actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={action.action} onChange={(e) => updateAction(i, 'action', e.target.value)}
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 flex-1">
                    {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input value={action.value} onChange={(e) => updateAction(i, 'value', e.target.value)} placeholder="value (team ID, priority, etc.)"
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 flex-1" />
                  <button type="button" onClick={() => removeAction(i)} className="p-1.5 text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" /> Active
          </label>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RoutingPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: rules, isLoading } = api.helpdesk.routing.listRules.useQuery();

  const deleteMutation = api.helpdesk.routing.deleteRule.useMutation({
    onSuccess: () => { toast.success('Rule deleted'); void utils.helpdesk.routing.listRules.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = api.helpdesk.routing.toggleRule.useMutation({
    onSuccess: () => void utils.helpdesk.routing.listRules.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };
  const openCreate = () => { setEditingId(null); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Routing Rules</h1>
          <p className="text-muted-foreground mt-1">Automatically route incoming tickets based on conditions</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : !rules?.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Zap className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No routing rules yet</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => {
            const conditions = rule.conditions as Condition[];
            const actions = rule.actions as Action[];
            return (
              <div key={rule.id} className={cn('bg-card border border-border rounded-2xl p-4 group', !rule.is_active && 'opacity-60')}>
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      {!rule.is_active && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {conditions.slice(0, 2).map((c, i) => (
                        <span key={i} className="bg-muted px-2 py-0.5 rounded">{c.field} {c.operator} &quot;{c.value}&quot;</span>
                      ))}
                      {conditions.length > 2 && <span>+{conditions.length - 2} more</span>}
                      <span className="text-muted-foreground">→</span>
                      {actions.slice(0, 2).map((a, i) => (
                        <span key={i} className="bg-brand-500/10 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded">{a.action.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-muted-foreground">{rule.match_count} matches</span>
                    <button onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                      {rule.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(rule.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Delete rule?')) deleteMutation.mutate({ id: rule.id }); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RuleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingId={editingId} />
    </div>
  );
}
