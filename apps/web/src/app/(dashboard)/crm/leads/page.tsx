'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { cn, formatCurrency, formatDate, getInitials, generateAvatarColor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Target, Plus, Search, Pencil, Trash2, X,
  ArrowRightCircle, TrendingUp, Star,
} from 'lucide-react';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
type LeadSource = 'WEBSITE' | 'SOCIAL_MEDIA' | 'REFERRAL' | 'EMAIL_CAMPAIGN' | 'COLD_CALL' | 'TRADE_SHOW' | 'PARTNER' | 'OTHER';

const STATUS_COLUMNS: { key: LeadStatus; label: string; color: string; bg: string }[] = [
  { key: 'NEW', label: 'New', color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500/10' },
  { key: 'CONTACTED', label: 'Contacted', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10' },
  { key: 'QUALIFIED', label: 'Qualified', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
  { key: 'UNQUALIFIED', label: 'Unqualified', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  { key: 'CONVERTED', label: 'Converted', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
];

interface LeadFormState {
  title: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource | '';
  status: LeadStatus;
  score: number;
  estimated_value: string;
  notes: string;
}

const emptyForm: LeadFormState = {
  title: '',
  company: '',
  email: '',
  phone: '',
  source: '',
  status: 'NEW',
  score: 0,
  estimated_value: '',
  notes: '',
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-green-600 bg-green-500/10' :
    score >= 40 ? 'text-amber-600 bg-amber-500/10' :
    'text-muted-foreground bg-muted';
  return (
    <span className={cn('inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold', color)}>
      <Star className="w-3 h-3" /> {score}
    </span>
  );
}

function LeadFormDialog({
  open, onClose, editId, initialValues, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editId?: string;
  initialValues?: Partial<LeadFormState>;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<LeadFormState>({ ...emptyForm, ...initialValues });
  const utils = api.useUtils();

  const create = api.crm.leads.create.useMutation({
    onSuccess: () => { toast.success('Lead created'); void utils.crm.leads.list.invalidate(); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  const update = api.crm.leads.update.useMutation({
    onSuccess: () => { toast.success('Lead updated'); void utils.crm.leads.list.invalidate(); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const set = (k: keyof LeadFormState, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      source: (form.source as LeadSource) || undefined,
      email: form.email || undefined,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : undefined,
    };
    if (editId) {
      update.mutate({ id: editId, ...payload });
    } else {
      create.mutate({ ...payload, title: form.title });
    }
  };

  if (!open) return null;
  const isLoading = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-semibold text-lg">{editId ? 'Edit Lead' : 'Add New Lead'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Lead Title <span className="text-red-500">*</span></label>
            <input required value={form.title} onChange={(e) => set('title', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="e.g. Enterprise Software Deal" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Company</label>
              <input value={form.company} onChange={(e) => set('company', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="lead@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Source</label>
              <select value={form.source} onChange={(e) => set('source', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">Select source</option>
                {(['WEBSITE','SOCIAL_MEDIA','REFERRAL','EMAIL_CAMPAIGN','COLD_CALL','TRADE_SHOW','PARTNER','OTHER'] as LeadSource[]).map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as LeadStatus)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                {STATUS_COLUMNS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Lead Score (0–100)</label>
              <input type="number" min={0} max={100} value={form.score} onChange={(e) => set('score', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated Value ($)</label>
              <input type="number" min={0} value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="50000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="Additional notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {isLoading ? 'Saving...' : editId ? 'Update Lead' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConvertDialog({
  open, onClose, leadId, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  onSuccess: () => void;
}) {
  const { data: pipelines } = api.crm.pipeline.list.useQuery();
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [dealName, setDealName] = useState('');
  const [dealValue, setDealValue] = useState('');
  const utils = api.useUtils();

  const convert = api.crm.leads.convert.useMutation({
    onSuccess: () => {
      toast.success('Lead converted to deal');
      void utils.crm.leads.list.invalidate();
      void utils.crm.deals.list.invalidate();
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedPipeline = pipelines?.find((p) => p.id === pipelineId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    convert.mutate({
      lead_id: leadId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      deal_name: dealName,
      deal_value: dealValue ? parseFloat(dealValue) : undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Convert Lead to Deal</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Deal Name <span className="text-red-500">*</span></label>
            <input required value={dealName} onChange={(e) => setDealName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Pipeline <span className="text-red-500">*</span></label>
            <select required value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStageId(''); }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="">Select pipeline</option>
              {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {selectedPipeline && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Stage <span className="text-red-500">*</span></label>
              <select required value={stageId} onChange={(e) => setStageId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">Select stage</option>
                {selectedPipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Deal Value ($)</label>
            <input type="number" min={0} value={dealValue} onChange={(e) => setDealValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="10000" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={convert.isPending}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {convert.isPending ? 'Converting...' : 'Convert to Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLead, setEditLead] = useState<{ id: string; values: LeadFormState } | null>(null);
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);
  const utils = api.useUtils();

  const { data: leads, isLoading } = api.crm.leads.list.useQuery({ limit: 200, search: search || undefined });

  const deleteLead = api.crm.leads.delete.useMutation({
    onSuccess: () => { toast.success('Lead deleted'); void utils.crm.leads.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const grouped = STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = leads?.filter((l) => l.status === col.key) ?? [];
    return acc;
  }, {} as Record<LeadStatus, typeof leads extends undefined ? never[] : NonNullable<typeof leads>>);

  const openEdit = (l: NonNullable<typeof leads>[number]) => {
    setEditLead({
      id: l.id,
      values: {
        title: l.title,
        company: l.company ?? '',
        email: l.email ?? '',
        phone: l.phone ?? '',
        source: (l.source as LeadSource | null) ?? '',
        status: l.status,
        score: l.score,
        estimated_value: l.estimated_value ? String(l.estimated_value) : '',
        notes: l.notes ?? '',
      },
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground mt-1">Track and manage your sales leads</p>
        </div>
        <button
          onClick={() => { setEditLead(null); setDialogOpen(true); }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-0 border-b border-border">
        {[
          { href: '/crm', label: 'Overview' },
          { href: '/crm/contacts', label: 'Contacts' },
          { href: '/crm/leads', label: 'Leads', active: true },
          { href: '/crm/deals', label: 'Deals' },
          { href: '/crm/activities', label: 'Activities' },
        ].map((link) => (
          <Link key={link.href} href={link.href}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              link.active ? 'border-brand-500 text-brand-500' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border')}>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} type="search"
          placeholder="Search leads..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} className="flex-shrink-0 w-72">
              <div className="h-8 w-32 bg-muted rounded-lg mb-3 animate-pulse" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 mb-3 animate-pulse space-y-2">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="h-3 w-28 bg-muted rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => {
            const colLeads = grouped[col.key] ?? [];
            return (
              <div key={col.key} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-semibold', col.color)}>{col.label}</span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', col.bg, col.color)}>
                      {colLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {colLeads.length === 0 ? (
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
                      No {col.label.toLowerCase()} leads
                    </div>
                  ) : (
                    colLeads.map((lead) => (
                      <div key={lead.id} className="bg-card border border-border rounded-xl p-4 hover:border-brand-500/30 hover:shadow-sm transition-all group">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-sm leading-snug">{lead.title}</p>
                          <ScoreBadge score={lead.score} />
                        </div>

                        {lead.company && (
                          <p className="text-xs text-muted-foreground mb-2">{lead.company}</p>
                        )}

                        {lead.email && (
                          <p className="text-xs text-muted-foreground truncate mb-1">{lead.email}</p>
                        )}

                        {lead.estimated_value && (
                          <p className="text-xs font-semibold text-green-600 mb-2">
                            {formatCurrency(Number(lead.estimated_value))}
                          </p>
                        )}

                        {lead.assignee && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                              style={{ backgroundColor: generateAvatarColor(lead.assignee.id) }}
                            >
                              {getInitials(lead.assignee.name)}
                            </div>
                            <span className="text-xs text-muted-foreground">{lead.assignee.name}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <span className="text-xs text-muted-foreground">{formatDate(lead.created_at)}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {lead.status !== 'CONVERTED' && lead.status !== 'UNQUALIFIED' && (
                              <button
                                onClick={() => setConvertLeadId(lead.id)}
                                className="p-1 rounded hover:bg-brand-500/10 text-muted-foreground hover:text-brand-500 transition-colors"
                                title="Convert to deal"
                              >
                                <ArrowRightCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(lead)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit lead"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete lead "${lead.title}"?`)) {
                                  deleteLead.mutate({ id: lead.id });
                                }
                              }}
                              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Delete lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      )}

      <LeadFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditLead(null); }}
        editId={editLead?.id}
        initialValues={editLead?.values}
        onSuccess={() => { setDialogOpen(false); setEditLead(null); }}
      />

      {convertLeadId && (
        <ConvertDialog
          open={!!convertLeadId}
          onClose={() => setConvertLeadId(null)}
          leadId={convertLeadId}
          onSuccess={() => setConvertLeadId(null)}
        />
      )}
    </div>
  );
}
