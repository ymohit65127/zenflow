'use client';

import { useState } from 'react';
import { CalendarDays, Plus, Edit, Trash2, X, Check, RefreshCw } from 'lucide-react';
import { api } from '@/trpc/react';

const ACCRUAL_LABELS: Record<string, string> = {
  none: 'None',
  monthly: 'Monthly',
  yearly: 'Yearly',
  on_grant: 'On Grant',
};

type LeaveType = {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string | null;
  accrual_type: string;
  accrual_amount: unknown;
  max_balance: unknown;
  carry_forward_enabled: boolean;
  encashment_enabled: boolean;
  paid_leave: boolean;
  requires_document: boolean;
  min_days: unknown;
  advance_notice_days: number;
  is_active: boolean;
  _count: { leave_requests: number };
};

function LeaveTypeForm({
  lt,
  onClose,
}: {
  lt: LeaveType | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState({
    name: lt?.name ?? '',
    code: lt?.code ?? '',
    color: lt?.color ?? '#6366f1',
    description: lt?.description ?? '',
    accrual_type: (lt?.accrual_type ?? 'none') as 'none' | 'monthly' | 'yearly' | 'on_grant',
    accrual_amount: Number(lt?.accrual_amount ?? 0),
    max_balance: Number(lt?.max_balance ?? 30),
    carry_forward_enabled: lt?.carry_forward_enabled ?? false,
    encashment_enabled: lt?.encashment_enabled ?? false,
    paid_leave: lt?.paid_leave ?? true,
    requires_document: lt?.requires_document ?? false,
    min_days: Number(lt?.min_days ?? 0.5),
    advance_notice_days: lt?.advance_notice_days ?? 0,
  });

  const create = api.hr.hr_leave_types.create.useMutation({
    onSuccess: () => { void utils.hr.hr_leave_types.list.invalidate(); onClose(); },
  });
  const update = api.hr.hr_leave_types.update.useMutation({
    onSuccess: () => { void utils.hr.hr_leave_types.list.invalidate(); onClose(); },
  });

  const isPending = create.isPending || update.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lt) {
      update.mutate({ id: lt.id, ...form });
    } else {
      create.mutate(form);
    }
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key] as string | number,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value })),
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">{lt ? 'Edit Leave Type' : 'New Leave Type'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Name *</label>
              <input {...field('name')} placeholder="e.g. Annual Leave" required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Code *</label>
              <input {...field('code')} placeholder="AL" required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Color</label>
              <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="w-full h-[38px] px-1 py-1 bg-background border border-border rounded-lg cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Max Balance (days)</label>
              <input type="number" min={0} {...field('max_balance')} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Accrual Type</label>
              <select value={form.accrual_type} onChange={(e) => setForm((f) => ({ ...f, accrual_type: e.target.value as typeof f.accrual_type }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30">
                {Object.entries(ACCRUAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Accrual Amount</label>
              <input type="number" min={0} step={0.5} {...field('accrual_amount')} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Min Days</label>
              <input type="number" min={0.5} step={0.5} {...field('min_days')} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notice Days</label>
              <input type="number" min={0} {...field('advance_notice_days')} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {(
              [
                ['paid_leave', 'Paid Leave'],
                ['carry_forward_enabled', 'Carry Forward'],
                ['encashment_enabled', 'Encashment'],
                ['requires_document', 'Requires Document'],
              ] as [keyof typeof form, string][]
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key] as boolean}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
              {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {lt ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeaveTypesPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingLt, setEditingLt] = useState<LeaveType | null>(null);
  const utils = api.useUtils();
  const { data: types = [], isLoading } = api.hr.hr_leave_types.list.useQuery();
  const deleteMutation = api.hr.hr_leave_types.delete.useMutation({
    onSuccess: () => void utils.hr.hr_leave_types.list.invalidate(),
  });
  const initYear = api.hr.hr_leave_balance.initializeYear.useMutation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Policy Manager</h1>
          <p className="text-muted-foreground mt-1">{types.length} leave types configured</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { if (confirm('Initialize leave balances for current year?')) initYear.mutate({ year: new Date().getFullYear() }); }}
            disabled={initYear.isPending}
            className="flex items-center gap-1.5 border border-border hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${initYear.isPending ? 'animate-spin' : ''}`} />
            Init Year
          </button>
          <button
            onClick={() => { setEditingLt(null); setShowDialog(true); }}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Type
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : types.length === 0 ? (
        <div className="text-center py-20">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">No leave types configured</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {types.map((lt) => (
            <div key={lt.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{lt.name}</h3>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{lt.code}</span>
                  {lt.paid_leave && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Paid</span>}
                  {lt.carry_forward_enabled && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">CF</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Max: {String(lt.max_balance)} days · Accrual: {ACCRUAL_LABELS[lt.accrual_type]} · {lt._count.leave_requests} requests
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditingLt(lt); setShowDialog(true); }} className="p-1.5 rounded hover:bg-muted transition-colors">
                  <Edit className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => { if (confirm('Deactivate this leave type?')) deleteMutation.mutate({ id: lt.id }); }} className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDialog && <LeaveTypeForm lt={editingLt} onClose={() => setShowDialog(false)} />}
    </div>
  );
}
