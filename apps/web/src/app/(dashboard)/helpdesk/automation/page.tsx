'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Settings, Pencil, Trash2, ToggleLeft, ToggleRight, PlayCircle, Clock } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

const TRIGGER_EVENTS = ['ticket_created', 'ticket_updated', 'ticket_assigned', 'sla_breached', 'reply_received', 'ticket_resolved', 'ticket_closed'] as const;
const TRIGGER_LABELS: Record<string, string> = {
  ticket_created: 'Ticket Created',
  ticket_updated: 'Ticket Updated',
  ticket_assigned: 'Ticket Assigned',
  sla_breached: 'SLA Breached',
  reply_received: 'Reply Received',
  ticket_resolved: 'Ticket Resolved',
  ticket_closed: 'Ticket Closed',
};

const ACTION_TYPES = ['close_ticket', 'change_status', 'assign_team', 'assign_agent', 'add_tag', 'send_email', 'notify_agent'];

type Condition = { field: string; operator: "contains" | "is" | "is_not" | "matches" | "starts_with"; value: string };
type Action = { action: string; value: string };
type RuleForm = { name: string; trigger_event: typeof TRIGGER_EVENTS[number]; conditions: Condition[]; actions: Action[]; is_active: boolean };

const defaultRule: RuleForm = { name: '', trigger_event: 'ticket_created', conditions: [], actions: [{ action: 'add_tag', value: '' }], is_active: true };

function AutomationDialog({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: string | null }) {
  const [form, setForm] = useState<RuleForm>(defaultRule);
  const utils = api.useUtils();
  const createMutation = api.helpdesk.automation.createRule.useMutation({
    onSuccess: () => { toast.success('Automation created'); void utils.helpdesk.automation.listRules.invalidate(); onClose(); setForm(defaultRule); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = api.helpdesk.automation.updateRule.useMutation({
    onSuccess: () => { toast.success('Automation updated'); void utils.helpdesk.automation.listRules.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  if (!open) return null;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const addCondition = () => setForm((f) => ({ ...f, conditions: [...f.conditions, { field: 'channel', operator: 'is', value: '' }] }));
  const removeCondition = (i: number) => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition = (i: number, k: keyof Condition, v: string) => setForm((f) => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [k]: v } as Condition : c) }));
  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { action: 'add_tag', value: '' }] }));
  const removeAction = (i: number) => setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction = (i: number, k: keyof Action, v: string) => setForm((f) => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, [k]: v } : a) }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Automation' : 'New Automation Rule'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const { ...payload } = form; if (editingId) updateMutation.mutate({ id: editingId, ...payload }); else createMutation.mutate(payload); }} className="p-6 space-y-5">
          <div><label className="block text-sm font-medium mb-1.5">Rule Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Auto-close stale tickets" /></div>

          <div><label className="block text-sm font-medium mb-1.5">Trigger Event</label>
            <select value={form.trigger_event} onChange={(e) => setForm((f) => ({ ...f, trigger_event: e.target.value as typeof TRIGGER_EVENTS[number] }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              {TRIGGER_EVENTS.map((e) => <option key={e} value={e}>{TRIGGER_LABELS[e]}</option>)}
            </select></div>


          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Conditions (optional)</h3>
              <button type="button" onClick={addCondition} className="text-xs text-brand-500 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            <div className="space-y-2">
              {form.conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={cond.field} onChange={(e) => updateCondition(i, 'field', e.target.value)} placeholder="field"
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 flex-1" />
                  <select value={cond.operator} onChange={(e) => updateCondition(i, 'operator', e.target.value)}
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                    {['is', 'is_not', 'contains', 'matches'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input value={cond.value} onChange={(e) => updateCondition(i, 'value', e.target.value)} placeholder="value"
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 flex-1" />
                  <button type="button" onClick={() => removeCondition(i)} className="p-1.5 text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {form.conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions — rule applies to all tickets</p>}
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
                  <input value={action.value} onChange={(e) => updateAction(i, 'value', e.target.value)} placeholder="value"
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
              {isPending ? 'Saving…' : editingId ? 'Save' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AutomationPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: rules, isLoading } = api.helpdesk.automation.listRules.useQuery();

  const deleteMutation = api.helpdesk.automation.deleteRule.useMutation({
    onSuccess: () => { toast.success('Rule deleted'); void utils.helpdesk.automation.listRules.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = api.helpdesk.automation.toggleRule.useMutation({
    onSuccess: () => void utils.helpdesk.automation.listRules.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };
  const openCreate = () => { setEditingId(null); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Automation Rules</h1>
          <p className="text-muted-foreground mt-1">Event-triggered actions to automate repetitive tasks</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : !rules?.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Settings className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No automation rules yet</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Create First Rule</button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const conditions = (rule.conditions as { field: string; operator: string; value: unknown }[]) ?? [];
            const actions = (rule.actions as { action: string; value: unknown }[]) ?? [];
            return (
              <div key={rule.id} className={cn('bg-card border border-border rounded-2xl p-5 group', !rule.is_active && 'opacity-60')}>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                    <PlayCircle className="w-4.5 h-4.5 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{rule.name}</p>
                      {!rule.is_active && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="bg-brand-500/10 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded font-medium">When: {TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}</span>
                      {conditions.slice(0, 2).map((c, i) => <span key={i} className="bg-muted px-2 py-0.5 rounded">{c.field} {c.operator} &quot;{String(c.value)}&quot;</span>)}
                      {conditions.length > 2 && <span>+{conditions.length - 2} more</span>}
                      <span>→</span>
                      {actions.slice(0, 2).map((a, i) => <span key={i} className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">{a.action.replace(/_/g, ' ')}</span>)}
                    </div>
                    {(rule.runs_count > 0 || rule.last_run_at) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" /> {rule.runs_count} runs</span>
                        {rule.last_run_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last run {timeAgo(rule.last_run_at)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                      {rule.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(rule.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate({ id: rule.id }); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AutomationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingId={editingId} />
    </div>
  );
}
