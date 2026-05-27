'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { cn, formatCurrency, formatDate, getInitials, generateAvatarColor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  TrendingUp, Plus, Search, Pencil, Trash2, X,
  Calendar, ChevronRight, DollarSign,
} from 'lucide-react';

type DealStatus = 'OPEN' | 'WON' | 'LOST' | 'ON_HOLD';

interface DealFormState {
  pipeline_id: string;
  stage_id: string;
  name: string;
  value: string;
  probability: string;
  expected_close: string;
  notes: string;
  status: DealStatus;
  tags: string;
}

const emptyForm: DealFormState = {
  pipeline_id: '',
  stage_id: '',
  name: '',
  value: '',
  probability: '',
  expected_close: '',
  notes: '',
  status: 'OPEN',
  tags: '',
};

function DealStatusBadge({ status }: { status: DealStatus }) {
  const styles: Record<DealStatus, string> = {
    OPEN: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
    WON: 'bg-green-500/10 text-green-600 dark:text-green-400',
    LOST: 'bg-red-500/10 text-red-600 dark:text-red-400',
    ON_HOLD: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };
  const labels: Record<DealStatus, string> = { OPEN: 'Open', WON: 'Won', LOST: 'Lost', ON_HOLD: 'On Hold' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  );
}

type DealItem = {
  id: string;
  name: string;
  value: unknown;
  probability: unknown;
  expected_close: Date | null;
  status: DealStatus;
  tags: string[];
  notes: string | null;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  assignee_id: string | null;
  stage: { id: string; name: string; color: string; sort_order: number };
  pipeline: { id: string; name: string };
  contact: { id: string; first_name: string; last_name: string | null; email: string | null } | null;
  assignee: { id: string; name: string; avatar_url: string | null } | null;
};

function DealDetailPanel({ deal, onClose, onEdit }: {
  deal: DealItem;
  onClose: () => void;
  onEdit: () => void;
}) {
  const utils = api.useUtils();
  const { data: pipelines } = api.crm.pipeline.list.useQuery();
  const [newStageId, setNewStageId] = useState(deal.stage_id);

  const moveStage = api.crm.deals.moveStage.useMutation({
    onSuccess: () => { toast.success('Stage updated'); void utils.crm.deals.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const pipeline = pipelines?.find((p) => p.id === deal.pipeline_id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border-l border-border w-full max-w-sm h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-base truncate pr-4">{deal.name}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <DealStatusBadge status={deal.status} />
          </div>

          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Value</span>
              <span className="font-semibold text-green-600">{deal.value ? formatCurrency(Number(deal.value)) : '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Probability</span>
              <span className="font-medium">{deal.probability ? `${Number(deal.probability)}%` : '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Close Date</span>
              <span className="font-medium">{deal.expected_close ? formatDate(deal.expected_close) : '—'}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Pipeline Stage</p>
            <div className="text-sm font-medium mb-2">{deal.pipeline.name} → {deal.stage.name}</div>
            {pipeline && (
              <select
                value={newStageId}
                onChange={(e) => {
                  setNewStageId(e.target.value);
                  moveStage.mutate({ id: deal.id, stage_id: e.target.value });
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          {deal.contact && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Contact</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ backgroundColor: generateAvatarColor(deal.contact.id) }}>
                  {getInitials(`${deal.contact.first_name} ${deal.contact.last_name ?? ''}`)}
                </div>
                <div>
                  <p className="text-sm font-medium">{deal.contact.first_name} {deal.contact.last_name}</p>
                  {deal.contact.email && <p className="text-xs text-muted-foreground">{deal.contact.email}</p>}
                </div>
              </div>
            </div>
          )}

          {deal.assignee && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Assigned To</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ backgroundColor: generateAvatarColor(deal.assignee.id) }}>
                  {getInitials(deal.assignee.name)}
                </div>
                <p className="text-sm font-medium">{deal.assignee.name}</p>
              </div>
            </div>
          )}

          {deal.tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {deal.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 bg-muted rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {deal.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{deal.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DealFormDialog({ open, onClose, editId, initialValues, onSuccess }: {
  open: boolean;
  onClose: () => void;
  editId?: string;
  initialValues?: Partial<DealFormState>;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<DealFormState>({ ...emptyForm, ...initialValues });
  const utils = api.useUtils();
  const { data: pipelines } = api.crm.pipeline.list.useQuery();

  const create = api.crm.deals.create.useMutation({
    onSuccess: () => { toast.success('Deal created'); void utils.crm.deals.list.invalidate(); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  const update = api.crm.deals.update.useMutation({
    onSuccess: () => { toast.success('Deal updated'); void utils.crm.deals.list.invalidate(); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const set = (k: keyof DealFormState, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const selectedPipeline = pipelines?.find((p) => p.id === form.pipeline_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = {
      ...form,
      tags,
      value: form.value ? parseFloat(form.value) : undefined,
      probability: form.probability ? parseFloat(form.probability) : undefined,
      expected_close: form.expected_close || undefined,
    };
    if (editId) {
      update.mutate({ id: editId, ...payload });
    } else {
      create.mutate({ ...payload, pipeline_id: form.pipeline_id, stage_id: form.stage_id, name: form.name });
    }
  };

  if (!open) return null;
  const isLoading = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-semibold text-lg">{editId ? 'Edit Deal' : 'Add New Deal'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Deal Name <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="e.g. Annual Software License" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Pipeline <span className="text-red-500">*</span></label>
              <select required value={form.pipeline_id} onChange={(e) => { set('pipeline_id', e.target.value); set('stage_id', ''); }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">Select pipeline</option>
                {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Stage <span className="text-red-500">*</span></label>
              <select required value={form.stage_id} onChange={(e) => set('stage_id', e.target.value)}
                disabled={!form.pipeline_id}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50">
                <option value="">Select stage</option>
                {selectedPipeline?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Deal Value ($)</label>
              <input type="number" min={0} value={form.value} onChange={(e) => set('value', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="50000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Probability (%)</label>
              <input type="number" min={0} max={100} value={form.probability} onChange={(e) => set('probability', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected Close Date</label>
              <input type="date" value={form.expected_close} onChange={(e) => set('expected_close', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as DealStatus)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="OPEN">Open</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="enterprise, q1, priority" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="Notes about this deal..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {isLoading ? 'Saving...' : editId ? 'Update Deal' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DealsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DealStatus | ''>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<{ id: string; values: DealFormState } | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealItem | null>(null);
  const utils = api.useUtils();

  const { data: deals, isLoading } = api.crm.deals.list.useQuery({
    limit: 200,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const { data: pipelines } = api.crm.pipeline.list.useQuery();

  const deleteDealMutation = api.crm.deals.delete.useMutation({
    onSuccess: () => { toast.success('Deal deleted'); void utils.crm.deals.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // Group deals by pipeline stage
  const stageGroups = pipelines?.flatMap((pipeline) =>
    pipeline.stages.map((stage) => ({
      pipeline,
      stage,
      deals: (deals ?? []).filter((d) => d.stage_id === stage.id && d.pipeline_id === pipeline.id),
    }))
  ) ?? [];

  const openEdit = (d: DealItem) => {
    setEditDeal({
      id: d.id,
      values: {
        pipeline_id: d.pipeline_id,
        stage_id: d.stage_id,
        name: d.name,
        value: d.value ? String(d.value) : '',
        probability: d.probability ? String(d.probability) : '',
        expected_close: d.expected_close ? d.expected_close.toISOString().slice(0, 10) : '',
        notes: d.notes ?? '',
        status: d.status,
        tags: d.tags.join(', '),
      },
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-muted-foreground mt-1">Track deals in your sales pipeline</p>
        </div>
        <button
          onClick={() => { setEditDeal(null); setDialogOpen(true); }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Deal
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-0 border-b border-border">
        {[
          { href: '/crm', label: 'Overview' },
          { href: '/crm/contacts', label: 'Contacts' },
          { href: '/crm/leads', label: 'Leads' },
          { href: '/crm/deals', label: 'Deals', active: true },
          { href: '/crm/activities', label: 'Activities' },
        ].map((link) => (
          <Link key={link.href} href={link.href}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              link.active ? 'border-brand-500 text-brand-500' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border')}>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} type="search"
            placeholder="Search deals..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DealStatus | '')}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 sm:w-36">
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="WON">Won</option>
          <option value="LOST">Lost</option>
          <option value="ON_HOLD">On Hold</option>
        </select>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-72">
              <div className="h-8 w-32 bg-muted rounded-lg mb-3 animate-pulse" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="bg-card border border-border rounded-xl p-4 mb-3 animate-pulse space-y-2">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="h-3 w-28 bg-muted rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : !pipelines || pipelines.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-base mb-1">No pipelines configured</p>
          <p className="text-sm">Set up your first pipeline to start managing deals.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${stageGroups.length * 288 + (stageGroups.length - 1) * 16}px` }}>
            {stageGroups.map(({ pipeline, stage, deals: stageDeals }) => {
              const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
              return (
                <div key={`${pipeline.id}-${stage.id}`} className="flex-shrink-0 w-72">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-sm font-semibold truncate max-w-[130px]">{stage.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {stageDeals.length}
                      </span>
                    </div>
                    {stageValue > 0 && (
                      <span className="text-xs font-medium text-green-600">{formatCurrency(stageValue)}</span>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {stageDeals.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-muted-foreground text-xs">
                        Drop deals here
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => setSelectedDeal(deal as DealItem)}
                          className="bg-card border border-border rounded-xl p-4 hover:border-brand-500/40 hover:shadow-sm transition-all group cursor-pointer"
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <p className="font-medium text-sm leading-snug pr-2 flex-1">{deal.name}</p>
                            <DealStatusBadge status={deal.status} />
                          </div>

                          {deal.value && (
                            <div className="flex items-center gap-1 mb-2">
                              <DollarSign className="w-3.5 h-3.5 text-green-500" />
                              <span className="text-sm font-semibold text-green-600">{formatCurrency(Number(deal.value))}</span>
                            </div>
                          )}

                          {deal.contact && (
                            <p className="text-xs text-muted-foreground mb-1.5">
                              {deal.contact.first_name} {deal.contact.last_name ?? ''}
                            </p>
                          )}

                          {deal.probability && (
                            <div className="mb-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Probability</span>
                                <span className="font-medium">{Number(deal.probability)}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-500 rounded-full"
                                  style={{ width: `${Number(deal.probability)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {deal.expected_close && (
                                <>
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(deal.expected_close)}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(ev) => { ev.stopPropagation(); openEdit(deal as DealItem); }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  if (confirm(`Delete deal "${deal.name}"?`)) deleteDealMutation.mutate({ id: deal.id });
                                }}
                                className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DealFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditDeal(null); }}
        editId={editDeal?.id}
        initialValues={editDeal?.values}
        onSuccess={() => { setDialogOpen(false); setEditDeal(null); }}
      />

      {selectedDeal && (
        <DealDetailPanel
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onEdit={() => { openEdit(selectedDeal); setSelectedDeal(null); }}
        />
      )}
    </div>
  );
}

